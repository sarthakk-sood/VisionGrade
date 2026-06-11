const Teacher = require('../models/Teacher');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOTPEmail } = require('../services/emailService');

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

    // Generate a cryptographically random 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    const teacher = await Teacher.create({
      name,
      email,
      password,
      department,
      isVerified: false,
      otp,
      otpExpiresAt,
    });

    // Send the verification email using nodemailer
    await sendOTPEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Please verify your account.',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/verify-otp
const verifyOTP = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const email = req.body.email?.toLowerCase().trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' });
    }

    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    if (teacher.otpExpiresAt < Date.now()) {
      return res.status(400).json({ success: false, error: 'OTP has expired. Please register again.' });
    }

    if (teacher.otp !== otp) {
      return res.status(400).json({ success: false, error: 'Invalid OTP.' });
    }

    // Update verification state
    teacher.isVerified = true;
    teacher.otp = null;
    teacher.otpExpiresAt = null;
    await teacher.save();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
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

    // Verify user is verified
    if (!teacher.isVerified) {
      return res.status(403).json({ success: false, error: 'Please verify your email before logging in.' });
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

module.exports = { register, login, getMe, verifyOTP };