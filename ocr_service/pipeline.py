"""
pipeline.py — VisionGrade OCR Microservice
==========================================
Adapter between main.py and extract.py. Keeps the TrOCR model in a singleton.
"""

import logging
import time
from collections import defaultdict
from typing import List

from extract import (
    _load_input_as_pages,
    preprocess,
    segment_lines,
    load_trocr,
    run_ocr_batches,
    is_hallucinated_ocr,
    DEFAULT_BATCH_SIZE,
    MODEL_ID,
)

logger = logging.getLogger("ocr_pipeline")


def _heuristic_confidence(text: str) -> float:
    t = (text or "").strip()
    if not t:
        return 0.0
    if len(t) <= 2:
        return 45.0
    alnum = sum(ch.isalnum() for ch in t)
    ratio = alnum / max(len(t), 1)
    if ratio < 0.25:
        return 48.0
    if ratio < 0.45:
        return 62.0
    return 84.0


LOW_CONF_THRESHOLD = 70

_processor = None
_model = None
_device = None


def _load_model() -> None:
    global _processor, _model, _device
    if _processor is not None:
        return
    logger.info("[pipeline] Loading TrOCR model: %s", MODEL_ID)
    _processor, _model, _device = load_trocr()
    logger.info("[pipeline] Model ready on %s.", _device)


def extract_text_from_pdf(
    file_path: str,
    batch_size: int = DEFAULT_BATCH_SIZE,
    question_count: int = 0,
) -> dict:
    _load_model()
    t0 = time.time()

    pages_bgr = _load_input_as_pages(file_path)

    all_crops: List = []
    all_crop_meta: List = []

    for page_num, img_bgr in enumerate(pages_bgr, start=1):
        logger.info("[pipeline] Processing page %d / %d (%dx%d).",
                    page_num, len(pages_bgr), img_bgr.shape[1], img_bgr.shape[0])
        deskewed_bgr, binary_inv = preprocess(img_bgr)
        line_crops = segment_lines(deskewed_bgr, binary_inv, question_count=question_count)
        logger.info("[pipeline] Page %d: %d line(s) detected.", page_num, len(line_crops))
        for line_idx, item in enumerate(line_crops, start=1):
            crop_pil, bbox, prefix = item if len(item) == 3 else (*item, "")
            all_crops.append(crop_pil)
            all_crop_meta.append((page_num, line_idx, bbox, prefix))

    if not all_crop_meta:
        logger.warning("[pipeline] No lines detected across all pages.")
        return {
            "pages": [],
            "totalPages": len(pages_bgr),
            "avgConfidence": 0.0,
            "lowConfidencePages": list(range(1, len(pages_bgr) + 1)),
            "isLowConfidence": True,
        }

    ocr_images = [img for img in all_crops if img is not None]
    logger.info("[pipeline] Total crops: %d (%d to OCR) — batch_size=%d.",
                len(all_crop_meta), len(ocr_images), batch_size)
    ocr_texts = run_ocr_batches(_processor, _model, _device, ocr_images, batch_size) if ocr_images else []
    ocr_iter = iter(ocr_texts)

    page_lines: dict = defaultdict(list)
    for (page_num, line_idx, bbox, prefix), crop_pil in zip(all_crop_meta, all_crops):
        raw = next(ocr_iter) if crop_pil is not None else ""
        if raw and is_hallucinated_ocr(raw):
            logger.info("[pipeline] Dropping hallucinated line %d: %r", line_idx, raw[:80])
            raw = ""
        text = f"{prefix} {raw}".strip() if prefix else raw
        if not text:
            continue
        page_lines[page_num].append({
            "lineNumber": line_idx,
            "text": text,
            "confidence": 95.0 if crop_pil is None else _heuristic_confidence(raw),
            "bbox": list(bbox),
        })

    result_pages = []
    for page_num in range(1, len(pages_bgr) + 1):
        lines = page_lines.get(page_num, [])
        full_text = "\n".join(l["text"] for l in lines)
        page_conf = (sum(l["confidence"] for l in lines) / len(lines)) if lines else 0.0
        result_pages.append({
            "pageNumber": page_num,
            "text": full_text,
            "confidence": round(page_conf, 1),
            "lines": lines,
        })

    total_pages = len(result_pages)
    avg_conf = (
        round(sum(p["confidence"] for p in result_pages) / total_pages, 1)
        if total_pages else 0.0
    )
    low_conf_pages = [
        p["pageNumber"] for p in result_pages if p["confidence"] < LOW_CONF_THRESHOLD
    ]

    logger.info("[pipeline] Done in %.1fs — %d page(s), %d lines, avg conf %.1f%%.",
                time.time() - t0, total_pages, len(all_crops), avg_conf)

    return {
        "pages": result_pages,
        "totalPages": total_pages,
        "avgConfidence": avg_conf,
        "lowConfidencePages": low_conf_pages,
        "isLowConfidence": avg_conf < LOW_CONF_THRESHOLD,
    }
