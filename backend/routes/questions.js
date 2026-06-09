const express = require('express');
const router = express.Router();
const { uploadPDF } = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');

// All question routes require login
router.post('/upload-pdf', protect, uploadPDF);

module.exports = router;