/**
 * ocrService.js — Module 2: Answer Sheet Text Extraction
 *
 * Thin HTTP client that forwards a PDF file to the Python/TrOCR microservice
 * and returns the structured OCR result to the controller.
 *
 * Why a separate Python service?
 *   TrOCR (microsoft/trocr-base-handwritten) is a HuggingFace Transformers model.
 *   The Python ecosystem (PyTorch + transformers) is the canonical runtime for it.
 *
 * Async job pattern (fixes the 600 s timeout):
 *   TrOCR on CPU can take 5–30 minutes per page. The old synchronous design
 *   caused axios to time out. The new design:
 *
 *     1. POST /extract  → Python returns { jobId, status: "queued" } in < 200 ms
 *     2. Poll GET /jobs/{jobId} every POLL_INTERVAL_MS until status == "done"
 *        or "error", or MAX_WAIT_MS is exceeded.
 *
 * Contract with the Python service:
 *   POST /extract  (multipart, field "pdf")
 *     → { jobId: string, status: "queued" }
 *
 *   GET  /jobs/{jobId}
 *     → { jobId, status: "queued" | "processing" }           (still running)
 *     → { jobId, status: "done", result: { pages, ... } }    (success)
 *     → { jobId, status: "error", error: string }            (failed)
 *
 * Error handling:
 *   - Throws with a descriptive message if the service is unreachable,
 *     returns a non-2xx status, returns malformed JSON, or times out.
 *   - The controller catches these and converts them to HTTP 502/500 responses.
 */

const fs       = require('fs');
const path     = require('path');
const axios    = require('axios');
const FormData = require('form-data');

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8001';

const POLL_INTERVAL_MS = parseInt(process.env.OCR_POLL_INTERVAL_MS, 10) || 1_000;
const MAX_WAIT_MS      = parseInt(process.env.OCR_MAX_WAIT_MS,      10) || 30 * 60 * 1000;
const REQUEST_TIMEOUT  = parseInt(process.env.OCR_REQUEST_TIMEOUT_MS, 10) || 15_000;

const MIME_BY_EXT = {
  '.pdf':  'application/pdf',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.tif':  'image/tiff',
  '.tiff': 'image/tiff',
  '.bmp':  'image/bmp',
  '.webp': 'image/webp',
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST the PDF to the Python microservice and get back a jobId.
 * Returns the jobId string.
 */
async function _submitJob(pdfFilePath, fileMeta = {}) {
  if (!fs.existsSync(pdfFilePath)) {
    throw new Error(`[ocrService] PDF not found at path: ${pdfFilePath}`);
  }

  const filename = fileMeta.originalName || path.basename(pdfFilePath);
  const ext = path.extname(filename || pdfFilePath).toLowerCase();
  const contentType = fileMeta.mimeType || MIME_BY_EXT[ext] || 'application/octet-stream';

  const form = new FormData();
  form.append('pdf', fs.createReadStream(pdfFilePath), {
    filename,
    contentType,
  });
  if (fileMeta.questionCount) {
    form.append('questionCount', String(fileMeta.questionCount));
  }

  let response;
  try {
    response = await axios.post(`${OCR_SERVICE_URL}/extract`, form, {
      headers:          form.getHeaders(),
      timeout:          REQUEST_TIMEOUT,
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw new Error(
        `[ocrService] Cannot reach OCR microservice at ${OCR_SERVICE_URL}. ` +
        `Is it running? Start it with: cd ocr_service && python main.py`
      );
    }
    const detail = err.response?.data?.detail || err.response?.data || err.message;
    const status = err.response?.status ?? 'unknown';
    throw new Error(`[ocrService] OCR service returned HTTP ${status}: ${JSON.stringify(detail)}`);
  }

  const { jobId } = response.data;
  if (!jobId) {
    throw new Error(
      `[ocrService] OCR service did not return a jobId. Response: ${JSON.stringify(response.data)}`
    );
  }

  return jobId;
}

/**
 * Poll GET /jobs/{jobId} until the job is done, errored, or times out.
 * Returns the result object on success, throws on failure/timeout.
 */
async function _pollJob(jobId) {
  const deadline = Date.now() + MAX_WAIT_MS;
  let delay = 400;

  while (Date.now() < deadline) {
    await sleep(delay);
    delay = Math.min(POLL_INTERVAL_MS, delay + 200);

    let resp;
    try {
      resp = await axios.get(`${OCR_SERVICE_URL}/jobs/${jobId}`, {
        timeout: REQUEST_TIMEOUT,
      });
    } catch (err) {
      const data = err.response?.data;
      if (data?.status === 'error') {
        throw new Error(`[ocrService] OCR job ${jobId} failed: ${data.error}`);
      }
      console.warn(`[ocrService] Poll hiccup for job ${jobId}: ${err.message}`);
      continue;
    }

    const { status, result, error } = resp.data;

    if (status === 'done') {
      if (!result || !Array.isArray(result.pages)) {
        throw new Error(
          `[ocrService] Job ${jobId} done but result shape is unexpected: ` +
          JSON.stringify(result)
        );
      }
      return result;
    }

    if (status === 'error') {
      throw new Error(`[ocrService] OCR job ${jobId} failed: ${error}`);
    }

    // status === "queued" | "processing" → keep polling
    console.log(`[ocrService] Job ${jobId} status: ${status}…`);
  }

  throw new Error(
    `[ocrService] OCR job ${jobId} did not complete within ` +
    `${MAX_WAIT_MS / 60_000} minutes. ` +
    `The PDF may have too many pages, or the model is very slow on this CPU.`
  );
}

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Send the PDF at `pdfFilePath` to the Python OCR microservice and return
 * the structured result.  Uses async job polling — does not block for the
 * full extraction duration.
 *
 * @param {string} pdfFilePath  Absolute path to the PDF file on disk.
 * @param {(status: string) => void} [onProgress]  Optional progress callback.
 * @returns {Promise<{
 *   pages: Array<{
 *     pageNumber: number,
 *     text: string,
 *     confidence: number,
 *     lines: Array<{ lineNumber: number, text: string, confidence: number, bbox: number[] }>
 *   }>,
 *   totalPages: number,
 *   avgConfidence: number,
 *   lowConfidencePages: number[],
 *   isLowConfidence: boolean,
 * }>}
 */
async function extractTextFromPDF(pdfFilePath, onProgress, fileMeta = {}) {
  console.log(`[ocrService] Submitting OCR job for: ${pdfFilePath}`);

  const jobId = await _submitJob(pdfFilePath, fileMeta);
  console.log(`[ocrService] Job submitted — id=${jobId}. Polling every ${POLL_INTERVAL_MS / 1000}s…`);

  if (onProgress) onProgress('processing');

  const result = await _pollJob(jobId);
  console.log(
    `[ocrService] Job ${jobId} complete — ${result.totalPages} page(s), ` +
    `avg confidence ${result.avgConfidence}%`
  );

  return result;
}

/**
 * Check whether the Python OCR microservice is reachable.
 * Used by the health route so operators can detect misconfigurations early.
 *
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
async function checkOcrServiceHealth() {
  try {
    const resp = await axios.get(`${OCR_SERVICE_URL}/health`, { timeout: 5000 });
    return { ok: true, detail: resp.data };
  } catch {
    return {
      ok:     false,
      detail: `OCR service unreachable at ${OCR_SERVICE_URL}`,
    };
  }
}

module.exports = { extractTextFromPDF, checkOcrServiceHealth };
