const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionNumber: { type: Number, required: true },
  type: {
    type: String,
    enum: ['MCQ', 'Short', 'Long', 'MST', 'EST'],
    required: true,
  },
  topic: { type: String },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  marks: { type: Number, required: true },
  questionText: { type: String, required: true },
  options: [{ type: String }],          // MCQ only
  modelAnswer: { type: String },
  markingScheme: { type: String },
  markingCriteria: [{
    point: { type: String },
    marks: { type: Number },
  }],
  isEdited: { type: Boolean, default: false },
});

const questionPaperSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  blueprint: {
    totalMarks: { type: Number },
    duration: { type: String },
    sections: [{ type: mongoose.Schema.Types.Mixed }], // flexible LLM output
  },
  questions: [questionSchema],
  isApproved: { type: Boolean, default: false },
  exportPaths: {
    questionPaper: { type: String },  // path to exported DOCX/PDF
    answerKey:     { type: String },
    markingScheme: { type: String },
  },
}, { timestamps: true });

module.exports = mongoose.model('QuestionPaper', questionPaperSchema);