const path = require('path');
const axios = require('axios');
const cloudinary = require('../config/cloudinary');

const MIME_FROM_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

const sanitizeSegment = (value, fallback = 'file') =>
  String(value || fallback)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80) || fallback;

/**
 * Persist an answer-sheet PDF/image on Cloudinary (free tier).
 * 40 typical scanned PDFs (~2–10 MB) are well within 25 GB storage.
 */
const uploadAnswerSheetFile = async (filePath, { originalName, rollNumber, sessionId } = {}) => {
  if (!filePath) throw new Error('No file path provided for Cloudinary upload');

  const publicId = [
    sanitizeSegment(sessionId, 'unassigned'),
    sanitizeSegment(rollNumber, 'roll'),
    Date.now(),
    sanitizeSegment(path.basename(originalName || 'sheet'), 'sheet'),
  ].join('-');

  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'vision-grade/answer-sheets',
    resource_type: 'auto',
    public_id: publicId,
    overwrite: false,
    use_filename: false,
    unique_filename: false,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    bytes: result.bytes,
    format: result.format,
  };
};

const guessMime = (sheet, headerMime, url) => {
  const raw = String(sheet.mimeType || headerMime || '').split(';')[0].trim().toLowerCase();
  if (raw === 'image/jpg') return 'image/jpeg';
  if (raw && raw !== 'application/octet-stream') return raw;
  const ext = String(sheet.originalFilename || url || '')
    .split('?')[0]
    .split('.')
    .pop()
    .toLowerCase();
  return MIME_FROM_EXT[ext] || 'image/jpeg';
};

/**
 * Download the stored sheet so Gemini can mark from the photo, not OCR text.
 */
const fetchAnswerSheetMedia = async (sheet) => {
  const url = sheet?.fileUrl;
  if (!url) return null;

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 45_000,
    maxContentLength: 20 * 1024 * 1024,
  });
  const buffer = Buffer.from(response.data);
  if (!buffer.length) return null;

  return {
    mimeType: guessMime(sheet, response.headers['content-type'], url),
    base64: buffer.toString('base64'),
    byteLength: buffer.length,
  };
};

module.exports = { uploadAnswerSheetFile, fetchAnswerSheetMedia };
