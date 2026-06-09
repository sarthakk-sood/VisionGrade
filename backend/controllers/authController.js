const Teacher = require('../models/Teacher');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }

    const existing = await Teacher.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const teacher = await Teacher.create({ name, email, password, department });

    res.status(201).json({
      success: true,
      token: generateToken(teacher._id),
      teacher: {
        id:         teacher._id,
        name:       teacher.name,
        email:      teacher.email,
        department: teacher.department,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await teacher.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    res.json({
      success: true,
      token: generateToken(teacher._id),
      teacher: {
        id:         teacher._id,
        name:       teacher.name,
        email:      teacher.email,
        department: teacher.department,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({
    success: true,
    teacher: {
      id:          req.teacher._id,
      name:        req.teacher.name,
      email:       req.teacher.email,
      department:  req.teacher.department,
      institution: req.teacher.institution,
    },
  });
};

module.exports = { register, login, getMe };