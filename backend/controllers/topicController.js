const Project        = require('../models/Project');
const SourceDocument = require('../models/sourceDocument');
const { detectTopics } = require('../services/llmService');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/topics/detect/:projectId
//
// Reads all SourceDocuments linked to the project, concatenates their
// extractedText, calls GPT-4o for topic detection, then persists the
// returned topics (all pre-selected) to the Project document.
// ─────────────────────────────────────────────────────────────────────────────
const detectProjectTopics = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // ── 1. Load project and verify ownership ─────────────────────────────────
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (project.teacherId.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorised to access this project' });
    }

    // ── 2. Fetch all source documents for this project ────────────────────────
    const docs = await SourceDocument.find({ projectId: project._id, isSelected: true });
    if (!docs || docs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No source documents found for this project. Please upload PDFs first.',
      });
    }

    // ── 3. Collect extracted text from each document ──────────────────────────
    const extractedTexts = docs
      .map(d => d.extractedText || '')
      .filter(t => t.trim().length > 0);

    if (extractedTexts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No text could be extracted from the uploaded PDFs. Please ensure the PDFs contain readable text.',
      });
    }

    // ── 4. Call GPT-4o for topic detection ────────────────────────────────────
    console.log(`[topicController] Detecting topics for project ${projectId} (${docs.length} docs)…`);
    const llmResult = await detectTopics(extractedTexts, project.subject || '');

    // ── 5. Persist topics to the project ─────────────────────────────────────
    // All topics default to isSelected: true — teacher unchecks unwanted ones.
    project.topics          = llmResult.topics.map(t => ({ ...t, isSelected: true }));
    project.detectedSubject = llmResult.subject;
    project.status          = 'topics_detected';
    await project.save();

    console.log(`[topicController] ${project.topics.length} topics saved via ${llmResult.provider} for project ${projectId}`);

    return res.status(200).json({
      success:         true,
      projectId:       project._id,
      detectedSubject: llmResult.subject,
      totalTopics:     llmResult.totalTopicsFound,
      provider:        llmResult.provider,   // "gpt-4o" or "gemini-1.5-flash"
      llmUsage:        llmResult.usage,
      topics:          project.topics,       // includes isSelected field
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/topics/:projectId
//
// Returns the persisted topics for a project so the frontend can render
// the check/uncheck UI without re-calling the LLM.
// ─────────────────────────────────────────────────────────────────────────────
const getProjectTopics = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).select(
      'topics detectedSubject subject status teacherId examInfo generatedQuestions generationProvider'
    );
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (project.teacherId.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorised to access this project' });
    }

    return res.status(200).json({
      success:            true,
      projectId:          project._id,
      status:             project.status,
      subject:            project.subject,
      detectedSubject:    project.detectedSubject,
      topics:             project.topics,
      examInfo:           project.examInfo,
      generatedQuestions: project.generatedQuestions,
      generationProvider: project.generationProvider,
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/topics/:projectId/selection
//
// Body: { topics: [{ id: 1, isSelected: true }, { id: 3, isSelected: false }, ...] }
//
// Allows the teacher to bulk-update the isSelected flag for any set of topics.
// Only the ids present in the request body are updated; others are untouched.
// ─────────────────────────────────────────────────────────────────────────────
const updateTopicSelection = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { topics: updates } = req.body;  // [{ id, isSelected }]

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must contain a non-empty "topics" array with { id, isSelected } entries.',
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (project.teacherId.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorised to update this project' });
    }

    // Build a quick lookup from the incoming update list
    const updateMap = new Map(updates.map((u) => [u.id, u]));

    // Apply changes to the embedded topics array
    project.topics = project.topics.map((topic) => {
      const patch = updateMap.get(topic.id);
      if (!patch) return topic;
      if (patch.isSelected !== undefined) topic.isSelected = patch.isSelected;
      if (patch.marks !== undefined) topic.marks = patch.marks;
      if (patch.weightage !== undefined) topic.weightage = patch.weightage;
      if (patch.difficulty !== undefined) topic.difficulty = patch.difficulty;
      return topic;
    });

    await project.save();

    const selectedCount = project.topics.filter(t => t.isSelected).length;

    return res.status(200).json({
      success:        true,
      projectId:      project._id,
      selectedCount,
      totalCount:     project.topics.length,
      topics:         project.topics,
    });

  } catch (err) {
    next(err);
  }
};

module.exports = { detectProjectTopics, getProjectTopics, updateTopicSelection };
