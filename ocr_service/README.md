# VisionGrade OCR Microservice

Python FastAPI service that provides TrOCR-based handwriting recognition for Module 2.

## What it does

1. Accepts a PDF answer sheet via HTTP POST `/extract`
2. Converts every page to a raster image (poppler / pdf2image)
3. Segments each page image into individual text-line crops (OpenCV)
4. Runs `microsoft/trocr-base-handwritten` on every line
5. Returns reassembled per-page text with per-line confidence scores (0–100 %)

## System prerequisites

| Prerequisite | Windows | macOS | Linux |
|---|---|---|---|
| **Python 3.10+** | python.org | `brew install python` | `apt install python3` |
| **Poppler** (pdf2image backend) | [poppler-windows releases](https://github.com/oschwartz10612/poppler-windows/releases) — add `bin/` to `PATH` | `brew install poppler` | `apt install poppler-utils` |

## Setup

```bash
# From the ocr_service/ directory:

# 1. Create a virtual environment (recommended)
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. (First run only) TrOCR weights are downloaded automatically from HuggingFace
#    (~340 MB) and cached in ~/.cache/huggingface/hub

# 4. Start the service
python main.py
# Service runs on http://localhost:5001 by default
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OCR_PORT` | `5001` | Port the service listens on |
| `MAX_PDF_MB` | `50` | Max accepted PDF size |

## API

### `GET /health`
Returns `{ "status": "ok", "model": "...", "device": "cpu|cuda" }`

### `POST /extract`
- **Content-Type:** `multipart/form-data`
- **Field:** `pdf` (File, application/pdf)
- **Response:**
```json
{
  "pages": [
    {
      "pageNumber": 1,
      "text": "full page text, newline-separated lines",
      "confidence": 84.2,
      "lines": [
        { "lineNumber": 1, "text": "...", "confidence": 91.5, "bbox": [x1, y1, x2, y2] }
      ]
    }
  ],
  "totalPages": 3,
  "avgConfidence": 82.7,
  "lowConfidencePages": [2],
  "isLowConfidence": false
}
```

## Performance notes

- **CPU (no GPU):** ~5–30 seconds per page depending on line count and CPU speed
- **GPU (CUDA):** ~1–5 seconds per page
- The model is loaded once at startup and kept in memory; subsequent requests are faster
- TrOCR (`trocr-base-handwritten`) reaches ~85–95 % CER on clear handwriting.
  Camera-photographed sheets with glare or skew will reduce accuracy.
  Consider deskewing with OpenCV's `warpAffine` as a preprocessing step if accuracy is low.

## Integration with Node.js backend

The Express backend's `ocrService.js` calls this service via HTTP.
Set `OCR_SERVICE_URL=http://localhost:5001` in `backend/.env`.
