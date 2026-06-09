const { uploadPDFAsync } = require('../config/multer');
const { uploadAndParsePDF } = require('../services/pdfService');
const Project = require('../models/Project');

// POST /api/questions/upload-pdf
const uploadPDF = async (req, res, next) => {
  try {
    // Step 1 — run multer
    await uploadPDFAsync(req, res);

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file provided' });
    }

    const { originalname, buffer } = req.file;

    // Step 2 — upload to Cloudinary + extract text
    const { url, publicId, extractedText, pageCount } = await uploadAndParsePDF(buffer, originalname);

    if (!extractedText || extractedText.length < 50) {
      return res.status(422).json({
        success: false,
        error: 'Could not extract enough text from this PDF. Make sure it is not a scanned image.',
      });
    }

    // Step 3 — save project to MongoDB
    const project = await Project.create({
      title:         req.body.title || originalname.replace('.pdf', ''),
      subject:       req.body.subject || '',
      pdfPath:       url,
      extractedText,
      status:        'uploaded',
    });

    res.status(201).json({
      success:       true,
      projectId:     project._id,
      title:         project.title,
      pageCount,
      pdfUrl:        url,
      extractedText: extractedText.substring(0, 500) + '...', // preview only
    });

  } catch (err) {
    next(err);
  }
};

module.exports = { uploadPDF };