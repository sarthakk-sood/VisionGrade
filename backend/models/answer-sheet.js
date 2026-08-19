/**
 * answer-sheet.js — Module 2: one student's uploaded sheet + OCR result.
 * Original file is stored on Cloudinary; OCR text lives here for evaluation.
 */

const mongoose = require('mongoose');

const lineResultSchema = new mongoose.Schema({
  lineNumber: { type: Number, required: true },
  text:       { type: String, default: '' },
  confidence: { type: Number, default: 0 },
  bbox:       { type: [Number], default: [] },
}, { _id: false });

const pageResultSchema = new mongoose.Schema({
  pageNumber: { type: Number, required: true },
  text:       { type: String, default: '' },
  confidence: { type: Number, default: 0 },
  lines:      { type: [lineResultSchema], default: [] },
}, { _id: false });

const lowConfLineSchema = new mongoose.Schema({
  page:       { type: Number },
  lineNumber: { type: Number },
  text:       { type: String },
  confidence: { type: Number },
}, { _id: false });

const answerSheetSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
  },
  evaluationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EvaluationReport',
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamSession',
  },

  rollNumber:  { type: String, trim: true, required: true },
  studentName: { type: String, trim: true, default: '' },

  originalFilename: { type: String, default: '' },
  mimeType:         { type: String, default: '' },
  fileSize:         { type: Number, default: 0 },
  fileUrl:          { type: String, default: '' },
  filePublicId:     { type: String, default: '' },
  fileResourceType: { type: String, default: '' },

  pages:     { type: [pageResultSchema], default: [] },
  pageCount: { type: Number, default: 0 },
  ocrRawText:    { type: String, default: '' },
  ocrConfidence: { type: Number, default: 0 },
  ocrError:      { type: String, default: '' },

  lowConfidenceLines: { type: [lowConfLineSchema], default: [] },
  isFlaggedForReview: { type: Boolean, default: false },

  status: {
    type: String,
    enum: ['uploaded', 'ocr_done', 'evaluated'],
    default: 'uploaded',
  },
}, { timestamps: true });

answerSheetSchema.index({ teacherId: 1, sessionId: 1, rollNumber: 1 });
answerSheetSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model('AnswerSheet', answerSheetSchema);
