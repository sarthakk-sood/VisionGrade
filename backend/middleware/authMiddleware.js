const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.teacher = await Teacher.findById(decoded.id).select('-password');

    if (!req.teacher) {
      return res.status(401).json({ success: false, error: 'Teacher not found' });
    }

    if (!req.teacher.isVerified) {
      return res.status(403).json({ message: "Account not verified. Please verify your email." });
    }

    next();
  } catch (err) {
    console.warn(`[AUTH] Token verification failed: ${err.message} — IP: ${req.ip}`);
    return res.status(401).json({ success: false, error: 'Not authorized, invalid token' });
  }
};

module.exports = { protect };