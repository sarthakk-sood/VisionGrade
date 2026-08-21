# Last Updated By: Lakshay Batra



# Vision-Grade Backend — Developer README
> CPG No. 118 | Thapar Institute of Engineering & Technology  
> Mentor: Dr. Ritesh Sharma | BE Third Year — COE | March–August 2026

---

## What This Project Is

Vision-Grade is a **teacher-facing web application** that automates two tasks:
1. **Module 1** — Generate exam question papers from reference PDFs using GPT-4o
2. **Module 2** — Evaluate handwritten student answer sheets using OCR + LLM

Students never interact with the system. Every AI output requires explicit teacher approval before being finalized (human-in-the-loop).

---

## Team

| Name | Roll No | Responsibility |
|------|---------|----------------|
| Lakshya Arora | 102303591 | Question Generation Module |
| Sarthak Sood | 102306180 | OCR Pipeline |
| Sneha | 102303969 | Multi-LLM Evaluation Engine |
| Manavdeep Singh Bhullar | 102303990 | Frontend & Integration |
| Lakshay Batra | 102303743 | Evaluation & Reporting |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | MongoDB Atlas M0 (free tier) via Mongoose |
| File Storage | Cloudinary (free tier) |
| PDF Processing | pdf-parse |
| Image Processing | Sharp + Jimp *(not started)* |
| OCR | Google Cloud Vision API + Tesseract.js fallback *(not started)* |
| LLM | OpenAI GPT-4o + Google Gemini Flash fallback *(not started)* |
| Export | docx + Puppeteer + archiver *(not started)* |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Testing | Jest + Supertest *(not started)* |

---

## Project Structure

```
VisionGrade/
└── backend/
    ├── config/
    │   ├── cloudinary.js       # Cloudinary v2 SDK config
    │   ├── db.js               # MongoDB Atlas connection
    │   └── multer.js           # memoryStorage; uploadPDFAsync (pdf+images) + uploadSheetsAsync (sheets, 50 files)
    ├── controllers/
    │   ├── authController.js     # register, login, getMe
    │   ├── healthController.js   # unused — health logic is inline in routes/health.js
    │   └── questionController.js # uploadPDFs
    ├── middleware/
    │   ├── authMiddleware.js   # JWT protect middleware
    │   ├── errorHandler.js     # Global error handler
    │   └── notFound.js         # 404 handler
    ├── models/
    │   ├── Teacher.js            # Teacher auth model
    │   ├── Project.js            # One project per exam
    │   ├── sourceDocument.js     # One document per uploaded PDF
    │   ├── question-paper.js     # Generated question paper
    │   ├── answer-sheet.js       # Student answer sheet + OCR results
    │   └── evaluation-report.js  # Per-student evaluation results
    ├── routes/
    │   ├── health.js           # GET /api/health
    │   ├── auth.js             # POST /api/auth/register, login, GET /me
    │   └── questions.js        # POST /api/questions/upload-pdfs
    ├── services/
    │   └── pdfService.js       # Upload to Cloudinary + extract text
    ├── uploads/                # Empty — memoryStorage means no disk writes
    ├── logs/                   # Empty — winston installed but not yet wired
    ├── utils/                  # Empty — reserved for future helpers
    ├── validators/             # Empty — express-validator installed but not yet used
    ├── .env                    # Environment variables (never commit)
    ├── app.js                  # Express app setup
    └── server.js               # Entry point
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory with the following:



## Getting Started

```bash
# 1. Navigate to backend
cd VisionGrade/backend

# 2. Install dependencies
npm install

# 3. Add your .env file (see above)

# 4. Start development server
npm run dev
```

Server starts at `http://localhost:5000`

---

## Working API Endpoints

### Health Check
```
GET /api/health
```
Response:
```json
{
  "success": true,
  "message": "Vision-Grade API is running",
  "mongodb": "connected",
  "environment": "development",
  "timestamp": "2026-06-09T..."
}
```

---

### Auth — Register
```
POST /api/auth/register
Content-Type: application/json
```
Body:
```json
{
  "name": "Dr. Ritesh Sharma",
  "email": "ritesh@thapar.edu",
  "password": "123456",
  "department": "Computer Science"
}
```
Response:
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "teacher": { "id": "...", "name": "...", "email": "...", "department": "..." }
}
```

---

### Auth — Login
```
POST /api/auth/login
Content-Type: application/json
```
Body:
```json
{
  "email": "ritesh@thapar.edu",
  "password": "123456"
}
```
Response: same as register — save the `token` for all protected requests.

---

### Auth — Get Current Teacher
```
GET /api/auth/me
Authorization: Bearer <token>
```

---

### Upload PDFs (Protected)
```
POST /api/questions/upload-pdfs
POST /api/questions/upload-pdf   ← legacy alias (same handler)
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
Form fields:

| Key | Type | Description |
|-----|------|-------------|
| `pdf` or `pdfs` | File | One or more PDF files (max 10, max 50MB each) |
| `title` | Text | Project title |
| `subject` | Text | Subject name |

Response:
```json
{
  "success": true,
  "projectId": "6a27ad9e...",
  "title": "My Exam Project",
  "documents": [
    {
      "docId": "...",
      "filename": "chapter1.pdf",
      "pageCount": 12,
      "pdfUrl": "https://res.cloudinary.com/...",
      "extractedTextPreview": "Chapter 1: Introduction..."
    }
  ]
}
```

> Each PDF is stored as a separate `SourceDocument` in MongoDB so teachers can select/deselect individual PDFs for topic detection without re-uploading.

---

## MongoDB Collections

| Collection | Purpose |
|-----------|---------|
| `teachers` | Teacher accounts (hashed passwords, JWT auth) |
| `projects` | One per exam — links to source docs, topics, question paper |
| `sourcedocuments` | One per uploaded PDF — stores Cloudinary URL + extracted text |
| `questionpapers` | Generated question papers with full question array |
| `answersheets` | Student answer sheet images + OCR results |
| `evaluationreports` | Per-student marks, feedback, override support |

---

## How Authentication Works

```
1. Teacher registers → password hashed with bcryptjs → saved to MongoDB
2. Teacher logs in → JWT token returned (expires in 7 days)
3. Every protected request must include:
   Header: Authorization: Bearer <token>
4. authMiddleware decodes token → attaches req.teacher to request
5. Controllers use req.teacher._id to scope all data to that teacher
```

---

## How PDF Upload Works

```
1. Teacher sends multipart/form-data with one or more PDFs
2. Multer stores files in memory (no disk write)
3. Project document created in MongoDB first (before PDF processing)
4. For each PDF in parallel:
   a. Buffer uploaded to Cloudinary under vision-grade/pdfs/
   b. pdf-parse extracts text from same buffer
   c. Text cleaned (whitespace normalised)
   d. SourceDocument saved to MongoDB with Cloudinary URL + extracted text
5. Project updated — sourceDocs array linked to all SourceDocument _ids
6. Response returns projectId + per-document preview
```

---

## What Is NOT Done Yet (Next Steps in Order)

### Module 1 — Question Paper Generation
- [ ] `services/llmService.js` — OpenAI GPT-4o wrapper + Gemini fallback
- [ ] `POST /api/questions/detect-topics` — send selected docs' text to LLM, get topics back
- [ ] `POST /api/questions/generate-questions` — blueprint config → LLM generates questions
- [ ] `PUT /api/questions/:id/edit` — teacher edits individual questions
- [ ] `PATCH /api/questions/:id/approve` — teacher approves question paper
- [ ] `POST /api/questions/:id/export` — export as DOCX/PDF + ZIP

### Module 2 — Answer Sheet Evaluation
- [ ] `POST /api/evaluation/upload-sheets` — batch image upload
- [ ] `POST /api/evaluation/:id/preprocess` — Sharp/Jimp image preprocessing
- [ ] `POST /api/evaluation/:id/run-ocr` — Google Vision + Tesseract fallback
- [ ] `PATCH /api/evaluation/:id/correct-ocr` — teacher corrects flagged regions
- [ ] `POST /api/evaluation/:id/evaluate` — LLM evaluation per question
- [ ] `PATCH /api/evaluation/:id/override` — teacher overrides marks
- [ ] `POST /api/evaluation/:id/export` — per-student DOCX + batch ZIP

### Infrastructure
- [ ] Frontend — React 18 + Vite + Tailwind CSS + Zustand
- [ ] Testing — Jest + Supertest test suites
- [ ] Docker setup
- [ ] Deployment

---

## Key Design Decisions

- **CommonJS throughout** (`require`/`module.exports`) — removed `"type": "module"` from package.json
- **Multer memoryStorage** — files never touch disk, go straight to Cloudinary
- **Cloudinary `resource_type: 'auto'`** for PDFs — `'raw'` caused "File format not supported" errors; `'auto'` lets Cloudinary detect and accept PDFs correctly
- **pdf-parse v2 constructor** — v2.4.5 uses a class-based API: `new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 })`. The `verbosity` field is **required** — omitting it causes a silent crash (`Cannot read .verbosity of undefined`). Result fields are `lineStore.text` and `lineStore.total`
- **SourceDocument model filename** — file is `sourceDocument.js` (lowercase `s`). Windows is case-insensitive so `require('../models/SourceDocument')` works locally, but **will crash on Linux/Docker**. Always use the exact filename casing in require paths
- **SourceDocument model** — each PDF stored separately so teacher can include/exclude individual docs for topic detection without re-uploading
- **JWT on every protected route** — `req.teacher._id` scopes all data per teacher
- **Human-in-the-loop** — no AI output is finalized without teacher approval
- **Zero procurement cost** — MongoDB Atlas M0, Cloudinary free, academic API keys

---

## Important Notes for Teammates

1. **Always `cd backend` before running any npm command** — `package.json` is inside `backend/`, not the root
2. **Never use ES module syntax** (`import`/`export`) — this codebase uses CommonJS
3. **Do not let VS Code Copilot auto-fix errors** — it has made incorrect changes (made `teacherId` optional, used `multer.any()`). Always verify changes manually
4. **Test every endpoint in Postman** before moving to the next one
5. **All protected routes need** `Authorization: Bearer <token>` header
6. **When adding a new route**, always: create service → create controller → create route file → wire into `app.js`
7. **Cloudinary delivery blocked?** — Log into the Cloudinary console and verify your account email. New/unverified accounts block CDN delivery even though uploads succeed (you'll see "Customer is marked as untrusted" in the asset panel)

---

## Dependencies Installed

```json
"dependencies": {
  "express", "mongoose", "dotenv", "cors", "helmet",
  "morgan", "express-rate-limit", "express-validator",
  "multer", "cloudinary", "pdf-parse",
  "bcryptjs", "jsonwebtoken", "uuid", "winston",
  "openai",        // installed, not yet used
  "compression",   // installed, not yet wired into app.js
  "cookie-parser"  // installed, not yet wired into app.js
}
"devDependencies": {
  "nodemon", "jest", "supertest"
}
```

---

## Resolved Bugs (Session Log)

| Date | File | Bug | Fix |
|------|------|-----|-----|
| 2026-06-09 | `services/pdfService.js` | `const { PDFParse } = require('pdf-parse')` — wrong named import, crashed as `PDFParse is not a constructor` | Switched to correct v2 class import; added required `verbosity: 0` to constructor |
| 2026-06-09 | `services/pdfService.js` | Cloudinary upload with `resource_type: 'raw'` returned "File format is not supported" for PDFs | Changed to `resource_type: 'auto'` |
| 2026-06-09 | `controllers/questionController.js` | `require('../models/SourceDocument')` — wrong casing vs actual filename `sourceDocument.js`; works on Windows, crashes on Linux | Fixed to `require('../models/sourceDocument')` |

---

*Last updated: 2026-06-09 — PDF upload pipeline fully working (Cloudinary + text extraction). Ready for Module 1 LLM integration.*
