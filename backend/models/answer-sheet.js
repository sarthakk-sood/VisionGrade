/**
 * answer-sheet.js — Module 2: one student's uploaded answer sheet.
 * The file is stored on Cloudinary; scoring reads the photo/PDF directly
 * with a vision LLM (Gemini, falling back to Groq). No OCR text is stored.
 */

const mongoose = require('mongoose');

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

  status: {
    type: String,
    enum: ['uploaded', 'evaluated'],
    default: 'uploaded',
  },
}, { timestamps: true });

answerSheetSchema.index({ teacherId: 1, sessionId: 1, rollNumber: 1 });
answerSheetSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model('AnswerSheet', answerSheetSchema);
