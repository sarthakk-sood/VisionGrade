const mongoose = require('mongoose');

const sessionQuestionSchema = new mongoose.Schema({
  sourceQuestionId: { type: mongoose.Schema.Types.ObjectId },
  questionNumber:   { type: Number, required: true },
  topicName:        { type: String },
  type: {
    type: String,
    enum: ['MCQ', 'ShortAnswer', 'MediumAnswer', 'LongAnswer', 'FillInTheBlanks'],
  },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'] },
  marks:      { type: Number },
  questionText: { type: String, required: true },
  options:    [{ type: String }],
  correctAnswer:  { type: String },
  modelAnswer:    { type: String },
  markingScheme:  { type: String },
  markingCriteria: [{
    point: { type: String },
    marks: { type: Number },
  }],
  explanation:    { type: String },
}, { _id: true });

const examSessionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true,
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
  },
  examTitle:       { type: String },
  subject:         { type: String },
  totalMarks:      { type: Number, default: 0 },
  durationMinutes: { type: Number, default: 90 },
  questionCount:   { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['finalized', 'exported'],
    default: 'finalized',
  },
  questions:       { type: [sessionQuestionSchema], default: [] },
  answerProvider:  { type: String },
  finalizedAt:     { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('ExamSession', examSessionSchema);
