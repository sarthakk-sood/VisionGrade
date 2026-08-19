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
    const { name, password, department } = req.body;
    const email = req.body.email?.toLowerCase().trim();

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
    const { password } = req.body;
    const email = req.body.email?.toLowerCase().trim();

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
const getMe = async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, department, institution } = req.body;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Name cannot be empty' });
    }

    const teacher = req.teacher;
    if (name !== undefined) teacher.name = String(name).trim();
    if (department !== undefined) teacher.department = String(department).trim();
    if (institution !== undefined) teacher.institution = String(institution).trim();
    await teacher.save();

    res.json({
      success: true,
      teacher: {
        id:          teacher._id,
        name:        teacher.name,
        email:       teacher.email,
        department:  teacher.department,
        institution: teacher.institution,
      },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    // req.teacher was loaded with .select('-password') by the auth middleware —
    // reload with the hash included so matchPassword() has something to compare.
    const teacher = await Teacher.findById(req.teacher._id);
    const isMatch = await teacher.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    teacher.password = newPassword;
    await teacher.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword };