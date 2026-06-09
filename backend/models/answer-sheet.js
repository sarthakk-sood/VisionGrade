const mongoose = require('mongoose');

const answerSheet = new mongoose.Schema({
  evaluationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EvaluationReport',
    required: true,
  },
  studentName: { type: String, trim: true },
  rollNumber:  { type: String, trim: true },
  imagePaths:  [{ type: String }],  // original uploaded photos
  processedImagePaths: [{ type: String }], // sharp/jimp output
  ocrRawText:  { type: String },
  ocrConfidence: { type: Number },  // average confidence 0–100
  lowConfidenceRegions: [{ 
    page: Number, 
    text: String, 
    confidence: Number 
  }],
  isFlaggedForReview: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['uploaded', 'preprocessed', 'ocr_done', 'evaluated'],
    default: 'uploaded',
  },
}, { timestamps: true });

module.exports = mongoose.model('AnswerSheet', answerSheet);