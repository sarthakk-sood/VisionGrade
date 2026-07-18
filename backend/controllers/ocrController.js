/**
 * ocrController.js — Module 2: Answer Sheet Text Extraction
 *
 * POST /api/ocr/extract
 *   Accepts a PDF upload + rollNumber, forwards to Python/TrOCR microservice,
 *   persists an AnswerSheet document in MongoDB, and returns the result.
 *
 * GET /api/ocr/:sheetId
 *   Fetches a previously extracted AnswerSheet from MongoDB.
 */

const fs          = require('fs');
const mongoose    = require('mongoose');
const AnswerSheet = require('../models/answer-sheet');
const { extractTextFromPDF, checkOcrServiceHealth } = require('../services/ocrService');

// ── POST /api/ocr/extract ──────────────────────────────────────────────────────
const extractAnswerSheet = async (req, res, next) => {
  const file = req.file; // Multer diskStorage

  if (!file) {
    res.status(400);
    return next(new Error('No PDF uploaded. Send the file under the field name "pdf".'));
  }

  const { rollNumber, studentName, sessionId, evaluationId } = req.body;

  if (!rollNumber?.trim()) {
    _cleanFile(file.path);
    res.status(400);
    return next(new Error('"rollNumber" is required in the request body.'));
  }

  let ocrResult;

  try {
    console.log(
      `[ocrController] Starting TrOCR for roll=${rollNumber}, file=${file.originalname}`
    );
    ocrResult = await extractTextFromPDF(file.path);
    console.log(
      `[ocrController] Done — ${ocrResult.totalPages} page(s), ` +
      `avg confidence ${ocrResult.avgConfidence}%`
    );
  } catch (err) {
    console.error('[ocrController] OCR failed:', err.message);
    return next(err); // errorHandler → 500 or 502
  } finally {
    // Delete the uploaded PDF regardless of success/failure
    _cleanFile(file.path);
  }

  // ── Persist to MongoDB ────────────────────────────────────────────────────
  // evaluationId links this sheet to an EvaluationReport (Module 3).
  // If not provided yet (typical at this stage), use a placeholder ObjectId
  // that Module 3 will overwrite when it creates the evaluation document.
  let sheetDoc = null;
  try {
    const ocrRawText = ocrResult.pages
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
      .join('\n\n');

    // Build lowConfidenceLines from any line with confidence < 70 across all pages
    const lowConfidenceLines = [];
    for (const page of ocrResult.pages) {
      for (const line of page.lines ?? []) {
        if (line.confidence < 70) {
          lowConfidenceLines.push({
            page:       page.pageNumber,
            lineNumber: line.lineNumber,
            text:       line.text.slice(0, 500),
            confidence: line.confidence,
          });
        }
      }
    }

    sheetDoc = await AnswerSheet.create({
      evaluationId: evaluationId
        ? new mongoose.Types.ObjectId(evaluationId)
        : new mongoose.Types.ObjectId(),   // placeholder — Module 3 links this

      rollNumber:          rollNumber.trim(),
      studentName:         studentName?.trim() || '',
      sessionId:           sessionId || null,

      // Per-page structured data
      pages:               ocrResult.pages,
      ocrRawText,
      ocrConfidence:       ocrResult.avgConfidence,

      // Line-level flags (stretch feature)
      lowConfidenceLines,
      isFlaggedForReview:  ocrResult.isLowConfidence,
      status:              'ocr_done',
    });
  } catch (dbErr) {
    // DB failure is non-fatal — the OCR result is still returned to the caller
    console.error('[ocrController] MongoDB persist failed:', dbErr.message);
  }

  return res.status(200).json({
    success: true,
    message: 'TrOCR extraction complete.',
    data: {
      answerSheetId:       sheetDoc?._id ?? null,
      rollNumber:          rollNumber.trim(),
      studentName:         studentName?.trim() || null,
      sessionId:           sessionId || null,

      // Extraction summary
      totalPages:          ocrResult.totalPages,
      avgConfidence:       ocrResult.avgConfidence,
      lowConfidencePages:  ocrResult.lowConfidencePages,
      isLowConfidence:     ocrResult.isLowConfidence,

      // Full structured results
      pages: ocrResult.pages,   // [{ pageNumber, text, confidence, lines: [...] }]
    },
  });
};

// ── GET /api/ocr/:sheetId ──────────────────────────────────────────────────────
const getAnswerSheet = async (req, res, next) => {
  try {
    const sheet = await AnswerSheet.findById(req.params.sheetId).lean();
    if (!sheet) {
      res.status(404);
      return next(new Error('Answer sheet not found.'));
    }
    return res.json({ success: true, data: sheet });
  } catch (err) {
    return next(err);
  }
};

// ── GET /api/ocr/service-health ────────────────────────────────────────────────
// Convenience endpoint so the frontend/ops can check whether the Python service
// is reachable without triggering a real upload.
const ocrServiceHealth = async (_req, res) => {
  const { ok, detail } = await checkOcrServiceHealth();
  return res.status(ok ? 200 : 503).json({ success: ok, detail });
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function _cleanFile(filePath) {
  try { if (filePath) fs.unlinkSync(filePath); } catch { /* ignore */ }
}

module.exports = { extractAnswerSheet, getAnswerSheet, ocrServiceHealth };
