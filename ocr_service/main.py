"""
main.py — VisionGrade OCR Microservice
FastAPI HTTP server that wraps the TrOCR pipeline.

Endpoints:
  GET  /health              — liveness check; confirms the model is loaded
  POST /extract             — accept a PDF or image, enqueue a job, return jobId (non-blocking)
  GET  /jobs/{job_id}       — poll job status; returns result when done
  POST /extract/sync        — DEPRECATED synchronous path (kept for local testing only)

Architecture:
  TrOCR on CPU can take 5–30 minutes for a multi-page PDF. The old synchronous
  design caused the Node.js axios client to time out after 10 minutes.

  The new design:
    1. POST /extract  → writes file to disk, enqueues background thread, returns
                        { jobId, status: "queued" } immediately (< 200 ms)
    2. GET  /jobs/{id} → Node backend polls every 5 s; when status == "done"
                         the full result is returned.  When status == "error"
                         an error message is returned.

Accepted file types: PDF, JPEG, PNG, TIFF, BMP, WEBP.
Called exclusively by the Node/Express backend.
Not exposed to the browser directly.
"""

import os
import uuid
import shutil
import logging
import tempfile
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
import uvicorn

from pipeline import extract_text_from_pdf, _load_model, MODEL_ID

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger("ocr_service")


# ── In-memory job store ────────────────────────────────────────────────────────
# { job_id: { status, result, error, tmp_dir } }
# status: "queued" | "processing" | "done" | "error"
#
# NOTE: This is a simple in-memory store. Jobs are lost on restart.
# For production, use Redis or a DB. For our capstone workload (1–2 concurrent
# users) this is perfectly sufficient.
_jobs: dict = {}
_jobs_lock = threading.Lock()

MAX_PDF_BYTES = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024

# MIME types accepted by the upload endpoints.
# Maps content-type -> file extension used when saving the temp file.
ALLOWED_MIME_TYPES: dict[str, str] = {
    "application/pdf":        ".pdf",
    "application/octet-stream": "",      # infer extension from filename
    "image/jpeg":             ".jpg",
    "image/jpg":              ".jpg",
    "image/png":              ".png",
    "image/tiff":             ".tiff",
    "image/bmp":              ".bmp",
    "image/webp":             ".webp",
}


# ── Lifespan: pre-load model at startup so first request is fast ───────────────
@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Starting up — pre-loading TrOCR model…")
    try:
        _load_model()
        logger.info("Model ready.")
    except Exception as exc:
        logger.error("Model load failed: %s", exc)
        # Don't crash — first request will re-attempt load
    yield
    logger.info("Shutting down OCR microservice.")


app = FastAPI(
    title="VisionGrade OCR Microservice",
    version="2.1.0",
    description=(
        "Extracts handwritten text from answer-sheet PDFs and images using "
        "microsoft/trocr-base-handwritten. "
        "Accepts PDF, JPEG, PNG, TIFF, BMP, and WEBP uploads. "
        "Uses async job pattern to avoid HTTP timeouts on slow CPU inference."
    ),
    lifespan=lifespan,
)


# ── Background worker ──────────────────────────────────────────────────────────

def _run_ocr_job(job_id: str, pdf_path: str, tmp_dir: str, question_count: int = 0) -> None:
    """
    Runs in a background thread. Updates the job store when done.
    Cleans up the temp directory regardless of success/failure.
    """
    with _jobs_lock:
        _jobs[job_id]["status"] = "processing"

    logger.info("[job %s] Starting TrOCR extraction…", job_id)
    try:
        result = extract_text_from_pdf(pdf_path, question_count=question_count)
        with _jobs_lock:
            _jobs[job_id]["status"] = "done"
            _jobs[job_id]["result"] = result
        logger.info(
            "[job %s] Done — %d page(s), avg confidence %.1f%%.",
            job_id, result["totalPages"], result["avgConfidence"],
        )
    except Exception as exc:
        logger.exception("[job %s] OCR failed", job_id)
        with _jobs_lock:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"] = str(exc)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Liveness probe — Node.js backend can poll this before sending PDFs."""
    import torch
    device = "cpu"
    if torch.cuda.is_available():
        device = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    return {
        "status": "ok",
        "model":  MODEL_ID,
        "device": device,
        "jobs":   len(_jobs),
    }


@app.post("/extract")
async def extract(
    file: UploadFile = File(..., alias="pdf"),
    questionCount: Optional[int] = Form(None),
):
    """
    Accept a PDF or image answer sheet, enqueue a background OCR job, and
    return a jobId immediately. The caller must poll GET /jobs/{jobId}.

    Accepted MIME types: application/pdf, image/jpeg, image/png, image/tiff,
                         image/bmp, image/webp, application/octet-stream.

    Response:
      { "jobId": "...", "status": "queued" }
    """
    # -- Validation -------------------------------------------------------------
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{content_type}'. "
                f"Accepted: {', '.join(ALLOWED_MIME_TYPES)}."
            ),
        )

    content = await file.read()
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {MAX_PDF_BYTES // (1024*1024)} MB.",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # -- Determine file extension ----------------------------------------------
    # Prefer extension from the original filename; fall back to MIME type map.
    original_name = file.filename or ""
    ext = Path(original_name).suffix.lower() or ALLOWED_MIME_TYPES.get(content_type, ".bin")
    if not ext:
        ext = ".bin"  # last resort

    # -- Write to temp file ----------------------------------------------------
    tmp_dir   = tempfile.mkdtemp(prefix="vg_ocr_")
    file_path = os.path.join(tmp_dir, f"input{ext}")
    with open(file_path, "wb") as f:
        f.write(content)

    # -- Register job ----------------------------------------------------------
    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {
            "status":  "queued",
            "result":  None,
            "error":   None,
            "tmp_dir": tmp_dir,
        }

    logger.info(
        "[/extract] Queued job %s for '%s' (%s, %.1f KB).",
        job_id, original_name or "unknown", content_type, len(content) / 1024,
    )

    # -- Start background thread -----------------------------------------------
    thread = threading.Thread(
        target=_run_ocr_job,
        args=(job_id, file_path, tmp_dir, int(questionCount or 0)),
        daemon=True,
        name=f"ocr-{job_id[:8]}",
    )
    thread.start()

    return JSONResponse(content={"jobId": job_id, "status": "queued"})


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    """
    Poll the status of an OCR job.

    Response when queued/processing:
      { "jobId": "...", "status": "queued" | "processing" }

    Response when done:
      { "jobId": "...", "status": "done", "result": { pages, totalPages, ... } }

    Response when error:
      { "jobId": "...", "status": "error", "error": "..." }
    """
    with _jobs_lock:
        job = _jobs.get(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    if job["status"] in ("queued", "processing"):
        return JSONResponse(content={"jobId": job_id, "status": job["status"]})

    if job["status"] == "done":
        result = job["result"]
        # Clean up job from store after it's been retrieved (optional)
        # with _jobs_lock:
        #     del _jobs[job_id]
        return JSONResponse(content={"jobId": job_id, "status": "done", "result": result})

    # Always 200 so the Node poller can read status:"error" instead of retrying 422s.
    return JSONResponse(
        content={"jobId": job_id, "status": "error", "error": job["error"]},
    )


@app.post("/extract/sync")
async def extract_sync(
    file: UploadFile = File(..., alias="pdf"),
    questionCount: Optional[int] = Form(None),
):
    """
    DEPRECATED synchronous endpoint kept for local curl/Postman testing.
    DO NOT call this from Node.js — it will block until TrOCR finishes
    (potentially 10+ minutes on CPU) and will time out production clients.

    Accepts the same file types as POST /extract.
    """
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Accepted: {', '.join(ALLOWED_MIME_TYPES)}.",
        )

    content = await file.read()
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="File too large.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    original_name = file.filename or ""
    ext       = Path(original_name).suffix.lower() or ALLOWED_MIME_TYPES.get(content_type, ".bin")
    tmp_dir   = tempfile.mkdtemp(prefix="vg_ocr_sync_")
    file_path = os.path.join(tmp_dir, f"input{ext}")

    try:
        with open(file_path, "wb") as f:
            f.write(content)
        result = extract_text_from_pdf(file_path, question_count=int(questionCount or 0))
        return JSONResponse(content=result)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("[/extract/sync] Unexpected error")
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # 8001 so it does not collide with the Node API (PORT=5001 on macOS).
    port = int(os.getenv("OCR_PORT", "8001"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info",
    )
