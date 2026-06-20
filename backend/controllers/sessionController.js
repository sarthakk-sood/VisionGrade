const Project = require('../models/Project');
const ExamSession = require('../models/ExamSession');
const SourceDocument = require('../models/sourceDocument');
const { generateModelAnswers } = require('../services/answerGenerationService');
const { buildQuestionPaperLatex, buildAnswerKeyLatex } = require('../services/latexExportService');
const { compileLatexToPdf } = require('../services/latexCompileService');
const { sanitizeFilename } = require('../utils/latexEscape');

const VALID_SESSION_DIFFICULTY = ['Easy', 'Medium', 'Hard'];
const sanitizeDifficulty = (d) => (VALID_SESSION_DIFFICULTY.includes(d) ? d : 'Medium');

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

const loadOwnedSession = async (sessionId, teacherId) => {
  const session = await ExamSession.findById(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.statusCode = 404;
    throw err;
  }
  if (session.teacherId.toString() !== teacherId.toString()) {
    const err = new Error('Not authorised');
    err.statusCode = 403;
    throw err;
  }
  if (!session.questions?.length) {
    const err = new Error('Session has no questions to export');
    err.statusCode = 400;
    throw err;
  }
  return session;
};

const sendPdfExport = async (res, session, texBuilder, suffix) => {
  const tex = texBuilder(session);
  const base = sanitizeFilename(`${session.examTitle || 'exam'}-${suffix}`);
  const pdf = await compileLatexToPdf(tex, base);
  const filename = `${base}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdf.length);
  return res.status(200).send(pdf);
};

const collectSourceTexts = async (project) => {
  const docs = await SourceDocument.find({ projectId: project._id });
  const selected = docs.length
    ? docs.filter((d) => d.isSelected !== false)
    : [];

  const texts = selected
    .map((d) => (d.extractedText || '').trim())
    .filter(Boolean);

  if (project.extractedText?.trim()) {
    texts.push(project.extractedText.trim());
  }

  return [...new Set(texts)];
};

const buildFallbackAnswers = (approvedPayload) =>
  approvedPayload.map((q, i) => ({
    questionNumber: i + 1,
    correctAnswer:  q.correctAnswer || '',
    modelAnswer:    q.correctAnswer || q.explanation || '',
    markingScheme:  `Full marks (${q.marks}): complete and accurate answer.`,
    explanation:    q.explanation || '',
  }));

const formatSession = (session) => ({
  id:              session._id,
  projectId:       session.projectId,
  examTitle:       session.examTitle,
  subject:         session.subject,
  totalMarks:      session.totalMarks,
  durationMinutes: session.durationMinutes,
  questionCount:   session.questionCount,
  status:          session.status,
  answerProvider:  session.answerProvider,
  finalizedAt:     session.finalizedAt,
  createdAt:       session.createdAt,
  questions:       session.questions.map((q) => ({
    id:             q._id?.toString(),
    questionNumber: q.questionNumber,
    topicName:      q.topicName,
    type:           q.type,
    difficulty:     q.difficulty,
    marks:          q.marks,
    questionText:   q.questionText,
    options:        q.options?.length ? q.options : null,
    correctAnswer:  q.correctAnswer,
    modelAnswer:    q.modelAnswer,
    markingScheme:  q.markingScheme,
    explanation:    q.explanation,
  })),
});

// POST /api/sessions/finalize/:projectId
const finalizeSession = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = await loadOwnedProject(projectId, req.teacher._id);

    const approved = project.generatedQuestions.filter((q) => q.approved);
    if (!approved.length) {
      return res.status(400).json({
        success: false,
        error: 'No approved questions found. Approve at least one question before finalizing.',
      });
    }

    const extractedTexts = await collectSourceTexts(project);

    const examInfo = {
      examTitle:       project.examInfo?.examTitle || project.title,
      subject:         project.examInfo?.subject || project.subject || project.detectedSubject || '',
      totalMarks:      project.examInfo?.totalMarks || approved.reduce((s, q) => s + (q.marks || 0), 0),
      durationMinutes: project.examInfo?.durationMinutes || 90,
    };

    const approvedPayload = approved.map((q) => ({
      _id:           q._id,
      topicName:     q.topicName,
      type:          q.type,
      difficulty:    q.difficulty,
      marks:         q.marks,
      questionText:  q.questionText,
      options:       q.options,
      correctAnswer: q.correctAnswer,
      explanation:   q.explanation,
    }));

    let llmAnswers = [];
    let provider = 'fallback-existing';

    try {
      const result = await generateModelAnswers(approvedPayload, extractedTexts, examInfo);
      llmAnswers = result.answers;
      provider = result.provider;
    } catch (llmErr) {
      console.warn('[sessionController] LLM answer generation failed, using existing answers:', llmErr.message);
      llmAnswers = buildFallbackAnswers(approvedPayload);
      provider = 'fallback-existing';
    }

    const sessionQuestions = approvedPayload.map((q, i) => {
      const llm = llmAnswers[i] || {};
      // Guard: verify the LLM answer index matches the question (questionNumber should be i+1)
      if (llm.questionNumber && llm.questionNumber !== i + 1) {
        console.warn(
          `[sessionController] Answer index mismatch at position ${i}: ` +
          `expected questionNumber ${i + 1}, got ${llm.questionNumber}. ` +
          `Using positional assignment — check LLM batch numbering.`
        );
      }
      return {
        sourceQuestionId: q._id,
        questionNumber:   i + 1,
        topicName:        q.topicName,
        type:             q.type,
        difficulty:       sanitizeDifficulty(q.difficulty),
        marks:            q.marks,
        questionText:     q.questionText,
        options:          q.options || [],
        correctAnswer:    llm.correctAnswer || q.correctAnswer || '',
        modelAnswer:      llm.modelAnswer || q.correctAnswer || q.explanation || '',
        markingScheme:    llm.markingScheme || `Full marks (${q.marks}): accurate complete answer.`,
        explanation:      llm.explanation || q.explanation || '',
      };
    });

    console.log('[sessionController] Question-answer pairing check:');
    sessionQuestions.forEach((sq) => {
      console.log(
        `  Q${sq.questionNumber} [${sq.type}]: "${sq.questionText?.slice(0, 50)}…" → answer: "${sq.correctAnswer?.slice(0, 40) || '(empty)'}"`
      );
    });

    // Sync enriched answers back to approved project subdocuments
    approved.forEach((q, i) => {
      const sq = sessionQuestions[i];
      q.correctAnswer = sq.correctAnswer;
      q.modelAnswer   = sq.modelAnswer;
      q.markingScheme = sq.markingScheme;
      q.explanation   = sq.explanation;
    });
    project.status = 'approved';
    await project.save();

    const totalMarks = sessionQuestions.reduce((s, q) => s + (q.marks || 0), 0);

    const session = await ExamSession.findOneAndUpdate(
      { projectId: project._id },
      {
        projectId:       project._id,
        teacherId:       req.teacher._id,
        examTitle:       examInfo.examTitle,
        subject:         examInfo.subject,
        totalMarks,
        durationMinutes: examInfo.durationMinutes,
        questionCount:   sessionQuestions.length,
        status:          'finalized',
        questions:         sessionQuestions,
        answerProvider:    provider,
        finalizedAt:       new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[sessionController] Session finalized — ${sessionQuestions.length} questions, provider: ${provider}`);

    return res.status(200).json({
      success: true,
      session: formatSession(session),
      message: `${sessionQuestions.length} approved question(s) saved with LLM model answers.`,
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

// GET /api/sessions
const listSessions = async (req, res, next) => {
  try {
    const sessions = await ExamSession.find({ teacherId: req.teacher._id })
      .sort({ finalizedAt: -1 })
      .select('-questions');

    return res.status(200).json({
      success: true,
      sessions: sessions.map((s) => ({
        id:            s._id,
        projectId:     s.projectId,
        examTitle:     s.examTitle,
        subject:       s.subject,
        totalMarks:    s.totalMarks,
        questionCount: s.questionCount,
        status:        s.status,
        answerProvider: s.answerProvider,
        finalizedAt:   s.finalizedAt,
        createdAt:     s.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/sessions/:sessionId
const getSession = async (req, res, next) => {
  try {
    const session = await ExamSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (session.teacherId.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorised' });
    }

    return res.status(200).json({
      success: true,
      session: formatSession(session),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/sessions/:sessionId/export/question-paper
const exportQuestionPaper = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.sessionId, req.teacher._id);
    await sendPdfExport(res, session, buildQuestionPaperLatex, 'question-paper');
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

// GET /api/sessions/:sessionId/export/answer-key
const exportAnswerKey = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.sessionId, req.teacher._id);
    await sendPdfExport(res, session, buildAnswerKeyLatex, 'answer-key');
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

module.exports = {
  finalizeSession,
  listSessions,
  getSession,
  exportQuestionPaper,
  exportAnswerKey,
};
