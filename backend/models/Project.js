const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: [true, 'Project must belong to a teacher'],
  },
  subject: { type: String, trim: true },
  sourceDocs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SourceDocument',
  }],
  extractedText: { type: String },
  topics: [{ type: String }],
  status: {
    type: String,
    enum: ['uploaded', 'topics_detected', 'paper_generated', 'approved'],
    default: 'uploaded',
  },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);