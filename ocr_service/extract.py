"""
extract.py — VisionGrade Module 2: Standalone OCR Script
=========================================================
Accepts a single image (JPG/PNG/etc.) **or a PDF** of a handwritten answer
sheet and outputs the extracted text.

Run from the ocr_service/ directory (with venv active):

    python extract.py path/to/answer_sheet.jpg
    python extract.py path/to/answer_sheet.pdf --output result.txt --cleanup
    python extract.py path/to/sheet.png --out output/ --debug

What it does:
  1. If input is a PDF, converts each page to a 300-DPI image first.
  2. Preprocesses each page (deskew -> denoise -> binarise).
  3. Segments each page into horizontal text lines using OpenCV.
  4. Runs all line crops through microsoft/trocr-base-handwritten in batches.
  5. Reassembles lines in reading order; multi-page PDFs get [Page N] headers.
  6. Prints and optionally saves the full text.

Usage:
    python extract.py <path> [--out DIR] [--output FILE] [--cleanup] [--debug]

Arguments:
    path         Path to a JPG, PNG, or PDF file.
    --out        Directory for intermediate files (default: output/).
    --output     Save extracted text to this .txt file.
    --cleanup    Delete intermediate line-crop images after OCR.
    --debug      Save preprocessing debug images.
    --batch-size Images per TrOCR forward pass (default: 4).
"""

import argparse
import logging
import math
import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


# Raster DPI / page size. 300 DPI A4 is ~3500px and is wasted work: TrOCR
# resizes every line to 384×384. 180 DPI + a max side cap is enough.
PDF_DPI = int(os.getenv("OCR_PDF_DPI", "180"))
MAX_PAGE_SIDE = int(os.getenv("OCR_MAX_PAGE_SIDE", "1680"))
MIN_PAGE_SIDE = int(os.getenv("OCR_MIN_PAGE_SIDE", "1600"))


def _pil_to_bgr(pil_img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(pil_img.convert("RGB")), cv2.COLOR_RGB2BGR)


def _load_image_any(path: str) -> Optional[np.ndarray]:
    """Load a raster image regardless of file extension (JPEG saved as .pdf, etc.)."""
    img = cv2.imread(path)
    if img is not None:
        return img
    try:
        with Image.open(path) as pil_img:
            return _pil_to_bgr(pil_img)
    except Exception:
        return None


def _downscale_page(img_bgr: np.ndarray, max_side: int = MAX_PAGE_SIDE) -> np.ndarray:
    h, w = img_bgr.shape[:2]
    longest = max(h, w)
    if longest < MIN_PAGE_SIDE:
        scale = MIN_PAGE_SIDE / float(longest)
        new_w = max(1, int(w * scale))
        new_h = max(1, int(h * scale))
        log.info("Upscaling page %dx%d → %dx%d", w, h, new_w, new_h)
        return cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    if longest <= max_side:
        return img_bgr
    scale = max_side / float(longest)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    log.info("Downscaling page %dx%d → %dx%d", w, h, new_w, new_h)
    return cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _load_input_as_pages(path: str, dpi: int = PDF_DPI) -> List[np.ndarray]:
    """
    Return a list of OpenCV BGR images, one per page.
    PDFs are rasterised; if rasterisation fails the file is tried as an image
    (phone photos often arrive with a .pdf extension).
    """
    ext = Path(path).suffix.lower()

    if ext == ".pdf":
        try:
            from pdf2image import convert_from_path
            log.info("PDF detected — rasterising pages at %d DPI ...", dpi)
            pil_pages = convert_from_path(path, dpi=dpi, thread_count=2)
            if not pil_pages:
                raise RuntimeError("PDF produced no pages.")
            log.info("PDF has %d page(s).", len(pil_pages))
            return [_downscale_page(_pil_to_bgr(p)) for p in pil_pages]
        except Exception as exc:
            log.warning("PDF rasterise failed (%s) — trying as a raster image.", exc)
            img = _load_image_any(path)
            if img is None:
                raise RuntimeError(f"[ERROR] Could not rasterise PDF: {exc}") from exc
            return [_downscale_page(img)]

    img = _load_image_any(path)
    if img is None:
        raise RuntimeError(f"[ERROR] Could not read image: {path}")
    return [_downscale_page(img)]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("extract")

# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
MODEL_ID = "microsoft/trocr-base-handwritten"

# Segmentation tuning knobs (values are relative to the *downscaled* page).
HORIZ_KERNEL_H  = 2
DILATION_ITERS  = 2
LINE_PADDING    = 8
MAX_ASPECT      = 28
MAX_LINE_H_RATIO = 0.09
# Only skip the far-right edge (scoring grid / page curl). Question numbers
# live in the left margin of Indian notebooks — do not crop them away.
RIGHT_MARGIN_FRAC = 0.04
HEADER_FRAC = 0.08
MIN_INK_RATIO = 0.022
MIN_CONFIDENCE  = 0.25

_YEAR_RE = re.compile(r"\b(?:18|19|20)\d{2}s?\b")
_WIKI_RE = re.compile(
    r"\b(categories|births|deaths|wikipedia|opera|figure skating|"
    r"american male|stage actors|house of representatives|wikidata|"
    r"what links here|special pages|united states congress|"
    r"displaystyle|related changes|permanent link)\b",
    re.I,
)
_ALPHABET_RE = re.compile(r"^(?:[a-z][.\s]*){8,}$", re.I)
_REPEAT_RE = re.compile(r"\b(\w+)(?:\s+\1){3,}\b", re.I)
_DIGIT_ONLY_RE = re.compile(r"^[\d\s./\-]+$")


# ===========================================================================
# Step 1: Preprocessing
# ===========================================================================

def _estimate_skew_angle(gray: np.ndarray) -> float:
    """Skew angle in degrees, estimated on a small copy of the page."""
    h, w = gray.shape[:2]
    scale = min(1.0, 900.0 / max(h, w))
    small = gray if scale == 1.0 else cv2.resize(
        gray, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA
    )
    _, binary = cv2.threshold(small, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    lines = cv2.HoughLinesP(
        binary, 1, np.pi / 180,
        threshold=80,
        minLineLength=small.shape[1] // 4,
        maxLineGap=16,
    )
    if lines is None:
        return 0.0

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line.flatten()
        if x2 == x1:
            continue
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        if abs(angle) <= 10:
            angles.append(angle)

    if not angles:
        return 0.0
    median_angle = float(np.median(angles))
    if abs(median_angle) < 0.2 or abs(median_angle) > 5:
        return 0.0
    return median_angle


def _rotate(img: np.ndarray, angle: float) -> np.ndarray:
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), angle, 1.0)
    return cv2.warpAffine(
        img, M, (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )


def _ink_gray(img_bgr: np.ndarray) -> np.ndarray:
    """Blue ballpoint is dark on the red/green channels; average gray washes it out."""
    _b, g, r = cv2.split(img_bgr)
    return cv2.min(r, g)


def preprocess(img_bgr: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """
    Deskew the colour page, then binarise for contour detection.

    Returns:
        deskewed_bgr : colour page aligned with the binary mask (crops come from here)
        binary_inv   : ink=white / background=black
    """
    gray = _ink_gray(img_bgr)
    angle = _estimate_skew_angle(gray)
    if angle:
        log.info("Deskewing by %.2f deg", angle)
        img_bgr = _rotate(img_bgr, angle)
        gray = _rotate(gray, angle)

    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    binary_inv = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=31,
        C=10,
    )
    return img_bgr, binary_inv


# ===========================================================================
# Step 2: Line segmentation
# ===========================================================================

def _merge_line_boxes(
    boxes: List[Tuple[int, int, int, int]],
    img_w: int,
    max_h: Optional[int] = None,
) -> List[Tuple[int, int, int, int]]:
    """
    Merge fragments on the same handwritten line.

    Only join boxes that overlap vertically AND are close horizontally.
    Merging every blob on a y-band into a full-page strip feeds TrOCR empty
    ruled-notebook rows, which then hallucinates years / Wikipedia text.
    """
    if not boxes:
        return []

    max_gap = max(36, int(img_w * 0.08))
    boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
    merged: List[List[int]] = []

    for x, y, w, h in boxes:
        placed = False
        for row in merged:
            rx, ry, rw, rh = row
            overlap_y = max(0, min(y + h, ry + rh) - max(y, ry))
            min_h = min(h, rh)
            if min_h <= 0 or overlap_y / min_h < 0.45:
                continue
            overlap_x = max(0, min(x + w, rx + rw) - max(x, rx))
            gap = max(0, x - (rx + rw), rx - (x + w))
            if overlap_x > 0 or gap <= max_gap:
                nx = min(x, rx)
                ny = min(y, ry)
                nx2 = max(x + w, rx + rw)
                ny2 = max(y + h, ry + rh)
                if max_h is not None and (ny2 - ny) > max_h:
                    continue
                row[:] = [nx, ny, nx2 - nx, ny2 - ny]
                placed = True
                break
        if not placed:
            merged.append([x, y, w, h])

    merged.sort(key=lambda b: (b[1], b[0]))
    return [tuple(b) for b in merged]


def _detect_margin_x(img_bgr: np.ndarray) -> int:
    """Pink/red notebook margin line, or ~12% from the left."""
    h, w = img_bgr.shape[:2]
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    red = cv2.bitwise_or(
        cv2.inRange(hsv, (0, 40, 60), (12, 255, 255)),
        cv2.inRange(hsv, (160, 40, 60), (180, 255, 255)),
    )
    left_w = max(20, int(w * 0.38))
    col_sums = np.count_nonzero(red[:, :left_w], axis=0)
    peak = int(col_sums.max()) if col_sums.size else 0
    if peak >= h * 0.18:
        return int(np.argmax(col_sums))
    return int(w * 0.12)


def _boxes_from_binary(
    binary: np.ndarray,
    kernel_w: int,
    min_w: int,
    min_h: int,
    max_h: int,
    header_lim: int,
    right_lim: int,
) -> List[Tuple[int, int, int, int]]:
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(8, kernel_w), HORIZ_KERNEL_H))
    dilated = cv2.dilate(binary, h_kernel, iterations=DILATION_ITERS)
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w < min_w or h < min_h or h > max_h:
            continue
        if h > 0 and (w / h) > MAX_ASPECT:
            continue
        if y + h <= header_lim:
            continue
        if x >= right_lim:
            continue
        out.append((x, y, w, h))
    return out


def _ink_ratio(gray: np.ndarray) -> float:
    """Fraction of dark pixels after dropping faint horizontal ruling."""
    if gray is None or gray.size == 0:
        return 0.0
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    h, w = binary.shape[:2]
    if w > 40:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(w // 4, 20), 1))
        rules = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        binary = cv2.subtract(binary, rules)
    return float(np.count_nonzero(binary)) / float(binary.size)


def _enhance_for_trocr(crop_bgr: np.ndarray) -> Image.Image:
    """Contrast-boosted ink channel so blue pen stays visible."""
    gray = _ink_gray(crop_bgr)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    h, w = enhanced.shape[:2]
    if 0 < h < 48:
        scale = 48.0 / h
        enhanced = cv2.resize(
            enhanced,
            (max(1, int(w * scale)), 48),
            interpolation=cv2.INTER_CUBIC,
        )
    return Image.fromarray(cv2.cvtColor(enhanced, cv2.COLOR_GRAY2RGB))


def is_hallucinated_ocr(text: str) -> bool:
    """Drop decoder dumps only. Keep noisy handwriting even if some words are wrong."""
    t = (text or "").strip()
    if not t:
        return True
    if _WIKI_RE.search(t):
        return True
    if _ALPHABET_RE.match(t):
        return True
    if _REPEAT_RE.search(t):
        return True
    if t.count("0") >= 8 and len(re.findall(r"[A-Za-z]{3,}", t)) == 0:
        return True
    years = _YEAR_RE.findall(t)
    if len(years) >= 3:
        return True
    tokens = re.findall(r"[A-Za-z0-9]+", t)
    if not tokens:
        return True
    if all(tok.isdigit() and len(tok) == 1 for tok in tokens) and len(tokens) >= 2:
        return True
    compact = re.sub(r"\s+", " ", t)
    if _DIGIT_ONLY_RE.fullmatch(compact) and (years or len(re.findall(r"\d", compact)) > 4):
        return True
    return False


def _smooth_1d(values: np.ndarray, k: int = 9) -> np.ndarray:
    k = max(3, k | 1)
    kernel = np.ones(k, dtype=np.float32) / float(k)
    return np.convolve(values.astype(np.float32), kernel, mode="same")


def _peak_indices(profile: np.ndarray, min_dist: int, min_val: float) -> List[int]:
    peaks: List[int] = []
    for i in range(1, len(profile) - 1):
        if profile[i] < min_val:
            continue
        if profile[i] < profile[i - 1] or profile[i] < profile[i + 1]:
            continue
        if peaks and (i - peaks[-1]) < min_dist:
            if profile[i] > profile[peaks[-1]]:
                peaks[-1] = i
            continue
        peaks.append(i)
    return peaks


def _ink_runs(profile: np.ndarray, thresh: float, min_h: int, pad: int) -> List[Tuple[int, int]]:
    runs: List[Tuple[int, int]] = []
    start = None
    for i, value in enumerate(profile):
        if value >= thresh:
            if start is None:
                start = i
        elif start is not None:
            if i - start >= min_h:
                runs.append((max(0, start - pad), min(len(profile), i + pad)))
            start = None
    if start is not None and len(profile) - start >= min_h:
        runs.append((max(0, start - pad), len(profile)))
    return runs


def _q_label_blob_ys(
    binary_clean: np.ndarray,
    margin_x: int,
    header_lim: int,
    img_h: int,
) -> List[int]:
    """Q-numbers left of the pink ruling, as connected-component rows."""
    left_w = max(16, min(margin_x, binary_clean.shape[1]))
    left = binary_clean[:, :left_w].copy()
    rule_k = cv2.getStructuringElement(cv2.MORPH_RECT, (max(left_w // 2, 8), 1))
    left = cv2.subtract(left, cv2.morphologyEx(left, cv2.MORPH_OPEN, rule_k))
    left = cv2.morphologyEx(
        left, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 5))
    )
    n_cc, _labels, stats, centroids = cv2.connectedComponentsWithStats(left, 8)
    blobs: List[Tuple[float, int]] = []
    y_hi = int(img_h * 0.82)
    for i in range(1, n_cc):
        x, y, bw, bh, area = stats[i]
        cy = float(centroids[i][1])
        if cy <= header_lim or cy >= y_hi:
            continue
        if x <= 2 or bw <= 2 or area < 40 or bh < 10 or bh > 55 or bw > 70:
            continue
        blobs.append((cy, int(area)))
    blobs.sort(key=lambda t: t[0])
    rows: List[List[Tuple[float, int]]] = []
    for blob in blobs:
        if rows and abs(blob[0] - np.mean([b[0] for b in rows[-1]])) < 22:
            rows[-1].append(blob)
        else:
            rows.append([blob])
    ys: List[int] = []
    for row in rows:
        area = sum(b[1] for b in row)
        if area < 150:
            continue
        ys.append(int(round(float(np.mean([b[0] for b in row])))))
    return ys


def _hough_q_circle_ys(
    img_bgr: np.ndarray,
    split_x: int,
    header_lim: int,
    img_h: int,
    margin_x: int,
) -> List[int]:
    """Q-loop centres in the left margin (catches labels that join a ruling line)."""
    gray = _ink_gray(img_bgr)
    split = max(40, min(split_x, gray.shape[1]))
    y_hi = int(img_h * 0.82)
    left = cv2.medianBlur(gray[:, :split], 5)
    circles = cv2.HoughCircles(
        left,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=32,
        param1=50,
        param2=14,
        minRadius=8,
        maxRadius=22,
    )
    # True Q-loops sit in the inner margin. Circles hugging the pink ruling
    # are notebook holes / second-line ink, not question numbers.
    x_hi = max(36, int(margin_x * 0.62))
    cands: List[Tuple[float, float]] = []
    if circles is not None:
        for x, y, r in circles[0]:
            if header_lim < y < y_hi and 8 <= x <= x_hi:
                cands.append((float(y), float(r)))
    cands.sort(key=lambda t: t[0])
    kept: List[Tuple[float, float]] = []
    for y, r in cands:
        conflict_i = next((i for i, k in enumerate(kept) if abs(k[0] - y) < 36), None)
        if conflict_i is None:
            kept.append((y, r))
        elif r > kept[conflict_i][1]:
            kept[conflict_i] = (y, r)
    return [int(y) for y, _r in kept]


def _q_peaks_from_margin(
    img_bgr: np.ndarray,
    binary_clean: np.ndarray,
    split_x: int,
    header_lim: int,
    img_h: int,
    question_count: int = 0,
    margin_x: int = 0,
) -> List[int]:
    """
    Q1, Q2, … y-centres. Blob rows are the source of truth; a Hough Q-loop is
    inserted only when it sits one notebook line below a blob Q (Q3 on this
    sheet sits on the line under Q2 and is missed by contours). Never invent
    extra labels from footer ticks.
    """
    margin_x = margin_x or split_x
    blob_ys = _q_label_blob_ys(binary_clean, margin_x, header_lim, img_h)
    circle_ys = _hough_q_circle_ys(img_bgr, split_x, header_lim, img_h, margin_x)
    ys = list(blob_ys)
    n = int(question_count or 0)
    anchors = blob_ys if blob_ys else circle_ys
    upper = int(img_h * 0.82)
    # Only fill a missing Q when blobs are short (Q3 can sit one line under Q2).
    if not n or len(ys) < n:
        for i, prev in enumerate(anchors):
            nxt = anchors[i + 1] if i + 1 < len(anchors) else upper
            if nxt - prev < 70:
                continue
            near = [
                cy for cy in circle_ys
                if 24 <= (cy - prev) <= 58 and cy < nxt - 20
                and all(abs(cy - existing) >= 28 for existing in ys)
            ]
            if near:
                ys.append(min(near))
    ys = sorted(set(ys))
    if n >= 1 and len(ys) < n:
        for cy in circle_ys:
            if len(ys) >= n:
                break
            if all(abs(cy - existing) >= 40 for existing in ys):
                ys.append(cy)
        ys = sorted(ys)
    if n >= 1 and len(ys) > n:
        inserts = [y for y in ys if all(abs(y - b) >= 20 for b in blob_ys)]
        ys = list(blob_ys)
        for y in inserts:
            if len(ys) >= n:
                break
            ys.append(y)
        ys = sorted(ys)[:n]
    log.info("Q-row blobs=%s circles=%s merged=%s", blob_ys, circle_ys, ys)
    return ys


def _trim_horizontal(binary_strip: np.ndarray) -> Tuple[int, int]:
    """Crop to handwriting blobs; ignore full-width notebook rulings."""
    h, w = binary_strip.shape[:2]
    if h == 0 or w == 0:
        return 0, w
    rule_k = cv2.getStructuringElement(cv2.MORPH_RECT, (max(24, w // 8), 1))
    ink = cv2.subtract(binary_strip, cv2.morphologyEx(binary_strip, cv2.MORPH_OPEN, rule_k))
    n_cc, _labels, stats, _cent = cv2.connectedComponentsWithStats(ink, 8)
    spans: List[Tuple[int, int]] = []
    for i in range(1, n_cc):
        x, _y, bw, bh, area = stats[i]
        if area < 12 or bh <= 3:
            continue
        if bw > int(0.75 * w) and bh < max(8, int(0.4 * h)):
            continue
        spans.append((int(x), int(x + bw)))
    if not spans:
        col = np.count_nonzero(ink, axis=0)
        hits = np.where(col >= max(2, int(h * 0.2)))[0]
        if hits.size == 0:
            return 0, w
        spans = [(int(hits[0]), int(hits[-1]) + 1)]
    spans.sort()
    merged: List[List[int]] = [list(spans[0])]
    for x0, x1 in spans[1:]:
        if x0 <= merged[-1][1] + 70:
            merged[-1][1] = max(merged[-1][1], x1)
        else:
            merged.append([x0, x1])
    clusters = [m for m in merged if (m[1] - m[0]) >= 40] or merged
    left_w = clusters[0][1] - clusters[0][0]
    if (
        len(clusters) > 1
        and 55 <= left_w <= int(0.4 * w)
        and (clusters[1][0] - clusters[0][1]) > 80
    ):
        x0, x1 = clusters[0]
    else:
        x0, x1 = clusters[0][0], clusters[-1][1]
    pad = 12
    return max(0, x0 - pad), min(w, x1 + pad)


def segment_lines(
    img_bgr: np.ndarray,
    binary_inv: np.ndarray,
    question_count: int = 0,
) -> List[Tuple[Optional[Image.Image], Tuple[int, int, int, int], str]]:
    """
    Notebook layout: Q-numbers in the left margin, answers to the right of the
    pink ruling. Each question band is split into handwriting lines by row-ink
    projection so TrOCR sees the real answer, not empty ruling.
    """
    img_h, img_w = img_bgr.shape[:2]
    header_lim = int(img_h * HEADER_FRAC)
    gray = _ink_gray(img_bgr)
    margin_x = max(24, min(_detect_margin_x(img_bgr), int(img_w * 0.4)))
    split_x = min(max(margin_x + 16, int(img_w * 0.14)), int(img_w * 0.28))
    answer_left = max(0, margin_x + 2)
    answer_right = int(img_w * 0.88)
    log.info(
        "Notebook margin at x=%d (split=%d answers=%d:%d) / %d question_count=%s",
        margin_x, split_x, answer_left, answer_right, img_w, question_count or "auto",
    )

    rule_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(img_w // 5, 40), 1))
    horiz_rules = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, rule_kernel)
    horiz_rules = cv2.dilate(horiz_rules, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 3)), iterations=1)
    binary_clean = cv2.subtract(binary_inv, horiz_rules)

    q_ys = _q_peaks_from_margin(
        img_bgr, binary_clean, split_x, header_lim, img_h, question_count, margin_x
    )
    log.info("Q-row peaks: %s", q_ys)

    entries: List[Tuple[Optional[Image.Image], Tuple[int, int, int, int], str]] = []
    n_q = int(question_count or 0) or len(q_ys)
    if len(q_ys) >= 2 and n_q >= 1:
        q_ys = q_ys[:n_q]
        bands: List[Tuple[int, int]] = []
        for i, qy in enumerate(q_ys):
            if i == 0:
                y0 = max(header_lim, qy - 28)
            else:
                y0 = (q_ys[i - 1] + qy) // 2
            if i + 1 < len(q_ys):
                y1 = (qy + q_ys[i + 1]) // 2
            else:
                y1 = min(img_h - 1, qy + 70)
            bands.append((y0, max(y0 + 8, y1)))

        def _crop_run(abs_y0: int, abs_y1: int, prefix: str):
            strip = binary_clean[abs_y0:abs_y1, answer_left:answer_right]
            if strip.size == 0:
                return None
            x0_rel, x1_rel = _trim_horizontal(strip)
            pad = 4
            cx1 = max(0, answer_left + x0_rel - pad)
            cy1 = max(0, abs_y0 - pad)
            cx2 = min(img_w, answer_left + x1_rel + pad)
            cy2 = min(img_h, abs_y1 + pad)
            crop_bgr = img_bgr[cy1:cy2, cx1:cx2]
            if crop_bgr.size == 0:
                return None
            if _ink_ratio(gray[cy1:cy2, cx1:cx2]) < 0.010:
                return None
            run_h = cy2 - cy1
            run_w = cx2 - cx1
            if run_h <= 26 and run_w > 0.65 * (answer_right - answer_left):
                return None
            if run_w < 55:
                return None
            if cx1 > answer_left + int(0.42 * (answer_right - answer_left)):
                return None
            return (_enhance_for_trocr(crop_bgr), (cx1, cy1, cx2, cy2), prefix)

        for i, qy in enumerate(q_ys):
            prefix = f"Q{i + 1}"
            y0, y1 = bands[i]
            band = binary_clean[y0:y1, answer_left:answer_right]
            runs_i: List[Tuple[int, int]] = []
            if band.size:
                row_profile = np.count_nonzero(band, axis=1) / float(max(band.shape[1], 1))
                thresh = max(0.012, float(np.median(row_profile)) + 0.008)
                runs_i = [
                    (y0 + ry0, y0 + ry1)
                    for ry0, ry1 in _ink_runs(row_profile, thresh, min_h=5, pad=4)
                ]
                merged_runs: List[Tuple[int, int]] = []
                for abs_y0, abs_y1 in runs_i:
                    if merged_runs and abs_y0 < merged_runs[-1][1]:
                        merged_runs[-1] = (merged_runs[-1][0], max(merged_runs[-1][1], abs_y1))
                    else:
                        merged_runs.append((abs_y0, abs_y1))
                runs_i = merged_runs
            if not runs_i:
                entries.append((None, (answer_left, y0, answer_right, y1), prefix))
                continue
            crops = []
            for abs_y0, abs_y1 in runs_i:
                item = _crop_run(abs_y0, abs_y1, "" if crops else prefix)
                if item is not None:
                    crops.append(item)
            if not crops:
                item = _crop_run(max(y0, qy - 22), min(y1, qy + 24), prefix)
                if item is not None and (item[1][2] - item[1][0]) >= 80:
                    crops.append(item)
            if not crops:
                entries.append((None, (answer_left, y0, answer_right, y1), prefix))
            else:
                entries.extend(crops)
        return entries

    # Fallback: old blob segmentation if the Q-column cannot be found.
    log.info("No Q-column peaks — falling back to blob lines")
    min_line_h = max(10, int(img_h * 0.006))
    max_h = int(img_h * MAX_LINE_H_RATIO)
    right_lim = int(img_w * (1 - RIGHT_MARGIN_FRAC))
    left_bin = binary_clean.copy()
    left_bin[:, split_x:] = 0
    right_bin = binary_clean.copy()
    right_bin[:, :split_x] = 0
    right_boxes = _boxes_from_binary(
        right_bin,
        kernel_w=max(18, (img_w - margin_x) // 18),
        min_w=max(12, int((img_w - margin_x) * 0.03)),
        min_h=min_line_h,
        max_h=max_h,
        header_lim=header_lim,
        right_lim=right_lim,
    )
    right_boxes = _merge_line_boxes(right_boxes, img_w - margin_x, max_h)
    for box in sorted(right_boxes, key=lambda b: (b[1], b[0])):
        x, y, w, h = box
        x1, y1 = max(0, x - LINE_PADDING), max(0, y - LINE_PADDING)
        x2, y2 = min(img_w, x + w + LINE_PADDING), min(img_h, y + h + LINE_PADDING)
        crop_bgr = img_bgr[y1:y2, x1:x2]
        if crop_bgr.size == 0 or _ink_ratio(gray[y1:y2, x1:x2]) < MIN_INK_RATIO:
            continue
        entries.append((_enhance_for_trocr(crop_bgr), (x1, y1, x2, y2), ""))
    return entries


# ===========================================================================
# Step 3: TrOCR inference
# ===========================================================================

def _pick_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
        return torch.device("mps")
    return torch.device("cpu")


def load_trocr() -> Tuple[TrOCRProcessor, VisionEncoderDecoderModel, torch.device]:
    """
    Load microsoft/trocr-base-handwritten onto CUDA, Apple MPS, or CPU.
    """
    log.info("Loading TrOCR model: %s", MODEL_ID)
    t0 = time.time()

    from transformers import ViTImageProcessor, RobertaTokenizer
    img_proc = ViTImageProcessor.from_pretrained(MODEL_ID)
    tokenizer = RobertaTokenizer.from_pretrained(MODEL_ID)
    processor = TrOCRProcessor(image_processor=img_proc, tokenizer=tokenizer)

    model = VisionEncoderDecoderModel.from_pretrained(MODEL_ID)
    model.eval()
    if hasattr(model, "generation_config") and model.generation_config is not None:
        model.generation_config.use_cache = True
        model.generation_config.num_beams = 3

    device = _pick_device()
    model = model.to(device)
    if device.type == "cpu":
        torch.set_num_threads(max(1, min(8, os.cpu_count() or 4)))

    log.info("Model loaded on %s in %.1f s.", device, time.time() - t0)
    return processor, model, device


# ---------------------------------------------------------------------------
# TrOCR input preparation
# ---------------------------------------------------------------------------

# ViTImageProcessor always resizes its input to 384×384 regardless of the
# original aspect ratio.  A typical extracted line strip is very wide and
# short (e.g. 1300×60 px, ~22:1 ratio).  Squashing that to 384×384 makes
# the text completely unreadable.  The fix: scale the line to fit inside a
# 384×384 white canvas first, so the downstream resize is a no-op.
_TROCR_IMG_SIZE = 384


def _fit_on_canvas(img: Image.Image, target: int) -> Image.Image:
    w, h = img.size
    if w > target or h > target:
        scale = min(target / max(w, 1), target / max(h, 1))
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.BICUBIC)
        w, h = img.size
    canvas = Image.new("RGB", (target, target), (255, 255, 255))
    canvas.paste(img, (0, max(0, (target - h) // 2)))
    return canvas


def _trocr_windows(line_img: Image.Image, target: int = _TROCR_IMG_SIZE) -> List[Image.Image]:
    """
    Keep handwriting ~56px tall. Long answers are split into overlapping
    384px windows so TrOCR does not squash a whole sentence into 18px.
    """
    rgb = line_img.convert("RGB")
    w, h = rgb.size
    if w == 0 or h == 0:
        return [Image.new("RGB", (target, target), (255, 255, 255))]
    target_h = 56
    scale = target_h / max(h, 1)
    rw, rh = max(1, int(w * scale)), target_h
    resized = rgb.resize((rw, rh), Image.BICUBIC)
    if rw <= target:
        return [_fit_on_canvas(resized, target)]
    windows = []
    overlap = 64
    x = 0
    while x < rw:
        part = resized.crop((x, 0, min(x + target, rw), rh))
        windows.append(_fit_on_canvas(part, target))
        if x + target >= rw:
            break
        x += target - overlap
    return windows


def _pad_for_trocr(line_img: Image.Image, target: int = _TROCR_IMG_SIZE) -> Image.Image:
    return _trocr_windows(line_img, target)[0]


MAX_NEW_TOKENS = int(os.getenv("OCR_MAX_NEW_TOKENS", "48"))
DEFAULT_BATCH_SIZE = int(os.getenv("OCR_BATCH_SIZE", "8"))


def run_ocr_batches(
    processor: TrOCRProcessor,
    model: VisionEncoderDecoderModel,
    device: torch.device,
    crops: List[Image.Image],
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> List[str]:
    """Window long lines, pad to 384×384, then TrOCR-decode in batches."""
    groups = [_trocr_windows(img.convert("RGB")) for img in crops]
    flat = [window for group in groups for window in group]
    flat_texts: List[str] = []
    for batch_start in range(0, len(flat), batch_size):
        batch = flat[batch_start: batch_start + batch_size]
        pixel_values = processor(
            images=batch,
            return_tensors="pt",
        ).pixel_values.to(device)

        with torch.inference_mode():
            generated_ids = model.generate(
                pixel_values,
                max_new_tokens=MAX_NEW_TOKENS,
                num_beams=3,
                do_sample=False,
                use_cache=True,
            )

        flat_texts.extend(
            t.strip() for t in processor.batch_decode(generated_ids, skip_special_tokens=True)
        )

    texts: List[str] = []
    cursor = 0
    for group in groups:
        parts = [flat_texts[cursor + i] for i in range(len(group))]
        cursor += len(group)
        kept = [p for p in parts if p and not is_hallucinated_ocr(p)]
        texts.append(" ".join(kept))
    return texts


def ocr_line(
    processor: TrOCRProcessor,
    model: VisionEncoderDecoderModel,
    device: torch.device,
    line_img: Image.Image,
) -> Tuple[str, float]:
    """
    Run TrOCR inference on a single-line PIL image.

    Returns:
        (recognised_text, mean_token_confidence_0_to_1)

    Confidence is computed as the mean of per-token softmax-argmax
    probabilities — a fast approximation of token-level certainty.
    """
    pixel_values = processor(
        images=_pad_for_trocr(line_img.convert("RGB")),
        return_tensors="pt",
    ).pixel_values.to(device)

    with torch.inference_mode():
        outputs = model.generate(
            pixel_values,
            max_new_tokens=MAX_NEW_TOKENS,
            num_beams=3,
            do_sample=False,
            use_cache=True,
            return_dict_in_generate=True,
            output_scores=True,
        )

    text = processor.batch_decode(
        outputs.sequences, skip_special_tokens=True
    )[0].strip()

    # Compute confidence from per-step logit distributions
    conf = 0.0
    if outputs.scores:
        token_confs = [
            float(torch.softmax(step_logits[0], dim=-1).max().item())
            for step_logits in outputs.scores
        ]
        conf = sum(token_confs) / len(token_confs)

    return text, conf


# ===========================================================================

def run_pipeline(
    image_path: str,
    out_dir: str,
    debug: bool = False,
    cleanup: bool = False,
    output_txt: str = "",
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> str:
    """
    Full end-to-end pipeline on a single image or a multi-page PDF.

    Steps:
      1. Load input — PDF pages are rasterised to BGR images at 300 DPI;
         image files are loaded directly with OpenCV.
      2. For each page: preprocess (deskew, denoise, binarise) then segment
         into line crops.
      3. Batch OCR all line crops with TrOCR.
      4. Reassemble text in reading order; multi-page PDFs get [Page N] headers.
      5. Optionally save text to .txt and delete intermediate crops.

    Args:
        image_path  : path to a JPG/PNG/PDF file
        out_dir     : base output directory (crops -> <out_dir>/lines/)
        debug       : save preprocessing debug images
        cleanup     : delete the lines/ folder after OCR finishes
        output_txt  : if non-empty, write extracted text to this .txt path
        batch_size  : images per TrOCR forward pass

    Returns the extracted text as a string.
    """
    lines_dir = Path(out_dir) / "lines"
    lines_dir.mkdir(parents=True, exist_ok=True)

    # --- Load: one entry per page (PDF) or one entry for a plain image --------
    pages = _load_input_as_pages(image_path)
    is_pdf = Path(image_path).suffix.lower() == ".pdf"

    all_crop_images: List[Optional[Image.Image]] = []
    page_break_indices: List[int] = []
    page_labels: List[str] = []
    page_prefixes: List[str] = []

    for page_num, img_bgr in enumerate(pages, start=1):
        log.info(
            "--- Page %d / %d  (%dx%d px) ---",
            page_num, len(pages), img_bgr.shape[1], img_bgr.shape[0],
        )

        img_bgr, binary_inv = preprocess(img_bgr)

        if debug:
            debug_dir = Path(out_dir) / "debug"
            debug_dir.mkdir(parents=True, exist_ok=True)
            tag = f"p{page_num:02d}_"
            cv2.imwrite(str(debug_dir / f"{tag}page.png"), img_bgr)
            cv2.imwrite(str(debug_dir / f"{tag}binary_inv.png"), binary_inv)
            log.info("Debug images saved to: %s", debug_dir)

        # Segment
        log.info("Segmenting lines...")
        line_crops = segment_lines(img_bgr, binary_inv)
        log.info("Found %d line(s) on page %d.", len(line_crops), page_num)

        if not line_crops:
            log.warning(
                "No lines detected on page %d. Tips:\n"
                "  - Check image contrast (--debug saves binary_inv.png).\n"
                "  - Lower MIN_LINE_H / MIN_LINE_W or increase DILATION_ITERS.",
                page_num,
            )
            continue

        # Record the start index of this page's crops
        page_break_indices.append(len(all_crop_images))

        for i, item in enumerate(line_crops, start=1):
            crop_pil, _bbox, prefix = item if len(item) == 3 else (*item, "")
            if crop_pil is not None:
                crop_pil.save(str(lines_dir / f"p{page_num:02d}_line_{i:03d}.png"))
            all_crop_images.append(crop_pil)
            page_labels.append(f"Page {page_num}")
            page_prefixes.append(prefix)

    if not any(img is not None for img in all_crop_images) and not any(page_prefixes):
        log.warning("No lines detected in any page. Returning empty text.")
        return ""

    ocr_images = [img for img in all_crop_images if img is not None]
    log.info(
        "Total line crops across all pages: %d (%d to OCR)  |  Batch size: %d",
        len(all_crop_images), len(ocr_images), batch_size,
    )

    processor, model, device = load_trocr()
    ocr_texts = run_ocr_batches(processor, model, device, ocr_images, batch_size) if ocr_images else []
    ocr_iter = iter(ocr_texts)
    all_texts = []
    for crop_pil, prefix in zip(all_crop_images, page_prefixes):
        raw = next(ocr_iter) if crop_pil is not None else ""
        if raw and is_hallucinated_ocr(raw):
            raw = ""
        all_texts.append(f"{prefix} {raw}".strip() if prefix else raw)

    for line_num, text in enumerate(all_texts, start=1):
        label = page_labels[line_num - 1]
        if text:
            log.info("    [%s] line_%03d -> %r", label, line_num, text)
        else:
            log.info("    [%s] line_%03d -> (blank)", label, line_num)

    # --- Reassemble text -------------------------------------------------------
    # For single-image input: just join non-blank lines.
    # For PDF: insert a [Page N] header at the start of each page's lines.
    result_lines: List[str] = []
    current_page = None

    for idx, text in enumerate(all_texts):
        label = page_labels[idx]
        if is_pdf and label != current_page:
            current_page = label
            result_lines.append(f"\n[{label}]")
        if text and not is_hallucinated_ocr(text):
            result_lines.append(text)

    full_text = "\n".join(result_lines).strip()

    # --- Save .txt -------------------------------------------------------------
    if output_txt:
        out_path = Path(output_txt)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(full_text, encoding="utf-8")
        log.info("Text saved to: %s", output_txt)

    # --- Cleanup intermediate crops --------------------------------------------
    if cleanup:
        shutil.rmtree(str(lines_dir), ignore_errors=True)
        log.info("Line crops deleted (--cleanup).")

    return full_text


# ===========================================================================
# Entry point
# ===========================================================================

def main() -> None:
    parser = argparse.ArgumentParser(
        description="VisionGrade Module 2 — Extract handwritten text from a single image.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "image",
        help="Path to a JPG, PNG, or PDF file of a handwritten answer sheet. "
             "PDFs are rasterised page-by-page at 300 DPI before processing.",
    )
    parser.add_argument(
        "--out",
        default="output",
        help="Base output directory (default: output/). "
             "Line crops go to <out>/lines/, debug images to <out>/debug/.",
    )
    parser.add_argument(
        "--output",
        default="",
        help="Save extracted text to this .txt file (e.g. --output result.txt). "
             "If not set, text is only printed to console.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Save preprocessing debug images (gray_clean.png, binary_inv.png).",
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Delete the intermediate line-crop images after OCR finishes. "
             "Use this when you only need the final text and don't want leftover files.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        dest="batch_size",
        help="Number of line images per TrOCR forward pass (default: 8).",
    )
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        sys.exit(f"[ERROR] File not found: {args.image}")

    t_start = time.time()
    extracted_text = run_pipeline(
        args.image,
        args.out,
        debug=args.debug,
        cleanup=args.cleanup,
        output_txt=args.output,
        batch_size=args.batch_size,
    )
    elapsed = time.time() - t_start

    sep = "=" * 60
    print(f"\n{sep}")
    print("EXTRACTED TEXT")
    print(sep)
    print(extracted_text if extracted_text else "(no text extracted)")
    print(sep)
    print(f"\nFinished in {elapsed:.1f}s.")
    if args.output:
        print(f"Text saved to: {args.output}")
    if not args.cleanup:
        print(f"Line crops:    {Path(args.out) / 'lines'}  (pass --cleanup to delete)")


if __name__ == "__main__":
    main()
