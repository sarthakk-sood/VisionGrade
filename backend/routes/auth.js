const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me  (protected)
router.get('/me', protect, getMe);

// PATCH /api/auth/profile  (protected)
router.patch('/profile', protect, updateProfile);

// PATCH /api/auth/password  (protected)
router.patch('/password', protect, changePassword);

// POST /api/auth/logout — client clears JWT locally; no server-side session store
router.post('/logout', (_req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

module.exports = router;