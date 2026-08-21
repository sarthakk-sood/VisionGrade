const express = require('express');
const router = express.Router();
const {
  uploadPDFs,
  generateQuestionsHandler,
  regenerateSingleHandler,
  getProjectQuestions,
  updateQuestionHandler,
  addQuestionHandler,
  deleteQuestionHandler,
  approveSelectionHandler,
} = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/upload-pdfs', protect, uploadPDFs);
router.post('/upload-pdf',  protect, uploadPDFs);  // legacy alias

router.post('/generate', protect, generateQuestionsHandler);
router.post('/regenerate-single', protect, regenerateSingleHandler);

router.get('/list/:projectId', protect, getProjectQuestions);
router.patch('/:projectId/approve-selection', protect, approveSelectionHandler);
router.post('/:projectId/add', protect, addQuestionHandler);
router.patch('/:projectId/:questionId', protect, updateQuestionHandler);
router.delete('/:projectId/:questionId', protect, deleteQuestionHandler);

module.exports = router;
