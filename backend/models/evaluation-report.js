const mongoose = require('mongoose');

/** Per-marking-criterion step-marking result: full / half / zero credit. */
const criterionBreakdownSchema = new mongoose.Schema({
  point:      { type: String, required: true },
  maxMarks:   { type: Number, required: true },
  marksAwarded: { type: Number, required: true },
  matchLevel: { type: String, enum: ['full', 'partial', 'none'], default: 'none' },
  matchedKeywords: [{ type: String }],
}, { _id: false });

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
  criteriaBreakdown: [criterionBreakdownSchema],
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

// Mongoose 9 removed the next() callback from pre() middleware — async
// functions (or plain functions returning nothing) are now the only
// supported form. Calling next() here throws "next is not a function".
evaluationReportSchema.pre('save', function () {
  if (this.totalMarks && this.marksObtained !== undefined) {
    this.percentage = parseFloat(
      ((this.marksObtained / this.totalMarks) * 100).toFixed(2)
    );
  }
});

module.exports = mongoose.model('EvaluationReport', evaluationReportSchema);
