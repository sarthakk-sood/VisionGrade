require('dotenv').config();
const authRoutes = require('./routes/auth');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const errorHandler = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');
const healthRoutes = require('./routes/health');
const questionRoutes = require('./routes/questions');
const topicRoutes    = require('./routes/topics');
// const evaluationRoutes = require('./routes/evaluation'); // uncomment when ready

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Global limiter — all API routes
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later.' },
}));

// Strict limiter — auth routes (brute-force protection)
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many auth attempts, try again in 15 minutes.' },
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
// Keep JSON limit small — file uploads go through Multer (multipart), not JSON
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Static uploads ────────────────────────────────────────────────────────────
// No static file serving needed — all uploads go to Cloudinary (cloud storage)
// Serving the local /uploads folder publicly is a security risk; route removed.

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/auth', authRoutes);
// app.use('/api/evaluation', evaluationRoutes);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;