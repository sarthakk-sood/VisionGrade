const express = require('express');
const router = express.Router();
const { uploadPDFs } = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/upload-pdfs', protect, uploadPDFs);
// legacy/single-file route alias for clients using singular path
router.post('/upload-pdf', protect, uploadPDFs);

module.exports = router;