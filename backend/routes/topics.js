const express = require('express');
const router  = express.Router();

const {
  detectProjectTopics,
  getProjectTopics,
  updateTopicSelection,
} = require('../controllers/topicController');
const { protect } = require('../middleware/authMiddleware');

// POST   /api/topics/detect/:projectId  — trigger GPT-4o topic detection
router.post('/detect/:projectId', protect, detectProjectTopics);

// GET    /api/topics/:projectId          — fetch stored topics for a project
router.get('/:projectId', protect, getProjectTopics);

// PATCH  /api/topics/:projectId/selection — teacher checks/unchecks topics
router.patch('/:projectId/selection', protect, updateTopicSelection);

module.exports = router;
