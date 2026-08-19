const mongoose = require('mongoose');

// ── Sub-schema: detected topic (with teacher config) ──────────────────────────
const topicSchema = new mongoose.Schema({
  id:          { type: Number },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  keywords:    [{ type: String }],
  isSelected:  { type: Boolean, default: true },

  // Teacher-configured per-topic generation settings
  marks:          { type: Number, default: 0 },
  weightage:      { type: Number, default: 0 },   // percentage
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Mixed'], default: 'Mixed' },
}, { _id: false });

// ── Sub-schema: a single generated question ───────────────────────────────────
const generatedQuestionSchema = new mongoose.Schema({
  topicName:    { type: String },
  type:         { type: String, enum: ['MCQ','ShortAnswer','MediumAnswer','LongAnswer','FillInTheBlanks'] },
  difficulty:   { type: String, enum: ['Easy','Medium','Hard'] },
  marks:        { type: Number },
  questionText: { type: String },
  options:      [{ type: String }],   // only for MCQ
  correctAnswer:{ type: String },
  explanation:  { type: String },
  modelAnswer:  { type: String },
  markingScheme:{ type: String },
  approved:     { type: Boolean, default: false },

  // Provenance — the passage in the uploaded PDF this question was written from.
  // `grounded` records whether sourceEvidence was actually found in that text,
  // which is what distinguishes a document-specific question from a generic one.
  sourceEvidence: { type: String, default: '' },
  sourceFile:     { type: String, default: '' },
  sourcePage:     { type: Number, default: null },
  grounded:       { type: Boolean, default: false },
  groundingScore: { type: Number, default: 0 },
}, { _id: true });

// ── Main Project schema ───────────────────────────────────────────────────────
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

  // Topics detected by LLM — each has teacher-configured generation settings
  topics: { type: [topicSchema], default: [] },

  // LLM-inferred subject
  detectedSubject: { type: String, default: null },

  // Exam info used for question generation
  examInfo: {
    examTitle:       { type: String },
    subject:         { type: String },
    totalMarks:      { type: Number, default: 100 },
    durationMinutes: { type: Number, default: 90 },
    instructions:    [{ type: String }],
    questionTypes: {
      MCQ:             { count: { type: Number, default: 0 }, marks: { type: Number, default: 1 } },
      ShortAnswer:     { count: { type: Number, default: 0 }, marks: { type: Number, default: 2 } },
      MediumAnswer:    { count: { type: Number, default: 0 }, marks: { type: Number, default: 3 } },
      LongAnswer:      { count: { type: Number, default: 0 }, marks: { type: Number, default: 5 } },
      FillInTheBlanks: { count: { type: Number, default: 0 }, marks: { type: Number, default: 1 } },
    },
  },

  // LLM-generated questions
  generatedQuestions: { type: [generatedQuestionSchema], default: [] },

  // Which LLM provider generated the questions
  generationProvider: { type: String, default: null },

  status: {
    type: String,
    enum: ['uploaded', 'topics_detected', 'paper_generated', 'approved'],
    default: 'uploaded',
  },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
