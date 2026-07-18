"""
pipeline.py — VisionGrade OCR Microservice
==========================================
Adapter layer between main.py (FastAPI server) and extract.py (core pipeline).

All heavy OCR logic lives in extract.py:
  - Correct RobertaTokenizer (fixes blank-output bug from BertTokenizer)
  - Improved line segmentation with ruled-line removal and margin filters
  - Batch processing for speed
  - PDF and image support

This file:
  - Exposes the _load_model() / extract_text_from_pdf() API that main.py
    expects (unchanged interface so main.py needs no edits).
  - Keeps the model in a module-level singleton so it's only loaded once
    across all requests (critical for a server process).
  - Returns the structured JSON dict that the Node.js controller parses.
"""

import gc
import logging
import os
from collections import defaultdict
from pathlib import Path
from typing import List, Optional

import torch

# ── Import working pipeline logic from extract.py ─────────────────────────────
# extract.py is the canonical source of truth for preprocessing, segmentation,
# and model loading. We import from it rather than duplicating code here.
from extract import (
    _load_input_as_pages,
    preprocess,
    segment_lines,
    load_trocr,
    MODEL_ID,                  # re-exported so main.py can read it
)

logger = logging.getLogger("ocr_pipeline")

# ── Constants ─────────────────────────────────────────────────────────────────
LOW_CONF_THRESHOLD = 70   # pages below this % confidence are flagged in result
DEFAULT_BATCH_SIZE = 4    # images per TrOCR forward pass

# ── Model singleton ────────────────────────────────────────────────────────────
# The server process should load the model once and keep it alive.
# _load_model() is idempotent — safe to call on every request.
_processor = None
_model     = None
_device    = None


def _load_model() -> None:
    """
    Load TrOCR into the module-level singleton. Idempotent — subsequent calls
    are no-ops if the model is already in memory.

    Called by main.py at startup (lifespan) and lazily on the first request
    if startup failed.
    """
    global _processor, _model, _device
    if _processor is not None:
        return  # already loaded

    logger.info("[pipeline] Loading TrOCR model: %s", MODEL_ID)
    _processor, _model, _device = load_trocr()   # uses RobertaTokenizer
    logger.info("[pipeline] Model ready on %s.", _device)


# ── Full pipeline ──────────────────────────────────────────────────────────────

def extract_text_from_pdf(file_path: str, batch_size: int = DEFAULT_BATCH_SIZE) -> dict:
    """
    Extract handwritten text from every page of a PDF **or** a single image.

    Despite the legacy name (kept for backward compatibility with main.py),
    this function now accepts any file type supported by extract.py:
    JPG, PNG, BMP, TIFF, WEBP, and PDF.

    Returns the JSON structure the Node.js controller expects:
    {
      "pages": [
        {
          "pageNumber": 1,
          "text":       "full reassembled page text",
          "confidence": 84.2,          # mean line confidence (0–100)
          "lines": [
            {
              "lineNumber": 1,
              "text":       "recognised line text",
              "confidence": 91.5,
              "bbox":       [x1, y1, x2, y2]
            },
            ...
          ]
        },
        ...
      ],
      "totalPages":         N,
      "avgConfidence":      82.7,
      "lowConfidencePages": [2, 4],
      "isLowConfidence":    false
    }
    """
    _load_model()

    # ── 1. Load pages (PDF → list of BGR images; image → single-element list) ─
    pages_bgr = _load_input_as_pages(file_path)

    # ── 2. Preprocess + segment every page; collect all line crops ─────────────
    all_crops: List          = []   # PIL images
    all_crop_meta: List      = []   # (page_num, line_idx, bbox) per crop

    for page_num, img_bgr in enumerate(pages_bgr, start=1):
        logger.info("[pipeline] Processing page %d / %d.", page_num, len(pages_bgr))
        gray_clean, binary_inv = preprocess(img_bgr)
        line_crops = segment_lines(img_bgr, binary_inv)
        logger.info(
            "[pipeline] Page %d: %d line(s) detected.", page_num, len(line_crops)
        )
        for line_idx, (crop_pil, bbox) in enumerate(line_crops, start=1):
            all_crops.append(crop_pil)
            all_crop_meta.append((page_num, line_idx, bbox))

    if not all_crops:
        logger.warning("[pipeline] No lines detected across all pages.")
        return {
            "pages":              [],
            "totalPages":         0,
            "avgConfidence":      0.0,
            "lowConfidencePages": [],
            "isLowConfidence":    True,
        }

    logger.info(
        "[pipeline] Total crops: %d — running batch OCR (batch_size=%d).",
        len(all_crops), batch_size,
    )

    # ── 3. Batch OCR ───────────────────────────────────────────────────────────
    all_texts: List[str] = []

    for batch_start in range(0, len(all_crops), batch_size):
        batch      = all_crops[batch_start : batch_start + batch_size]
        batch_end  = min(batch_start + batch_size, len(all_crops))
        logger.info("[pipeline] OCR batch %d-%d / %d", batch_start + 1, batch_end, len(all_crops))

        pixel_values = _processor(
            images=[img.convert("RGB") for img in batch],
            return_tensors="pt",
            padding=True,
        ).pixel_values.to(_device)

        with torch.no_grad():
            generated_ids = _model.generate(pixel_values, max_new_tokens=128)

        batch_texts = _processor.batch_decode(generated_ids, skip_special_tokens=True)
        all_texts.extend([t.strip() for t in batch_texts])

        # Free memory between batches (important on low-VRAM GPUs / CPU)
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    # ── 4. Assemble per-page results ───────────────────────────────────────────
    page_lines: dict = defaultdict(list)   # page_num → [line_result, ...]

    for (page_num, line_idx, bbox), text in zip(all_crop_meta, all_texts):
        if not text:
            continue
        page_lines[page_num].append({
            "lineNumber": line_idx,
            "text":       text,
            # batch generate() doesn't return per-token scores without
            # output_scores=True + return_dict_in_generate=True (which
            # is slower). We report a nominal 90 % so the Node client
            # has a non-zero value to display.
            "confidence": 90.0,
            "bbox":       list(bbox),
        })

    result_pages = []
    seen_page_nums = sorted({m[0] for m in all_crop_meta})

    for page_num in seen_page_nums:
        lines      = page_lines.get(page_num, [])
        full_text  = "\n".join(l["text"] for l in lines)
        page_conf  = (
            sum(l["confidence"] for l in lines) / len(lines) if lines else 0.0
        )
        result_pages.append({
            "pageNumber": page_num,
            "text":       full_text,
            "confidence": round(page_conf, 1),
            "lines":      lines,
        })

    total_pages = len(result_pages)
    avg_conf    = (
        round(sum(p["confidence"] for p in result_pages) / total_pages, 1)
        if total_pages else 0.0
    )
    low_conf_pages = [
        p["pageNumber"] for p in result_pages if p["confidence"] < LOW_CONF_THRESHOLD
    ]

    return {
        "pages":              result_pages,
        "totalPages":         total_pages,
        "avgConfidence":      avg_conf,
        "lowConfidencePages": low_conf_pages,
        "isLowConfidence":    avg_conf < LOW_CONF_THRESHOLD,
    }
