const mongoose = require('mongoose');

const sourceDocumentSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  filename:      { type: String },
  pdfUrl:        { type: String },
  publicId:      { type: String },   // Cloudinary public_id for deletion
  extractedText: { type: String },
  pageCount:     { type: Number, default: 0 },
  isSelected:    { type: Boolean, default: true }, // teacher can deselect
}, { timestamps: true });

module.exports = mongoose.model('SourceDocument', sourceDocumentSchema);