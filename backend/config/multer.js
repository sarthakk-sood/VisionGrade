const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '50');
const opts = { storage, fileFilter, limits: { fileSize: MAX_MB * 1024 * 1024 } };

// Accepts both 'pdf' and 'pdfs' field names, max 10 files
const uploadPDF = multer(opts).fields([
  { name: 'pdf',  maxCount: 10 },
  { name: 'pdfs', maxCount: 10 },
]);

const uploadSheets = multer(opts).array('sheets', 50);

const uploadPDFAsync = (req, res) =>
  new Promise((resolve, reject) => {
    uploadPDF(req, res, (err) => (err ? reject(err) : resolve()));
  });

const uploadSheetsAsync = (req, res) =>
  new Promise((resolve, reject) => {
    uploadSheets(req, res, (err) => (err ? reject(err) : resolve()));
  });

module.exports = { uploadPDFAsync, uploadSheetsAsync };