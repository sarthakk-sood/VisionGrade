const { uploadPDFAsync } = require('../config/multer');
const { uploadAndParsePDF } = require('../services/pdfService');
const Project = require('../models/Project');
const SourceDocument = require('../models/sourceDocument');
const { generateQuestions } = require('../services/questionGenerationService');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/questions/upload-pdfs
// ─────────────────────────────────────────────────────────────────────────────
const uploadPDFs = async (req, res, next) => {
  try {
    await uploadPDFAsync(req, res);

    const files = [...(req.files?.pdf || []), ...(req.files?.pdfs || [])];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No PDF files provided' });
    }

    const project = await Project.create({
      title:   req.body.title || 'Untitled Project',
      subject: req.body.subject || '',
      teacherId: req.teacher._id,
      status:  'uploaded',
    });

    const results = await Promise.all(
      files.map(async (file) => {
        const { url, publicId, extractedText, pageCount } =
          await uploadAndParsePDF(file.buffer, file.originalname);

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/questions/generate
//
// Body: {
//   projectId            : string,
//   examInfo             : { examTitle, totalMarks, durationMinutes, instructions?, questionTypes: { MCQ: { count, marks }, ... } }
//   topics               : [{ topicName, weightage, marks, difficulty }]
// }
// ─────────────────────────────────────────────────────────────────────────────
const generateQuestionsHandler = async (req, res, next) => {
  try {
    const { projectId, examInfo, topics } = req.body;

    // ── Validate required fields ──────────────────────────────────────────────
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId is required' });
    }
    if (!examInfo?.examTitle || !examInfo?.totalMarks) {
      return res.status(400).json({ success: false, error: 'examInfo.examTitle and examInfo.totalMarks are required' });
    }
    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ success: false, error: 'topics array is required and must not be empty' });
    }

    // ── Load project & verify ownership ──────────────────────────────────────
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (project.teacherId.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorised to access this project' });
    }

    // ── Fetch source documents ────────────────────────────────────────────────
    const docs = await SourceDocument.find({ projectId: project._id, isSelected: true });
    if (!docs || docs.length === 0) {
      return res.status(400).json({ success: false, error: 'No source documents found. Please upload PDFs first.' });
    }

    const extractedTexts = docs
      .map(d => d.extractedText || '')
      .filter(t => t.trim().length > 0);

    if (extractedTexts.length === 0) {
      return res.status(400).json({ success: false, error: 'No readable text found in uploaded PDFs.' });
    }

    // ── Build config for the LLM service ─────────────────────────────────────
    const config = {
      examInfo: {
        examTitle:       examInfo.examTitle,
        subject:         examInfo.subject || project.subject || project.detectedSubject || '',
        totalMarks:      examInfo.totalMarks,
        durationMinutes: examInfo.durationMinutes || 90,
        instructions:    examInfo.instructions    || [],
        questionTypes:   examInfo.questionTypes   || {},
      },
      topics,
    };

    console.log(`[questionController] Generating ${topics.length} topic(s) for project ${projectId}…`);

    // ── Call LLM service ──────────────────────────────────────────────────────
    const result = await generateQuestions(config, extractedTexts);

    // ── Persist to Project ────────────────────────────────────────────────────
    project.examInfo             = config.examInfo;
    project.generatedQuestions   = result.questions;
    project.generationProvider   = result.provider;
    project.status               = 'paper_generated';

    // Also save topic config back to project
    project.topics = project.topics.map(dbTopic => {
      const incoming = topics.find(t => t.topicName === dbTopic.name);
      if (!incoming) return dbTopic;
      dbTopic.marks         = incoming.marks         ?? dbTopic.marks;
      dbTopic.weightage     = incoming.weightage     ?? dbTopic.weightage;
      dbTopic.difficulty    = incoming.difficulty    ?? dbTopic.difficulty;
      return dbTopic;
    });

    await project.save();

    console.log(`[questionController] ${result.questions.length} questions generated via ${result.provider} for project ${projectId}`);

    return res.status(200).json({
      success:        true,
      projectId:      project._id,
      provider:       result.provider,
      usage:          result.usage,
      totalQuestions: result.totalQuestions,
      totalMarks:     result.totalMarks,
      questions:      result.questions,
    });

  } catch (err) {
    next(err);
  }
};

module.exports = { uploadPDFs, generateQuestionsHandler };