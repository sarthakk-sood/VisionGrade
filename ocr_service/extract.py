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
import shutil
import sys
import time
from pathlib import Path
from typing import List, Tuple

import cv2
import numpy as np
from PIL import Image
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


# ---------------------------------------------------------------------------
# PDF -> image conversion
# ---------------------------------------------------------------------------

def _load_input_as_pages(path: str, dpi: int = 300) -> List[np.ndarray]:
    """
    Return a list of OpenCV BGR images, one per page.

    - For PDF inputs   : rasterise every page at `dpi` DPI using pdf2image.
    - For image inputs : return a single-element list with the cv2.imread result.

    Raises SystemExit if the file cannot be read.
    """
    ext = Path(path).suffix.lower()

    if ext == ".pdf":
        try:
            from pdf2image import convert_from_path
        except ImportError:
            raise RuntimeError(
                "[ERROR] pdf2image is not installed.\n"
                "        Run: pip install pdf2image\n"
                "        You also need poppler on PATH — see:\n"
                "        https://pdf2image.readthedocs.io/en/latest/installation.html"
            )

        log.info("PDF detected — rasterising pages at %d DPI ...", dpi)
        try:
            pil_pages = convert_from_path(path, dpi=dpi)
        except Exception as exc:
            raise RuntimeError(f"[ERROR] Could not rasterise PDF: {exc}")

        if not pil_pages:
            raise RuntimeError("[ERROR] PDF produced no pages.")

        log.info("PDF has %d page(s).", len(pil_pages))
        pages = []
        for pil_img in pil_pages:
            # pdf2image returns RGB PIL images; convert to BGR ndarray for OpenCV
            pages.append(cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR))
        return pages

    else:
        img = cv2.imread(path)
        if img is None:
            raise RuntimeError(f"[ERROR] Could not read image: {path}")
        return [img]

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

# ---------------------------------------------------------------------------
# Segmentation tuning knobs
# ---------------------------------------------------------------------------
# Increase HORIZ_KERNEL_W if characters in one line are NOT merging together.
# Decrease it if adjacent lines are merging into a single strip.
HORIZ_KERNEL_W  = 80   # width of horizontal dilation kernel (pixels)
HORIZ_KERNEL_H  = 2    # height of dilation kernel
DILATION_ITERS  = 2    # number of dilation passes
MIN_LINE_H      = 25    # minimum blob height (px); raised to skip thin printed rules
MIN_LINE_W      = 60    # minimum blob width  (px)
LINE_PADDING    = 6     # extra pixels to pad around each line crop
MAX_ASPECT      = 30    # blobs wider than this ratio (w/h) are ruled lines — skip
MAX_LINE_H_RATIO = 0.05 # max blob height as fraction of image height (~200px on a 4K photo)
                         # blobs taller than this are multi-line merged regions — skip
MARGIN_FRAC     = 0.15  # ignore blobs entirely within the outermost 15% of width
                         # (right edge = scoring grid; left edge = question-number labels)
MIN_CONFIDENCE  = 0.25  # drop OCR results below this confidence (0-1); reduces garbage


# ===========================================================================
# Step 1: Preprocessing
# ===========================================================================

def _deskew(gray: np.ndarray) -> np.ndarray:
    """
    Detect and correct page skew using the Hough-line method.

    Only considers lines that are nearly horizontal (within +-10 deg of
    horizontal) so that diagonal UI borders, signatures, or underlines
    cannot corrupt the estimated skew angle.

    Only corrects angles up to +-5 deg — typical scanner/camera skew.
    Larger detected angles mean the input is not a document page and deskew
    is skipped entirely.
    """
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    lines = cv2.HoughLinesP(
        binary, 1, np.pi / 180,
        threshold=100,
        minLineLength=gray.shape[1] // 4,
        maxLineGap=20,
    )
    if lines is None:
        return gray

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line.flatten()  # works for both (N,1,4) and (N,4) shapes
        if x2 == x1:
            continue
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        # Only keep near-horizontal lines — discard diagonals / verticals
        if abs(angle) <= 10:
            angles.append(angle)

    if not angles:
        log.info("Deskew: no near-horizontal lines found — skipping.")
        return gray

    median_angle = float(np.median(angles))

    # Only correct genuine small document skew; bigger values = not a flat doc
    if abs(median_angle) > 5:
        log.info(
            "Deskew: median angle %.1f deg exceeds 5 deg threshold — skipping "
            "(image may not be a flat document page).",
            median_angle,
        )
        return gray

    if abs(median_angle) < 0.1:
        return gray  # negligible — skip the warp

    log.info("Deskewing by %.2f deg", median_angle)
    h, w = gray.shape
    centre = (w / 2.0, h / 2.0)
    M = cv2.getRotationMatrix2D(centre, median_angle, 1.0)
    return cv2.warpAffine(
        gray, M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def preprocess(img_bgr: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """
    Full preprocessing pipeline: deskew -> denoise -> binarise.

    Returns:
        gray_clean  : clean grayscale image (used to crop original pixels later)
        binary_inv  : binarised image, ink=white / background=black
                      (used only for contour detection — NOT fed to TrOCR)
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # 1. Deskew
    gray = _deskew(gray)

    # 2. Gentle blur to reduce paper texture / sensor noise, then bilateral
    #    filter which blurs uniform regions but preserves ink edges.
    blurred  = cv2.GaussianBlur(gray, (3, 3), 0)
    denoised = cv2.bilateralFilter(blurred, d=9, sigmaColor=75, sigmaSpace=75)

    # 3. Adaptive threshold handles uneven lighting (common in phone photos)
    #    better than global Otsu on non-flat, non-uniform illumination.
    binary_inv = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=31,   # neighbourhood size; larger = more tolerant of gradients
        C=15,           # constant subtracted from the local mean
    )

    return denoised, binary_inv


# ===========================================================================
# Step 2: Line segmentation
# ===========================================================================

def segment_lines(
    img_bgr: np.ndarray,
    binary_inv: np.ndarray,
) -> List[Tuple[Image.Image, Tuple[int, int, int, int]]]:
    """
    Split the page into individual horizontal text-line strips.

    Algorithm:
      1. Detect and subtract printed horizontal ruled lines using morphological
         opening with a long horizontal kernel — these are very thin and span
         most of the page width; handwriting strokes are much shorter.
      2. Dilate the cleaned binary image so characters on the same line fuse.
      3. Find external contours — each blob = one text line region.
      4. Filter tiny blobs and near-horizontal ruled-line survivors via a
         maximum aspect ratio guard.
      5. Sort top-to-bottom and crop from the ORIGINAL colour image.

    Returns:
        List of (PIL_RGB_crop, (x1, y1, x2, y2)) sorted top-to-bottom.
    """
    img_h, img_w = img_bgr.shape[:2]

    # --- Step 1: Remove printed horizontal ruling lines ----------------------
    # A ruling line is a very long, single-pixel-tall stroke.  A kernel that
    # is 1/4 of the image width will only match strokes that span at least
    # that much of the page — longer than any single handwritten character.
    rule_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (img_w // 4, 1)
    )
    horiz_rules = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, rule_kernel)
    # Dilate the detected rules slightly so they cover the full drawn stroke
    rule_dilate = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 3))
    horiz_rules = cv2.dilate(horiz_rules, rule_dilate, iterations=1)
    # Subtract rules from the binary image so they don't form their own blobs
    binary_clean = cv2.subtract(binary_inv, horiz_rules)

    # --- Step 2: Dilate horizontally to merge chars within a line ------------
    h_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (HORIZ_KERNEL_W, HORIZ_KERNEL_H)
    )
    dilated = cv2.dilate(binary_clean, h_kernel, iterations=DILATION_ITERS)

    # --- Step 3: Find contours -----------------------------------------------
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    bboxes = [cv2.boundingRect(c) for c in contours]

    # --- Step 4: Filter ----------------------------------------------------------
    max_h   = int(img_h * MAX_LINE_H_RATIO)   # e.g. 201 px on a 4032-px-tall photo
    left_lim  = int(img_w * MARGIN_FRAC)      # e.g. 454 px
    right_lim = int(img_w * (1 - MARGIN_FRAC)) # e.g. 2570 px

    filtered = []
    for (x, y, w, h) in bboxes:
        # Too small (noise) or too thin (printed rule)
        if w < MIN_LINE_W or h < MIN_LINE_H:
            continue
        # Extreme aspect ratio -> surviving ruled line / underline
        if h > 0 and (w / h) > MAX_ASPECT:
            continue
        # Too tall -> multiple lines merged into one blob
        if h > max_h:
            continue
        # Entirely inside left margin -> question number / bullet label
        if (x + w) <= left_lim:
            continue
        # Entirely inside right margin -> scoring grid / mark column
        if x >= right_lim:
            continue
        filtered.append((x, y, w, h))

    # --- Step 5: Sort top-to-bottom ------------------------------------------
    filtered.sort(key=lambda b: (b[1], b[0]))

    crops = []
    for (x, y, w, h) in filtered:
        x1 = max(0, x - LINE_PADDING)
        y1 = max(0, y - LINE_PADDING)
        x2 = min(img_w, x + w + LINE_PADDING)
        y2 = min(img_h, y + h + LINE_PADDING)

        crop_bgr = img_bgr[y1:y2, x1:x2]
        crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
        crops.append((Image.fromarray(crop_rgb), (x1, y1, x2, y2)))

    return crops


# ===========================================================================
# Step 3: TrOCR inference
# ===========================================================================

def load_trocr() -> Tuple[TrOCRProcessor, VisionEncoderDecoderModel, torch.device]:
    """
    Load microsoft/trocr-base-handwritten.
    Downloads on first run; uses local cache thereafter.

    Tokenizer note: TrOCR's decoder uses a RoBERTa vocabulary (50 265 tokens).
    Using BertTokenizer (30 522 tokens) causes generated token IDs to decode
    as empty strings because all RoBERTa token IDs fall in BERT's special-
    token range and are stripped by skip_special_tokens=True.
    Fix: AutoTokenizer with use_fast=False loads the slow (pure-Python)
    RobertaTokenizer, which works on Python 3.13 without the Rust fast
    tokenizer build step.

    Returns (processor, model, device).
    """
    log.info("Loading TrOCR model: %s", MODEL_ID)
    t0 = time.time()

    from transformers import ViTImageProcessor, RobertaTokenizer
    img_proc  = ViTImageProcessor.from_pretrained(MODEL_ID)
    # RobertaTokenizer = slow pure-Python BPE tokenizer (vocab.json + merges.txt).
    # TrOCR's decoder uses RoBERTa vocabulary (50 265 tokens), NOT BERT (30 522).
    # Using BertTokenizer caused all-blank output because generated RoBERTa token
    # IDs were decoded as BERT special tokens and stripped by skip_special_tokens.
    # RobertaTokenizer has no Rust/PyO3 dependency and works on Python 3.13.
    tokenizer = RobertaTokenizer.from_pretrained(MODEL_ID)
    processor = TrOCRProcessor(image_processor=img_proc, tokenizer=tokenizer)

    model = VisionEncoderDecoderModel.from_pretrained(MODEL_ID)
    model.eval()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

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


def _pad_for_trocr(line_img: Image.Image, target: int = _TROCR_IMG_SIZE) -> Image.Image:
    """
    Scale a line crop to fit inside a (target x target) white canvas,
    preserving the aspect ratio.

    Example: a 1300x60 strip is scaled to 384x18 and placed on a 384x384
    white background.  ViTImageProcessor then resizes 384x384 -> 384x384
    (identity), so the text stays readable.
    """
    w, h = line_img.size
    if w == 0 or h == 0:
        return Image.new("RGB", (target, target), (255, 255, 255))

    scale = min(target / w, target / h)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))

    resized = line_img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGB", (target, target), (255, 255, 255))
    canvas.paste(resized, (0, 0))   # top-left; TrOCR reads L->R, T->B
    return canvas


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
    # ViTImageProcessor resizes to 384x384 — TrOCR was trained with images
    # squashed to this size, so passing the line crop directly is correct.
    pixel_values = processor(
        images=line_img.convert("RGB"),
        return_tensors="pt",
    ).pixel_values.to(device)

    with torch.no_grad():
        outputs = model.generate(
            pixel_values,
            max_new_tokens=128,
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
    batch_size: int = 4,
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

    all_crop_images: List[Image.Image] = []   # all line crops across all pages
    page_break_indices: List[int] = []        # crop index where each new page starts
    page_labels: List[str] = []               # [Page N] label for each crop

    for page_num, img_bgr in enumerate(pages, start=1):
        log.info(
            "--- Page %d / %d  (%dx%d px) ---",
            page_num, len(pages), img_bgr.shape[1], img_bgr.shape[0],
        )

        # Preprocess
        log.info("Preprocessing (deskew, denoise, binarise)...")
        gray_clean, binary_inv = preprocess(img_bgr)

        if debug:
            debug_dir = Path(out_dir) / "debug"
            debug_dir.mkdir(parents=True, exist_ok=True)
            tag = f"p{page_num:02d}_"
            cv2.imwrite(str(debug_dir / f"{tag}gray_clean.png"), gray_clean)
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

        for i, (crop_pil, _bbox) in enumerate(line_crops, start=1):
            global_idx = len(all_crop_images) + 1
            crop_pil.save(str(lines_dir / f"p{page_num:02d}_line_{i:03d}.png"))
            all_crop_images.append(crop_pil)
            page_labels.append(f"Page {page_num}")

    if not all_crop_images:
        log.warning("No lines detected in any page. Returning empty text.")
        return ""

    log.info(
        "Total line crops across all pages: %d  |  Batch size: %d",
        len(all_crop_images), batch_size,
    )

    # --- Load model once for all pages ----------------------------------------
    processor, model, device = load_trocr()

    # --- Batch OCR all crops ---------------------------------------------------
    all_texts: List[str] = []   # one entry per crop, empty string = blank

    for batch_start in range(0, len(all_crop_images), batch_size):
        batch_imgs = all_crop_images[batch_start : batch_start + batch_size]
        batch_end  = min(batch_start + batch_size, len(all_crop_images))
        log.info("  Batch %d-%d / %d ...", batch_start + 1, batch_end, len(all_crop_images))

        pixel_values = processor(
            images=[img.convert("RGB") for img in batch_imgs],
            return_tensors="pt",
            padding=True,
        ).pixel_values.to(device)

        with torch.no_grad():
            generated_ids = model.generate(pixel_values, max_new_tokens=128)

        batch_texts = processor.batch_decode(generated_ids, skip_special_tokens=True)

        for j, text in enumerate(batch_texts):
            text = text.strip()
            line_num = batch_start + j + 1
            label = page_labels[batch_start + j]
            if text:
                log.info("    [%s] line_%03d -> %r", label, line_num, text)
            else:
                log.info("    [%s] line_%03d -> (blank)", label, line_num)
            all_texts.append(text)

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
        if text:
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
        default=4,
        dest="batch_size",
        help="Number of line images per TrOCR forward pass (default: 4). "
             "Reduce to 1-2 if you run out of memory on CPU.",
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
