/**
 * routes/ocr.js — Module 2: Answer Sheet Text Extraction
 *
 * POST /api/ocr/extract
 *   Upload a PDF answer sheet with a student roll number.
 *   Multer writes the file to a temp directory; the controller deletes it after OCR.
 *
 * GET /api/ocr/service-health
 *   Check whether the Python TrOCR microservice is reachable.
 *
 * GET /api/ocr/:sheetId
 *   Retrieve a previously extracted AnswerSheet from MongoDB.
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const os       = require('os');
const fs       = require('fs');

const { protect }          = require('../middleware/authMiddleware');
const {
  extractAnswerSheet,
  getAnswerSheet,
  ocrServiceHealth,
}                          = require('../controllers/ocrController');

const router = express.Router();

// ── Multer: write to OS temp dir, delete after processing ──────────────────────
// DiskStorage is used (not memoryStorage) so the Python microservice can be given
// a file path directly (avoiding piping large byte arrays through Node memory).
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dest = path.join(os.tmpdir(), 'vg_ocr_uploads');
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      // Sanitise: keep only safe chars, prepend timestamp for uniqueness
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: {
    fileSize: (parseInt(process.env.MAX_PDF_MB, 10) || 50) * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type: accepted formats are PDF, JPEG, PNG, TIFF, BMP, WEBP.'), false);
    }
  },
});

// ── Routes ─────────────────────────────────────────────────────────────────────

// POST /api/ocr/extract
// Body (multipart/form-data):
//   pdf         — File (required)
//   rollNumber  — string (required)
//   studentName — string (optional)
//   sessionId   — string (optional, links to ExamSession)
router.post('/extract', protect, upload.single('pdf'), extractAnswerSheet);

// GET /api/ocr/service-health — no auth needed (ops/monitoring)
router.get('/service-health', ocrServiceHealth);

// GET /api/ocr/:sheetId — fetch stored result
router.get('/:sheetId', protect, getAnswerSheet);

module.exports = router;
