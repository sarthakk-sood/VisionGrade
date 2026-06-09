const { uploadPDFAsync } = require('../config/multer');
const { uploadAndParsePDF } = require('../services/pdfService');
const Project = require('../models/Project');
const SourceDocument = require('../models/sourceDocument');

// POST /api/questions/upload-pdfs
const uploadPDFs = async (req, res, next) => {
  try {
    // Step 1 — run multer
    await uploadPDFAsync(req, res);

    const files = [...(req.files?.pdf || []), ...(req.files?.pdfs || [])];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No PDF files provided' });
    }

    // Step 2 — create Project first
    const project = await Project.create({
      title:   req.body.title || 'Untitled Project',
      subject: req.body.subject || '',
      teacherId: req.teacher._id,
      status:  'uploaded',
    });

    // Step 3 — process each PDF in parallel
    const results = await Promise.all(
      files.map(async (file) => {
        const { url, publicId, extractedText, pageCount } =
          await uploadAndParsePDF(file.buffer, file.originalname);

        // Save each as its own SourceDocument
        const doc = await SourceDocument.create({
          teacherId:     req.teacher._id,
          projectId:     project._id,
          filename:      file.originalname,
          pdfUrl:        url,
          publicId,
          extractedText,
          pageCount,
          isSelected:    true,
        });

        return {
          docId:     doc._id,
          filename:  file.originalname,
          pageCount,
          pdfUrl:    url,
          extractedTextPreview: extractedText.substring(0, 200) + '...',
        };
      })
    );

    // Step 4 — link all SourceDocuments to Project
    project.sourceDocs = results.map(r => r.docId);
    await project.save();

    res.status(201).json({
      success:   true,
      projectId: project._id,
      title:     project.title,
      documents: results,
    });

  } catch (err) {
    next(err);
  }
};

module.exports = { uploadPDFs };