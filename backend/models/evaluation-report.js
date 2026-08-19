const mongoose = require('mongoose');

const questionEvalSchema = new mongoose.Schema({
  questionNumber: { type: Number, required: true },
  questionText:   { type: String },
  modelAnswer:    { type: String },
  studentAnswer:  { type: String },
  maxMarks:       { type: Number, required: true },
  marksAwarded:   { type: Number, required: true },
  isOverridden:   { type: Boolean, default: false },
  overriddenMarks:{ type: Number },
  matchedKeywords: [{ type: String }],
  keywordCoverage:{ type: Number },
  semanticScore:  { type: Number },
  strengths:      [{ type: String }],
  weaknesses:     [{ type: String }],
  feedback:       { type: String },
}, { _id: false });

const evaluationReportSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamSession',
    required: true,
  },
  answerSheetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnswerSheet',
    required: true,
  },
  studentName:   { type: String, trim: true },
  rollNumber:    { type: String, trim: true },
  totalMarks:    { type: Number },
  marksObtained: { type: Number },
  percentage:    { type: Number },
  provider:      { type: String },
  questionEvals: [questionEvalSchema],
  status: {
    type: String,
    enum: ['pending', 'evaluated', 'approved'],
    default: 'pending',
  },
}, { timestamps: true });

evaluationReportSchema.index({ sessionId: 1, rollNumber: 1 });
evaluationReportSchema.index({ answerSheetId: 1 }, { unique: true });

evaluationReportSchema.pre('save', function (next) {
  if (this.totalMarks && this.marksObtained !== undefined) {
    this.percentage = parseFloat(
      ((this.marksObtained / this.totalMarks) * 100).toFixed(2)
    );
  }
  next();
});

module.exports = mongoose.model('EvaluationReport', evaluationReportSchema);
