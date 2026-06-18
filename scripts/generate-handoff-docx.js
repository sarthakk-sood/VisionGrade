/**
 * Generates TEAM_HANDOFF.docx at repo root.
 * Run: node scripts/generate-handoff-docx.js
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, WidthType, ShadingType,
} = require('docx');

const ADD = 'ADD YOURS HERE';

const h1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 } });
const h2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });
const h3 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 } });
const p = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, ...opts })],
  spacing: { after: 120 },
});
const bullet = (text) => new Paragraph({
  text,
  bullet: { level: 0 },
  spacing: { after: 80 },
});
const code = (text) => new Paragraph({
  children: [new TextRun({ text, font: 'Courier New', size: 20 })],
  spacing: { after: 80 },
});
const highlight = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, color: 'C00000', size: 24 })],
  spacing: { before: 120, after: 120 },
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
  },
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'VisionGrade — Team Handoff Report', bold: true, size: 36 })],
      }),
      p('Purpose: Share this document with your team or paste into an LLM to continue development from the current state.'),
      p('Branch: lakshay-backend'),
      p('Repository: https://github.com/sarthakk-sood/VisionGrade.git'),
      p('Last updated: June 2026'),

      h1('1. What This App Does'),
      p('VisionGrade is an AI academic evaluation platform with two modules:'),
      bullet('Module 1 — Generate (MOSTLY COMPLETE): Upload PDFs → detect topics → configure weightage → generate questions → review/approve → finalize with LLM model answers → export LaTeX PDFs'),
      bullet('Module 2 — Evaluate (UI ONLY): Upload answer sheets → OCR → mapping → evaluation → reports. No backend wired yet.'),

      h1('2. Quick Start'),
      code('git clone https://github.com/sarthakk-sood/VisionGrade.git'),
      code('cd VisionGrade && git checkout lakshay-backend'),
      code('cd backend && npm install && cp .env.example .env'),
      code('npm run dev   # backend — set PORT in .env'),
      code('cd frontend && npm install'),
      code('chmod +x node_modules/.bin/vite   # macOS if permission error'),
      code('npm run dev   # http://localhost:5173'),
      p('Local URLs:'),
      bullet('Frontend: http://localhost:5173'),
      bullet('Backend API: http://localhost:5001/api (use port 5001 on macOS — 5000 is used by AirPlay)'),

      h1('3. Environment Variables & API Keys'),
      highlight('Each developer must create their own secrets. Never commit .env files. Replace every ADD YOURS HERE below.'),

      h2('backend/.env'),
      code('PORT=5001'),
      code('NODE_ENV=development'),
      code('CLIENT_URL=http://localhost:5173'),
      code(`MONGO_URI=${ADD}`),
      code('DB_NAME=vision_grade'),
      code(`GROQ_API_KEY=${ADD}`),
      code(`GEMINI_API_KEY=${ADD}`),
      code(`CLOUDINARY_CLOUD_NAME=${ADD}`),
      code(`CLOUDINARY_API_KEY=${ADD}`),
      code(`CLOUDINARY_API_SECRET=${ADD}`),
      code(`JWT_SECRET=${ADD}`),
      code('JWT_EXPIRES_IN=7d'),
      code('MAX_FILE_SIZE_MB=50'),
      code(`TECTONIC_PATH=${ADD}   # optional; for PDF export`),

      h3('Where to obtain keys'),
      bullet('MONGO_URI — MongoDB Atlas → Cluster → Connect → Node.js driver URI'),
      bullet('GROQ_API_KEY — https://console.groq.com (starts with gsk_)'),
      bullet('GEMINI_API_KEY — https://aistudio.google.com/apikey (starts with AIza)'),
      bullet('CLOUDINARY_* — https://cloudinary.com dashboard (3 values)'),
      bullet('JWT_SECRET — any long random string'),
      highlight(`TECTONIC_PATH — ${ADD} (machine-specific; install via: brew install tectonic)`),

      h2('frontend/.env'),
      code('VITE_API_BASE_URL=http://localhost:5001/api'),

      h1('4. System Dependencies (not npm)'),
      bullet('Node.js 18+ — required for everything'),
      bullet('MongoDB Atlas — cloud database (no local Mongo required)'),
      highlight(`Tectonic — ${ADD} (required for LaTeX PDF export on your machine; brew install tectonic on macOS)`),
      p('pdflatex is a fallback if Tectonic is unavailable.'),

      h1('5. npm Dependencies'),
      h2('Backend'),
      p('express, mongoose, dotenv, cors, helmet, morgan, bcryptjs, jsonwebtoken, multer, cloudinary, pdf-parse, openai (Groq client), @google/genai, express-rate-limit, uuid, winston'),
      h2('Frontend'),
      p('react, react-router-dom, vite, tailwindcss, zustand, axios, framer-motion, lucide-react'),

      h1('6. Module 1 — User Flow'),
      bullet('Login / Register'),
      bullet('/module1/exam-details — exam metadata'),
      bullet('/module1/upload — PDF upload → Cloudinary + text extraction'),
      bullet('/module1/topics — LLM topic detection + teacher config'),
      bullet('/module1/generate — LLM question generation'),
      bullet('/module1/review — approve / edit / add / delete / regenerate questions'),
      bullet('Finalize — LLM model answers → MongoDB ExamSession'),
      bullet('/session/:id — view session + model answers'),
      bullet('Export Question Paper PDF + Answer Key PDF (LaTeX → Tectonic)'),
      p('localStorage keys: vg_token, vg_user, vg_projectId, vg_m1_step, vg_exam_info, vg_session_id'),

      h1('7. API Reference'),
      p('All routes except /api/auth/register and /api/auth/login require: Authorization: Bearer <JWT>'),

      h2('Auth — /api/auth'),
      bullet('POST /register — { name, email, password, institution? }'),
      bullet('POST /login — { email, password }'),
      bullet('GET /me — current user (protected)'),

      h2('Questions — /api/questions'),
      bullet('POST /upload-pdfs — multipart: pdfs[], title, subject'),
      bullet('POST /generate — { projectId, ...config }'),
      bullet('GET /list/:projectId'),
      bullet('PATCH /:projectId/:questionId — edit or approve single question'),
      bullet('PATCH /:projectId/approve-selection — { questionIds: [] }'),
      bullet('POST /:projectId/add — add manual question'),
      bullet('DELETE /:projectId/:questionId'),
      bullet('POST /regenerate-single'),

      h2('Topics — /api/topics'),
      bullet('POST /detect/:projectId — LLM topic detection'),
      bullet('GET /:projectId'),
      bullet('PATCH /:projectId/selection — { topics: [{id, isSelected}] }'),

      h2('Sessions — /api/sessions'),
      bullet('POST /finalize/:projectId — approved questions → LLM answers → MongoDB'),
      bullet('GET / — list sessions'),
      bullet('GET /:sessionId — full session with questions + model answers'),
      bullet('GET /:sessionId/export/question-paper — LaTeX PDF'),
      bullet('GET /:sessionId/export/answer-key — LaTeX PDF'),

      h2('Health'),
      bullet('GET /api/health — { mongodb: "connected" | "disconnected" }'),

      h1('8. MongoDB (database: vision_grade)'),
      bullet('teachers — faculty accounts'),
      bullet('projects — workflow: topics, generatedQuestions[], examInfo, status'),
      bullet('sourcedocuments — PDFs with extractedText, pdfUrl'),
      bullet('examsessions — finalized papers with modelAnswer, markingScheme, answerProvider'),
      bullet('answersheets, evaluationreports — Module 2 (not wired)'),
      p('Project status: uploaded → topics_detected → paper_generated → approved'),
      p('Question types: MCQ, ShortAnswer, MediumAnswer, LongAnswer, FillInTheBlanks'),

      h1('9. LLM Architecture'),
      bullet('Topic detection — llmService.js — Groq llama-3.1-8b-instant → Gemini fallback'),
      bullet('Question generation — questionGenerationService.js — Groq → Gemini'),
      bullet('Model answers — answerGenerationService.js — Groq batched (4 Qs) → Gemini'),
      p('PDF text truncated in backend/utils/llmUtils.js (~8k topic, ~10k generation) to avoid Groq 413 errors.'),

      h1('10. PDF Export (LaTeX)'),
      bullet('latexExportService.js — builds .tex source'),
      bullet('latexCompileService.js — compiles via Tectonic'),
      bullet('latexEscape.js — escapes special characters'),
      highlight(`Requires Tectonic installed locally — ${ADD} for TECTONIC_PATH if not on PATH`),

      h1('11. Frontend Architecture'),
      bullet('Routes: frontend/src/routes/AppRoutes.jsx'),
      bullet('State: frontend/src/store/useAppStore.js (Zustand)'),
      bullet('API: frontend/src/services/api.js (Axios, 120s timeout)'),
      bullet('Sessions: loaded from API only — no hardcoded mock sessions'),
      bullet('Dashboard stats & timeline: computed from real examSessions'),
      bullet('Theme: light professional UI (frontend/src/utils/theme.js)'),

      h1('12. Key Backend Files'),
      bullet('server.js, app.js, config/db.js, config/cloudinary.js'),
      bullet('controllers: authController, questionController, topicController, sessionController'),
      bullet('services: llmService, questionGenerationService, answerGenerationService, pdfService, latexExportService, latexCompileService'),
      bullet('models: Project, ExamSession, Teacher, sourceDocument'),
      bullet('middleware: authMiddleware.js (JWT protect)'),

      h1('13. What Works vs What Does NOT'),
      h2('Working'),
      bullet('Auth (register/login JWT)'),
      bullet('PDF upload, topic detection, question generation'),
      bullet('Question CRUD + approve + bulk approve + regenerate'),
      bullet('Finalize session → LLM model answers → MongoDB'),
      bullet('List/view sessions, LaTeX PDF export'),
      bullet('Light theme UI, real session data on Dashboard/Sessions'),

      h2('Not implemented'),
      bullet('Module 2 backend (OCR, evaluation)'),
      bullet('DOCX export (PDF export works)'),
      bullet('Email OTP auth'),
      bullet('OPENAI_API_KEY and GOOGLE_APPLICATION_CREDENTIALS unused'),
      bullet('Blueprint page PDF buttons still "Coming soon" — use Session Details export'),

      h1('14. Known Gotchas'),
      bullet('macOS: use PORT=5001 (not 5000)'),
      bullet('chmod +x frontend/node_modules/.bin/vite if EACCES'),
      bullet('Groq 413: PDF text auto-truncated'),
      bullet('Gemini: use AI Studio key (AIza...)'),
      bullet('Finalize needs at least one approved question'),
      bullet('Tectonic first compile is slow (downloads TeX packages)'),
      bullet('Rate limit: 100 requests / 15 min on /api'),
      bullet('Do not commit .env or node_modules'),

      h1('15. Suggested Next Tasks'),
      bullet('1. Module 2 backend — OCR, answer sheet upload, evaluation API'),
      bullet('2. Wire Module 2 frontend to real APIs'),
      bullet('3. DOCX export alternative'),
      bullet('4. Tests (Jest/Supertest)'),
      bullet('5. Deployment (Docker + Tectonic)'),

      h1('16. Test Checklist'),
      code('curl http://localhost:5001/api/health'),
      code('curl -X POST http://localhost:5001/api/auth/register -H "Content-Type: application/json" -d \'{"name":"Test","email":"test@test.edu","password":"test123"}\''),
      code('curl -X POST http://localhost:5001/api/auth/login -H "Content-Type: application/json" -d \'{"email":"test@test.edu","password":"test123"}\''),
      code('curl http://localhost:5001/api/sessions -H "Authorization: Bearer YOUR_TOKEN"'),
      p('Manual: Login → Module 1 full flow → approve → finalize → view session → export PDFs'),

      h1('17. LLM Continuation Prompt'),
      p('Copy-paste the following into an LLM to continue development:'),
      code('You are continuing work on VisionGrade (branch: lakshay-backend).'),
      code('Read TEAM_HANDOFF.docx or TEAM_HANDOFF.md in the repo for full context.'),
      code('Module 1 complete: PDF → topics → questions → review → finalize → MongoDB → LaTeX PDF.'),
      code('Module 2 is UI-only. Stack: React+Vite+Zustand / Express+MongoDB+Groq+Gemini.'),
      code('Secrets: each dev fills ADD YOURS HERE in backend/.env (never commit).'),
      code('Backend port 5001, frontend 5173. Tectonic required for PDF export.'),
      code('Focus next on: [INSERT YOUR TASK HERE]'),

      new Paragraph({
        spacing: { before: 400 },
        children: [new TextRun({ text: '— End of handoff document —', italics: true, color: '666666' })],
      }),
    ],
  }],
});

const outPath = path.join(__dirname, '..', 'TEAM_HANDOFF.docx');

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log('Written:', outPath);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
