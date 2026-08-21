const mongoose = require('mongoose');

// Page-level text, kept alongside the flat extractedText so retrieved excerpts
// can be attributed to a page number.
const pageSchema = new mongoose.Schema({
  num:  { type: Number },
  text: { type: String },
}, { _id: false });

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
  pages:         { type: [pageSchema], default: [] },
  pageCount:     { type: Number, default: 0 },
  isSelected:    { type: Boolean, default: true }, // teacher can deselect
}, { timestamps: true });

module.exports = mongoose.model('SourceDocument', sourceDocumentSchema);