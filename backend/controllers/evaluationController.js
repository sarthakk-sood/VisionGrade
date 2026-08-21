const mongoose = require('mongoose');
const ExamSession = require('../models/ExamSession');
const AnswerSheet = require('../models/answer-sheet');
const EvaluationReport = require('../models/evaluation-report');
const { evaluateAnswerSheet } = require('../services/evaluationService');
const { fetchAnswerSheetMedia } = require('../services/documentService');
const { LLM_BATCH_PAUSE_MS, sleep } = require('../utils/llmUtils');
const { buildEvaluationReportLatex } = require('../services/latexExportService');
const { compileLatexToPdf } = require('../services/latexCompileService');
const { sanitizeFilename } = require('../utils/latexEscape');

const loadOwnedSession = async (sessionId, teacherId, { requireQuestions = false } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    const err = new Error('Invalid session ID');
    err.statusCode = 400;
    throw err;
  }
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
  if (requireQuestions && !session.questions?.length) {
    const err = new Error('This session has no answer key. Finalise Module 1 first.');
    err.statusCode = 400;
    throw err;
  }
  return session;
};

const formatReport = (report) => ({
  id: report._id,
  sessionId: report.sessionId,
  answerSheetId: report.answerSheetId,
  projectId: report.projectId,
  studentName: report.studentName,
  rollNumber: report.rollNumber,
  totalMarks: report.totalMarks,
  marksObtained: report.marksObtained,
  percentage: report.percentage,
  status: report.status,
  provider: report.provider,
  questionEvals: report.questionEvals,
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
});

const persistEvaluation = async ({ session, sheet, graded }) => {
  const payload = {
    projectId: session.projectId,
    sessionId: session._id,
    answerSheetId: sheet._id,
    teacherId: session.teacherId,
    studentName: sheet.studentName,
    rollNumber: sheet.rollNumber,
    totalMarks: graded.totalMarks,
    marksObtained: graded.marksObtained,
    percentage: graded.percentage,
    questionEvals: graded.questionEvals,
    provider: graded.provider,
    status: 'evaluated',
  };

  const report = await EvaluationReport.findOneAndUpdate(
    { answerSheetId: sheet._id },
    payload,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  sheet.status = 'evaluated';
  sheet.evaluationId = report._id;
  await sheet.save();

  return report;
};

const evaluateOneSheet = async (req, res, next) => {
  try {
    const sheet = await AnswerSheet.findById(req.params.sheetId);
    if (!sheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }
    if (sheet.teacherId && sheet.teacherId.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorised' });
    }
    if (!sheet.sessionId) {
      return res.status(400).json({ success: false, error: 'Answer sheet is not linked to an exam session' });
    }

    const session = await loadOwnedSession(sheet.sessionId, req.teacher._id, { requireQuestions: true });
    let sheetMedia = null;
    try {
      sheetMedia = await fetchAnswerSheetMedia(sheet);
    } catch (mediaErr) {
      console.warn('[evaluation] Could not download sheet image:', mediaErr.message);
    }
    const graded = await evaluateAnswerSheet({
      questions: session.questions,
      sheetMedia,
      examInfo: {
        examTitle: session.examTitle,
        subject: session.subject,
        totalMarks: session.totalMarks,
      },
    });

    const report = await persistEvaluation({ session, sheet, graded });
    return res.json({ success: true, report: formatReport(report) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

const evaluateAllSheets = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.sessionId, req.teacher._id, { requireQuestions: true });
    const sheets = await AnswerSheet.find({
      sessionId: session._id,
      teacherId: req.teacher._id,
      $or: [
        { status: 'evaluated' },
        { fileUrl: { $exists: true, $ne: '' } },
      ],
    }).sort({ createdAt: 1 });

    if (!sheets.length) {
      return res.status(400).json({
        success: false,
        error: 'No uploaded answer sheets found for this session.',
      });
    }

    const reports = [];
    const errors = [];

    for (let i = 0; i < sheets.length; i++) {
      if (i > 0 && LLM_BATCH_PAUSE_MS > 0) await sleep(LLM_BATCH_PAUSE_MS);
      const sheet = sheets[i];
      try {
        let sheetMedia = null;
        try {
          sheetMedia = await fetchAnswerSheetMedia(sheet);
        } catch (mediaErr) {
          console.warn('[evaluation] Could not download sheet image:', mediaErr.message);
        }
        const graded = await evaluateAnswerSheet({
          questions: session.questions,
          sheetMedia,
          examInfo: {
            examTitle: session.examTitle,
            subject: session.subject,
            totalMarks: session.totalMarks,
          },
        });
        const report = await persistEvaluation({ session, sheet, graded });
        reports.push(formatReport(report));
      } catch (err) {
        errors.push({ sheetId: sheet._id, rollNumber: sheet.rollNumber, error: err.message });
      }
    }

    return res.json({
      success: errors.length < sheets.length,
      evaluated: reports.length,
      failed: errors.length,
      reports,
      errors,
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

const listReports = async (req, res, next) => {
  try {
    const session = await loadOwnedSession(req.params.sessionId, req.teacher._id);
    const reports = await EvaluationReport.find({
      sessionId: session._id,
      teacherId: req.teacher._id,
    }).sort({ rollNumber: 1 });

    const marks = reports.map((r) => r.percentage || 0);
    const avg = marks.length
      ? parseFloat((marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(1))
      : 0;

    return res.json({
      success: true,
      session: {
        id: session._id,
        examTitle: session.examTitle,
        subject: session.subject,
        totalMarks: session.totalMarks,
        questionCount: session.questionCount,
      },
      summary: {
        evaluated: reports.length,
        averagePercentage: avg,
        topPercentage: marks.length ? Math.max(...marks) : 0,
      },
      reports: reports.map(formatReport),
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

const overrideMarks = async (req, res, next) => {
  try {
    const report = await EvaluationReport.findById(req.params.reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Evaluation report not found' });
    }
    if (report.teacherId.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorised' });
    }

    const overrides = Array.isArray(req.body?.overrides) ? req.body.overrides : [];
    if (!overrides.length) {
      return res.status(400).json({ success: false, error: 'overrides[] is required' });
    }

    const byNumber = new Map(overrides.map((o) => [Number(o.questionNumber), o]));
    report.questionEvals = report.questionEvals.map((row) => {
      const patch = byNumber.get(Number(row.questionNumber));
      if (!patch) return row;
      const max = Number(row.maxMarks) || 0;
      const awarded = Math.max(0, Math.min(max, Number(patch.marksAwarded)));
      row.marksAwarded = awarded;
      row.isOverridden = true;
      row.overriddenMarks = awarded;
      if (typeof patch.feedback === 'string') row.feedback = patch.feedback;
      return row;
    });

    report.marksObtained = report.questionEvals.reduce(
      (sum, row) => sum + (Number(row.marksAwarded) || 0),
      0
    );
    report.status = 'approved';
    await report.save();

    return res.json({ success: true, report: formatReport(report) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/evaluation/overview
 * One row per exam session for the dashboard — evaluated/pending sheet
 * counts and average score — without the frontend needing to call
 * listReports() once per session.
 */
const getOverview = async (req, res, next) => {
  try {
    const teacherId = req.teacher._id;

    const [reportStats, sheetStats] = await Promise.all([
      EvaluationReport.aggregate([
        { $match: { teacherId } },
        {
          $group: {
            _id: '$sessionId',
            evaluated: { $sum: 1 },
            averagePercentage: { $avg: '$percentage' },
            lastEvaluatedAt: { $max: '$updatedAt' },
          },
        },
      ]),
      AnswerSheet.aggregate([
        { $match: { teacherId } },
        {
          $group: {
            _id: '$sessionId',
            uploaded: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'uploaded'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const sheetsBySession = new Map(sheetStats.map((s) => [String(s._id), s]));
    const overview = reportStats.map((r) => {
      const sheets = sheetsBySession.get(String(r._id)) || { uploaded: 0, pending: 0 };
      sheetsBySession.delete(String(r._id));
      return {
        sessionId: r._id,
        evaluated: r.evaluated,
        pending: sheets.pending,
        uploaded: sheets.uploaded,
        averagePercentage: r.averagePercentage ? parseFloat(r.averagePercentage.toFixed(1)) : 0,
        lastEvaluatedAt: r.lastEvaluatedAt,
      };
    });

    // Sessions with uploaded sheets but zero evaluations yet.
    for (const sheets of sheetsBySession.values()) {
      overview.push({
        sessionId: sheets._id,
        evaluated: 0,
        pending: sheets.pending,
        uploaded: sheets.uploaded,
        averagePercentage: 0,
        lastEvaluatedAt: null,
      });
    }

    return res.json({ success: true, overview });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/evaluation/reports/:reportId/export/pdf
 * A per-student PDF: each question, the student's answer, marks awarded, and
 * the step-marking breakdown that explains how the score was reached.
 */
const exportReportPdf = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ success: false, error: 'Invalid report ID' });
    }

    const report = await EvaluationReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Evaluation report not found' });
    }
    if (report.teacherId.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorised' });
    }

    const session = await ExamSession.findById(report.sessionId);
    const tex = buildEvaluationReportLatex(report, session);
    const base = sanitizeFilename(`${report.rollNumber || report.studentName || 'student'}-evaluation`);
    const pdf = await compileLatexToPdf(tex, base);
    const filename = `${base}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    return res.status(200).send(pdf);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

module.exports = {
  evaluateOneSheet,
  evaluateAllSheets,
  listReports,
  overrideMarks,
  getOverview,
  exportReportPdf,
};
