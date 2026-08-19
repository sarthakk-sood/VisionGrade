/**
 * routes/ocr.js — Module 2: upload and store student answer sheets.
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const os       = require('os');
const fs       = require('fs');

const { protect } = require('../middleware/authMiddleware');
const {
  extractAnswerSheet,
  listAnswerSheets,
  getAnswerSheet,
  updateOcrText,
  ocrServiceHealth,
} = require('../controllers/ocrController');

const router = express.Router();

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dest = path.join(os.tmpdir(), 'vg_ocr_uploads');
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/bmp',
      'image/webp',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type: accepted formats are PDF, JPEG, PNG, TIFF, BMP, WEBP.'), false);
    }
  },
});

router.get('/service-health', ocrServiceHealth);
router.get('/session/:sessionId', protect, listAnswerSheets);
router.post('/extract', protect, upload.single('pdf'), extractAnswerSheet);
router.patch('/:sheetId/text', protect, updateOcrText);
router.get('/:sheetId', protect, getAnswerSheet);

module.exports = router;
