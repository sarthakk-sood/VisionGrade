/**
 * ocrController.js — Module 2: upload and store a student answer sheet.
 * Scoring reads the photo directly with a vision LLM (Gemini, then Groq as
 * fallback). No OCR is performed at upload time.
 */

const fs          = require('fs');
const mongoose    = require('mongoose');
const AnswerSheet = require('../models/answer-sheet');
const ExamSession = require('../models/ExamSession');
const { uploadAnswerSheetFile } = require('../services/documentService');

const assertOwnedSession = async (sessionId, teacherId) => {
  if (!sessionId) return null;
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    const err = new Error('Invalid session ID');
    err.statusCode = 400;
    throw err;
  }
  const session = await ExamSession.findById(sessionId).select('teacherId examTitle questionCount');
  if (!session) {
    const err = new Error('Exam session not found');
    err.statusCode = 404;
    throw err;
  }
  if (session.teacherId.toString() !== teacherId.toString()) {
    const err = new Error('Not authorised for this exam session');
    err.statusCode = 403;
    throw err;
  }
  return session;
};

const extractAnswerSheet = async (req, res, next) => {
  const file = req.file;

  if (!file) {
    res.status(400);
    return next(new Error('No file uploaded. Send the file under the field name "pdf".'));
  }

  const { rollNumber, studentName, sessionId } = req.body;

  if (!rollNumber?.trim()) {
    _cleanFile(file.path);
    res.status(400);
    return next(new Error('"rollNumber" is required in the request body.'));
  }

  if (!sessionId) {
    _cleanFile(file.path);
    res.status(400);
    return next(new Error('"sessionId" is required. Select a finalized exam session first.'));
  }

  let storedFile = null;

  try {
    await assertOwnedSession(sessionId, req.teacher._id);

    storedFile = await uploadAnswerSheetFile(file.path, {
      originalName: file.originalname,
      rollNumber: rollNumber.trim(),
      sessionId: sessionId || 'unassigned',
    });
  } catch (err) {
    _cleanFile(file.path);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error('[ocrController] Upload failed:', err.message);
    return next(err);
  }

  _cleanFile(file.path);

  let sheetDoc = null;
  try {
    sheetDoc = await AnswerSheet.findOneAndUpdate(
      { teacherId: req.teacher._id, sessionId, rollNumber: rollNumber.trim() },
      {
        teacherId: req.teacher._id,
        sessionId: sessionId || null,
        rollNumber: rollNumber.trim(),
        studentName: studentName?.trim() || '',
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileUrl: storedFile.url,
        filePublicId: storedFile.publicId,
        fileResourceType: storedFile.resourceType,
        status: 'uploaded',
        evaluationId: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (dbErr) {
    console.error('[ocrController] MongoDB persist failed:', dbErr.message);
  }

  return res.status(200).json({
    success: true,
    message: 'Answer sheet stored. Scoring will read the photo/PDF with a vision LLM against the marking scheme.',
    data: {
      answerSheetId: sheetDoc?._id ?? null,
      rollNumber: rollNumber.trim(),
      studentName: studentName?.trim() || null,
      sessionId: sessionId || null,
      fileUrl: storedFile.url,
    },
  });
};

const listAnswerSheets = async (req, res, next) => {
  try {
    const session = await assertOwnedSession(req.params.sessionId, req.teacher._id);
    const sheets = await AnswerSheet.find({
      teacherId: req.teacher._id,
      sessionId: session._id,
    })
      .sort({ createdAt: 1 });

    return res.json({
      success: true,
      sheets: sheets.map((s) => ({
        id: s._id,
        rollNumber: s.rollNumber,
        studentName: s.studentName,
        status: s.status,
        fileUrl: s.fileUrl,
        mimeType: s.mimeType,
        originalFilename: s.originalFilename,
        evaluationId: s.evaluationId,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, error: err.message });
    next(err);
  }
};

const getAnswerSheet = async (req, res, next) => {
  try {
    const sheet = await AnswerSheet.findById(req.params.sheetId).lean();
    if (!sheet) {
      res.status(404);
      return next(new Error('Answer sheet not found.'));
    }
    if (sheet.teacherId && sheet.teacherId.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorised' });
    }
    return res.json({ success: true, data: sheet });
  } catch (err) {
    return next(err);
  }
};

function _cleanFile(filePath) {
  try { if (filePath) fs.unlinkSync(filePath); } catch { /* ignore */ }
}

module.exports = {
  extractAnswerSheet,
  listAnswerSheets,
  getAnswerSheet,
};
