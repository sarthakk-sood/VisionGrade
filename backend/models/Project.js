const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
  },
  subject: { type: String, trim: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: [true, 'Project must belong to a teacher'],
  },
  pdfPath: { type: String },       // path to uploaded reference PDF
  extractedText: { type: String }, // raw text from pdf-parse
  topics: [{ type: String }],      // LLM-detected topics
  status: {
    type: String,
    enum: ['uploaded', 'topics_detected', 'paper_generated', 'approved'],
    default: 'uploaded',
  },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);