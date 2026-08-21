const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  evaluateOneSheet,
  evaluateAllSheets,
  listReports,
  overrideMarks,
  getOverview,
  exportReportPdf,
} = require('../controllers/evaluationController');

const router = express.Router();

router.use(protect);

router.get('/overview', getOverview);
router.post('/sheets/:sheetId', evaluateOneSheet);
router.post('/sessions/:sessionId/evaluate-all', evaluateAllSheets);
router.get('/sessions/:sessionId', listReports);
router.patch('/reports/:reportId/override', overrideMarks);
router.get('/reports/:reportId/export/pdf', exportReportPdf);

module.exports = router;
