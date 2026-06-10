const express = require('express');
const router = express.Router();
const { uploadPDFs, generateQuestionsHandler } = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/upload-pdfs', protect, uploadPDFs);
router.post('/upload-pdf',  protect, uploadPDFs);  // legacy alias

// Generate questions from teacher config + LLM
router.post('/generate', protect, generateQuestionsHandler);

module.exports = router;