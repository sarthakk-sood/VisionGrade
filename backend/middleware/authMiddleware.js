const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');

/**
 * Standard JWT auth middleware.
 * Accepts the token either as:
 *   1. Authorization: Bearer <token>  header  (normal API calls)
 *   2. ?token=<token>                 query   (IDM / download managers that
 *                                              strip custom headers when they
 *                                              intercept a download URL)
 */
const protect = async (req, res, next) => {
  try {
    // 1. Try Authorization header first
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Fall back to ?token= query param (for IDM / download managers)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.teacher = await Teacher.findById(decoded.id).select('-password');

    if (!req.teacher) {
      return res.status(401).json({ success: false, error: 'Teacher not found' });
    }

    next();
  } catch (err) {
    console.warn(`[AUTH] Token verification failed: ${err.message} — IP: ${req.ip}`);
    return res.status(401).json({ success: false, error: 'Not authorized, invalid token' });
  }
};

module.exports = { protect };