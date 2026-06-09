const mongoose = require('mongoose');

const questionEvalSchema = new mongoose.Schema({
  questionNumber: { type: Number, required: true },
  questionText:   { type: String },
  modelAnswer:    { type: String },
  studentAnswer:  { type: String },
  maxMarks:       { type: Number, required: true },
  marksAwarded:   { type: Number, required: true },
  isOverridden:   { type: Boolean, default: false }, // teacher manually changed marks
  overriddenMarks:{ type: Number },
  keywordCoverage:{ type: Number },  // % of keywords matched
  semanticScore:  { type: Number },  // 0–1 similarity score
  strengths:      [{ type: String }],
  weaknesses:     [{ type: String }],
  feedback:       { type: String },
});

const evaluationReportSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  questionPaperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuestionPaper',
  },
  studentName:  { type: String, trim: true },
  rollNumber:   { type: String, trim: true },
  totalMarks:   { type: Number },
  marksObtained:{ type: Number },
  percentage:   { type: Number },
  questionEvals:[questionEvalSchema],
  exportPath:   { type: String },  // path to individual DOCX report
  status: {
    type: String,
    enum: ['pending', 'evaluated', 'approved'],
    default: 'pending',
  },
}, { timestamps: true });

// Auto-calculate percentage before save
evaluationReportSchema.pre('save', function (next) {
  if (this.totalMarks && this.marksObtained !== undefined) {
    this.percentage = parseFloat(
      ((this.marksObtained / this.totalMarks) * 100).toFixed(2)
    );
  }
  next();
});

module.exports = mongoose.model('EvaluationReport', evaluationReportSchema);