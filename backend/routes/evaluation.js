const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  evaluateOneSheet,
  evaluateAllSheets,
  listReports,
  overrideMarks,
  getOverview,
} = require('../controllers/evaluationController');

const router = express.Router();

router.use(protect);

router.get('/overview', getOverview);
router.post('/sheets/:sheetId', evaluateOneSheet);
router.post('/sessions/:sessionId/evaluate-all', evaluateAllSheets);
router.get('/sessions/:sessionId', listReports);
router.patch('/reports/:reportId/override', overrideMarks);

module.exports = router;
