const { uploadPDFAsync } = require('../config/multer');
const { uploadAndParsePDF } = require('../services/pdfService');
const Project = require('../models/Project');
const SourceDocument = require('../models/sourceDocument');
const { generateQuestions } = require('../services/questionGenerationService');

const VALID_TYPES = ['MCQ', 'ShortAnswer', 'MediumAnswer', 'LongAnswer', 'FillInTheBlanks'];
const VALID_DIFFICULTY = ['Easy', 'Medium', 'Hard'];
const VALID_TOPIC_DIFFICULTY = ['Easy', 'Medium', 'Hard', 'Mixed'];

/** 'Mixed' is valid for topics (means "generate a mix") but NOT for individual questions.
 *  Sanitize at the question-save boundary so Mongoose enum never rejects it. */
const sanitizeDifficulty = (d) => (d === 'Mixed' || !VALID_DIFFICULTY.includes(d) ? 'Medium' : d);

const formatQuestion = (q) => ({
  _id:           q._id,
  id:            q._id?.toString(),
  topicName:     q.topicName,
  type:          q.type,
  difficulty:    q.difficulty,
  marks:         q.marks,
  questionText:  q.questionText,
  options:       q.options?.length ? q.options : null,
  correctAnswer: q.correctAnswer,
  explanation:   q.explanation || '',
  modelAnswer:   q.modelAnswer || '',
  markingScheme: q.markingScheme || '',
  markingCriteria: q.markingCriteria || [],
  approved:      q.approved ?? false,
  sourceEvidence: q.sourceEvidence || '',
  sourceFile:     q.sourceFile || '',
  sourcePage:     q.sourcePage ?? null,
  grounded:       q.grounded ?? false,
});

/** Documents in the shape the retrieval layer expects. */
const loadSourceDocuments = async (projectId) => {
  const docs = await SourceDocument.find({ projectId, isSelected: true });
  return (docs || [])
    .map((d) => ({
      filename:      d.filename || 'Source document',
      pages:         (d.pages || []).map((p) => ({ num: p.num, text: p.text })),
      extractedText: d.extractedText || '',
    }))
    .filter((d) => d.extractedText.trim().length || d.pages.length);
};

/**
 * Topic detection already stored a description and keywords for each topic.
 * Retrieval needs them to find the right passages, so merge them back into the
 * per-topic config the client sends.
 */
const enrichTopics = (topics, project) => {
  const meta = new Map((project.topics || []).map((t) => [t.name, t]));
  return topics.map((t) => {
    const detected = meta.get(t.topicName);
    return {
      ...t,
      description: t.description || detected?.description || '',
      keywords:    t.keywords?.length ? t.keywords : (detected?.keywords || []),
    };
  });
};

const loadOwnedProject = async (projectId, teacherId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }
  if (project.teacherId.toString() !== teacherId.toString()) {
    const err = new Error('Not authorised');
    err.statusCode = 403;
    throw err;
  }
  return project;
};

const findQuestionIndex = (project, questionId) =>
  project.generatedQuestions.findIndex(
    (q) => q._id?.toString() === String(questionId) || String(q.id) === String(questionId)
  );

const sumMarks = (questions) =>
  questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

const applyQuestionPatch = (question, body) => {
  if (body.questionText !== undefined) question.questionText = String(body.questionText).trim();
  if (body.topicName !== undefined) question.topicName = String(body.topicName).trim();
  if (body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type)) {
      throw Object.assign(new Error(`Invalid type. Use: ${VALID_TYPES.join(', ')}`), { statusCode: 400 });
    }
    question.type = body.type;
  }
  if (body.difficulty !== undefined) {
    if (!VALID_TOPIC_DIFFICULTY.includes(body.difficulty)) {
      throw Object.assign(new Error(`Invalid difficulty. Use: ${VALID_TOPIC_DIFFICULTY.join(', ')}`), { statusCode: 400 });
    }
    question.difficulty = sanitizeDifficulty(body.difficulty);
  }
  if (body.marks !== undefined) {
    const marks = Number(body.marks);
    if (!Number.isFinite(marks) || marks < 1) {
      throw Object.assign(new Error('marks must be a positive number'), { statusCode: 400 });
    }
    question.marks = marks;
  }
  if (body.correctAnswer !== undefined) question.correctAnswer = String(body.correctAnswer).trim();
  if (body.explanation !== undefined) question.explanation = String(body.explanation).trim();
  if (body.approved !== undefined) question.approved = Boolean(body.approved);
  if (body.options !== undefined) {
    question.options = Array.isArray(body.options)
      ? body.options.map((o) => String(o).trim()).filter(Boolean)
      : [];
  }
  if (!question.questionText) {
    throw Object.assign(new Error('questionText is required'), { statusCode: 400 });
  }
  if (!question.topicName) {
    throw Object.assign(new Error('topicName is required'), { statusCode: 400 });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/questions/upload-pdfs
// ─────────────────────────────────────────────────────────────────────────────
const uploadPDFs = async (req, res, next) => {
  try {
    await uploadPDFAsync(req, res);

    const files = [...(req.files?.pdf || []), ...(req.files?.pdfs || [])];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No PDF files provided' });
    }

    const project = await Project.create({
      title:     req.body.title || 'Untitled Project',
      subject:   req.body.subject || '',
      teacherId: req.teacher._id,
      status:    'uploaded',
    });

    const results = await Promise.all(
      files.map(async (file) => {
        const { url, publicId, extractedText, pages, pageCount } =
          await uploadAndParsePDF(file.buffer, file.originalname);

        const doc = await SourceDocument.create({
          teacherId:     req.teacher._id,
          projectId:     project._id,
          filename:      file.originalname,
          pdfUrl:        url,
          publicId,
          extractedText,
          pages:         pages || [],
          pageCount,
          isSelected:    true,
        });

        const preview = extractedText
          ? extractedText.substring(0, 200) + (extractedText.length > 200 ? '…' : '')
          : '(no text extracted)';

        return {
          docId:                doc._id,
          filename:             file.originalname,
          pageCount,
          pdfUrl:               url,
          extractedTextPreview: preview,
        };
      })
    );

    project.sourceDocs = results.map((r) => r.docId);
    await project.save();

    res.status(201).json({
      success:   true,
      projectId: project._id,
      title:     project.title,
      documents: results,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/questions/generate
// ─────────────────────────────────────────────────────────────────────────────
const generateQuestionsHandler = async (req, res, next) => {
  try {
    const { projectId, examInfo, topics } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId is required' });
    }
    if (!examInfo?.examTitle || !examInfo?.totalMarks) {
      return res.status(400).json({ success: false, error: 'examInfo.examTitle and examInfo.totalMarks are required' });
    }
    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ success: false, error: 'topics array is required and must not be empty' });
    }

    const project = await loadOwnedProject(projectId, req.teacher._id);

    const sourceDocuments = await loadSourceDocuments(project._id);
    if (!sourceDocuments.length) {
      return res.status(400).json({
        success: false,
        error: 'No readable text found in the uploaded PDFs. Please upload PDFs with extractable text.',
      });
    }

    const config = {
      examInfo: {
        examTitle:       examInfo.examTitle,
        subject:         examInfo.subject || project.subject || project.detectedSubject || '',
        totalMarks:      examInfo.totalMarks,
        durationMinutes: examInfo.durationMinutes || 90,
        instructions:    examInfo.instructions || [],
        questionTypes:   examInfo.questionTypes || {},
      },
      topics: enrichTopics(topics, project),
    };

    const result = await generateQuestions(config, sourceDocuments);

    project.examInfo           = config.examInfo;
    project.generatedQuestions = result.questions;
    project.generationProvider = result.provider;
    project.status             = 'paper_generated';

    project.topics = project.topics.map((dbTopic) => {
      const incoming = topics.find((t) => t.topicName === dbTopic.name);
      if (!incoming) return dbTopic;
      dbTopic.marks      = incoming.marks      ?? dbTopic.marks;
      dbTopic.weightage  = incoming.weightage  ?? dbTopic.weightage;
      dbTopic.difficulty = incoming.difficulty ?? dbTopic.difficulty;
      return dbTopic;
    });

    await project.save();

    return res.status(200).json({
      success:        true,
      projectId:      project._id,
      provider:       result.provider,
      usage:          result.usage,
      totalQuestions: result.totalQuestions,
      totalMarks:     result.totalMarks,
      groundedCount:  result.groundedCount,
      warnings:       result.warnings,
      questions:      project.generatedQuestions.map(formatQuestion),
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/questions/list/:projectId
// ─────────────────────────────────────────────────────────────────────────────
const getProjectQuestions = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = await loadOwnedProject(projectId, req.teacher._id);

    return res.status(200).json({
      success:            true,
      projectId:          project._id,
      status:             project.status,
      generationProvider: project.generationProvider,
      examInfo:           project.examInfo,
      totalQuestions:     project.generatedQuestions.length,
      totalMarks:         sumMarks(project.generatedQuestions),
      questions:          project.generatedQuestions.map(formatQuestion),
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/questions/:projectId/add
// ─────────────────────────────────────────────────────────────────────────────
const addQuestionHandler = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = await loadOwnedProject(projectId, req.teacher._id);

    const draft = {
      topicName:     req.body.topicName || 'General',
      type:          req.body.type || 'ShortAnswer',
      difficulty:    sanitizeDifficulty(req.body.difficulty || 'Medium'),
      marks:         Number(req.body.marks) || 2,
      questionText:  req.body.questionText || '',
      options:       req.body.options || [],
      correctAnswer: req.body.correctAnswer || '',
      explanation:   req.body.explanation || '',
      approved:      false,
    };

    try {
      applyQuestionPatch(draft, draft);
    } catch (validationErr) {
      return res.status(validationErr.statusCode || 400).json({ success: false, error: validationErr.message });
    }

    project.generatedQuestions.push(draft);
    if (project.status === 'uploaded' || project.status === 'topics_detected') {
      project.status = 'paper_generated';
    }
    await project.save();

    const added = project.generatedQuestions[project.generatedQuestions.length - 1];

    return res.status(201).json({
      success:    true,
      question:   formatQuestion(added),
      totalMarks: sumMarks(project.generatedQuestions),
      questions:  project.generatedQuestions.map(formatQuestion),
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/questions/:projectId/:questionId
// ─────────────────────────────────────────────────────────────────────────────
const updateQuestionHandler = async (req, res, next) => {
  try {
    const { projectId, questionId } = req.params;
    const project = await loadOwnedProject(projectId, req.teacher._id);

    const qIndex = findQuestionIndex(project, questionId);
    if (qIndex === -1) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }

    const q = project.generatedQuestions[qIndex];

    try {
      applyQuestionPatch(q, req.body);
    } catch (validationErr) {
      return res.status(validationErr.statusCode || 400).json({ success: false, error: validationErr.message });
    }

    if (req.body.approved === undefined && (
      req.body.questionText !== undefined ||
      req.body.marks !== undefined ||
      req.body.type !== undefined ||
      req.body.options !== undefined
    )) {
      q.approved = false;
    }

    if (req.body.approved === true) {
      project.status = 'approved';
    }

    await project.save();

    return res.status(200).json({
      success:    true,
      question:   formatQuestion(q),
      totalMarks: sumMarks(project.generatedQuestions),
      questions:  project.generatedQuestions.map(formatQuestion),
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/questions/:projectId/:questionId
// ─────────────────────────────────────────────────────────────────────────────
const deleteQuestionHandler = async (req, res, next) => {
  try {
    const { projectId, questionId } = req.params;
    const project = await loadOwnedProject(projectId, req.teacher._id);

    const qIndex = findQuestionIndex(project, questionId);
    if (qIndex === -1) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }

    project.generatedQuestions.splice(qIndex, 1);
    await project.save();

    return res.status(200).json({
      success:        true,
      deletedId:      questionId,
      totalQuestions: project.generatedQuestions.length,
      totalMarks:     sumMarks(project.generatedQuestions),
      questions:      project.generatedQuestions.map(formatQuestion),
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/questions/regenerate-single
// ─────────────────────────────────────────────────────────────────────────────
const regenerateSingleHandler = async (req, res, next) => {
  try {
    const { projectId, questionId, questionType, topicName, marks, difficulty } = req.body;

    if (!projectId || !questionId) {
      return res.status(400).json({ success: false, error: 'projectId and questionId are required' });
    }

    const project = await loadOwnedProject(projectId, req.teacher._id);

    const sourceDocuments = await loadSourceDocuments(project._id);
    if (!sourceDocuments.length) {
      return res.status(400).json({ success: false, error: 'No readable text in uploaded PDFs.' });
    }

    const qIndex = findQuestionIndex(project, questionId);
    if (qIndex === -1) {
      return res.status(404).json({ success: false, error: 'Question not found in this project' });
    }

    const existing = project.generatedQuestions[qIndex];
    const qType  = questionType || existing.type || 'ShortAnswer';
    const qMarks = marks        || existing.marks || 5;
    const qDiff  = difficulty   || existing.difficulty || 'Medium';
    const qTopic = topicName     || existing.topicName || 'General';

    const singleConfig = {
      examInfo: {
        examTitle:       project.examInfo?.examTitle || project.title,
        subject:         project.examInfo?.subject || project.subject || '',
        totalMarks:      qMarks,
        durationMinutes: 90,
        instructions:    [],
        questionTypes:   { [qType]: { count: 1, marks: qMarks } },
      },
      topics: enrichTopics(
        [{ topicName: qTopic, marks: qMarks, difficulty: qDiff }],
        project
      ),
    };

    const result = await generateQuestions(singleConfig, sourceDocuments, {
      avoidEvidence: [existing.sourceEvidence],
    });
    const newQ = result.questions[0];
    if (!newQ) {
      return res.status(500).json({ success: false, error: 'LLM returned no question.' });
    }

    existing.questionText   = newQ.questionText;
    existing.options        = newQ.options || [];
    existing.correctAnswer  = newQ.correctAnswer;
    existing.explanation    = newQ.explanation;
    existing.sourceEvidence = newQ.sourceEvidence || '';
    existing.sourceFile     = newQ.sourceFile || '';
    existing.sourcePage     = newQ.sourcePage ?? null;
    existing.grounded       = newQ.grounded ?? false;
    existing.groundingScore = newQ.groundingScore ?? 0;
    existing.approved       = false;

    await project.save();

    return res.status(200).json({
      success:    true,
      question:   formatQuestion(existing),
      totalMarks: sumMarks(project.generatedQuestions),
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/questions/:projectId/approve-selection
// Body: { questionIds: string[] } — only these questions stay approved
// ─────────────────────────────────────────────────────────────────────────────
const approveSelectionHandler = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { questionIds } = req.body;

    if (!Array.isArray(questionIds)) {
      return res.status(400).json({ success: false, error: 'questionIds must be an array' });
    }

    const project = await loadOwnedProject(projectId, req.teacher._id);
    const idSet = new Set(questionIds.map(String));

    if (!idSet.size) {
      return res.status(400).json({ success: false, error: 'Select at least one question to approve.' });
    }

    let approvedCount = 0;
    project.generatedQuestions.forEach((q) => {
      const selected = idSet.has(q._id?.toString());
      q.approved = selected;
      if (selected) approvedCount += 1;
    });

    if (approvedCount === 0) {
      return res.status(400).json({ success: false, error: 'No matching questions found for the given IDs.' });
    }

    project.status = 'approved';
    await project.save();

    return res.status(200).json({
      success:        true,
      approvedCount,
      totalQuestions: project.generatedQuestions.length,
      questions:      project.generatedQuestions.map(formatQuestion),
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

module.exports = {
  uploadPDFs,
  generateQuestionsHandler,
  regenerateSingleHandler,
  getProjectQuestions,
  updateQuestionHandler,
  addQuestionHandler,
  deleteQuestionHandler,
  approveSelectionHandler,
};
