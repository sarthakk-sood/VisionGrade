/**
 * answer-sheet.js — Module 2: Answer Sheet Text Extraction
 *
 * Stores TrOCR extraction results for a single student's PDF answer sheet.
 * Linked to an EvaluationReport once Module 3 (answer evaluation) is built.
 *
 * Key design choices:
 *  - pages[]         : per-page extracted text + confidence + per-line detail
 *  - lowConfidenceLines[] : stretch feature — individual lines flagged for review
 *  - evaluationId    : optional placeholder until Module 3 sets a real value
 */

const mongoose = require('mongoose');

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const lineResultSchema = new mongoose.Schema({
  lineNumber: { type: Number, required: true },
  text:       { type: String, default: '' },
  // Confidence expressed as 0–100 (mean softmax-argmax probability from TrOCR)
  confidence: { type: Number, default: 0 },
  // Bounding box of the line crop on the page image [x1, y1, x2, y2] in pixels
  bbox:       { type: [Number], default: [] },
}, { _id: false });

const pageResultSchema = new mongoose.Schema({
  pageNumber: { type: Number, required: true },
  text:       { type: String, default: '' },
  // Mean of all line confidences on this page (0–100)
  confidence: { type: Number, default: 0 },
  lines:      { type: [lineResultSchema], default: [] },
}, { _id: false });

const lowConfLineSchema = new mongoose.Schema({
  page:       { type: Number },
  lineNumber: { type: Number },
  text:       { type: String },
  confidence: { type: Number },
}, { _id: false });

// ── Main schema ────────────────────────────────────────────────────────────────

const answerSheetSchema = new mongoose.Schema({
  /**
   * Will be set by Module 3 (evaluation) when it links this sheet to a report.
   * Stored as a placeholder ObjectId initially so this document can be created
   * independently during text extraction.
   */
  evaluationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'EvaluationReport',
  },

  rollNumber:  { type: String, trim: true, required: true },
  studentName: { type: String, trim: true, default: '' },

  // Optional link to the exam session (from Module 1)
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'ExamSession',
  },

  // ── TrOCR results ──────────────────────────────────────────────────────────
  // Structured per-page data (Module 3 reads pages[].text for evaluation)
  pages: { type: [pageResultSchema], default: [] },

  // Flat concatenation of all pages (convenience field for full-text search)
  ocrRawText:    { type: String, default: '' },
  ocrConfidence: { type: Number, default: 0 }, // avgConfidence across all pages

  // Lines where confidence < 70 % — flagged for manual review
  lowConfidenceLines: { type: [lowConfLineSchema], default: [] },

  // true when avgConfidence < 70 % (set by ocrService / pipeline)
  isFlaggedForReview: { type: Boolean, default: false },

  status: {
    type:    String,
    enum:    ['uploaded', 'ocr_done', 'evaluated'],
    default: 'uploaded',
  },
}, { timestamps: true });

module.exports = mongoose.model('AnswerSheet', answerSheetSchema);