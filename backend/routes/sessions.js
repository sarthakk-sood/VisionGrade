const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  finalizeSession,
  listSessions,
  getSession,
  exportQuestionPaper,
  exportAnswerKey,
} = require('../controllers/sessionController');

router.get('/', protect, listSessions);
router.post('/finalize/:projectId', protect, finalizeSession);
router.get('/:sessionId/export/question-paper', protect, exportQuestionPaper);
router.get('/:sessionId/export/answer-key', protect, exportAnswerKey);
router.get('/:sessionId', protect, getSession);

module.exports = router;
