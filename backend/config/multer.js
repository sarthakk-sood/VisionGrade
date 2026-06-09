const multer = require('multer');

// Store in memory — Cloudinary upload handles saving to cloud
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

const uploadPDF = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
}).single('pdf');

const uploadSheets = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
}).array('sheets', 50);

// Promise wrappers for async/await in controllers
const uploadPDFAsync = (req, res) =>
  new Promise((resolve, reject) => {
    uploadPDF(req, res, (err) => (err ? reject(err) : resolve()));
  });

const uploadSheetsAsync = (req, res) =>
  new Promise((resolve, reject) => {
    uploadSheets(req, res, (err) => (err ? reject(err) : resolve()));
  });

module.exports = { uploadPDFAsync, uploadSheetsAsync };