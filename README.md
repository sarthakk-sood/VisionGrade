# VisionGrade

Teacher-only exam tool with two modules:

1. **Generate** a question paper and answer key from syllabus PDFs.
2. **Evaluate** student answer sheets from the uploaded photo against that key.

Scoring does **not** use OCR. Module 2 stores the sheet on Cloudinary and a vision LLM (Gemini, falling back to Groq) reads the photo directly against structured marking criteria from Module 1.

## Current flow

### Module 1 — Generate

Exam details → upload syllabus PDFs → topics and weightage → generate questions → review → export / finalize.

Finalizing stores model answers and `markingCriteria` on each question:

```json
{ "point": "Definition of a stack", "marks": 1 }
```

Each criterion is marked independently. The sum is capped at the question’s max marks.

### Module 2 — Evaluate

Select exam → upload sheet (PDF or image) → review photo + key → **Score** → results / class report.

Teachers can override marks after scoring.

| Step | Route |
|------|--------|
| Select exam / upload | `/module2/upload` |
| Review sheet + key | `/module2/mapping` |
| Results | `/module2/evaluate` |
| Class report | `/module2/report` |

`/module2/ocr` redirects to review.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind, Zustand, React Router |
| Backend | Node.js, Express, MongoDB (Mongoose) |
| Storage | Cloudinary (syllabus PDFs and answer sheets) |
| LLMs | Groq (paper generation) and Gemini (paper fallback); Module 2 scores with Gemini vision, falling back to Groq vision |
| Auth | JWT for teachers |

Local ports (macOS): frontend **5173**, API **5001**. Port 5000 is often taken by AirPlay.

## Setup

```bash
git clone https://github.com/sarthakk-sood/VisionGrade.git
cd VisionGrade
git checkout module2-vision-scoring
```

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in secrets
npm run dev            # http://localhost:5001
```

Required in `backend/.env`:

| Variable | Purpose |
|----------|---------|
| `PORT` | Use `5001` on macOS |
| `CLIENT_URL` | `http://localhost:5173` |
| `MONGO_URI` | MongoDB Atlas connection string |
| `DB_NAME` | `vision_grade` |
| `GROQ_API_KEY` | Question generation + Module 2 fallback scoring |
| `GEMINI_API_KEY` | Sheet scoring (primary, required for Module 2) |
| `CLOUDINARY_*` | PDF / image storage |
| `JWT_SECRET` | Teacher auth |

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:5001/api
npm run dev            # http://localhost:5173
```

On macOS, if Vite fails with `EACCES`:

```bash
chmod +x node_modules/.bin/vite
```

## Scoring behaviour

1. Teacher finalizes the paper so questions have `markingCriteria`.
2. Teacher uploads a student sheet. The file is stored on Cloudinary; no OCR is run.
3. **Score this student** (or **Score remaining**) downloads the Cloudinary file and sends the image plus criteria to Gemini vision.
4. If Gemini vision fails (rate limit, outage, model access), the backend falls back to a vision-capable Groq model (`GROQ_VISION_MODEL`) with the same image and criteria. Scoring is LLM-only end to end — there is no OCR or keyword-matching fallback.
5. If the sheet image can't be downloaded, or both vision LLMs fail, the sheet is left unscored with a descriptive error so the teacher can retry.

Re-finalize older papers if they only have a free-text `markingScheme` and you want structured criteria stored on the session.

## API (Module 2)

All routes except health require a teacher JWT.

| Method | Path | What it does |
|--------|------|----------------|
| `POST` | `/api/ocr/extract` | Upload and store a sheet |
| `GET` | `/api/ocr/session/:sessionId` | List sheets for an exam |
| `GET` | `/api/ocr/:sheetId` | Fetch one sheet |
| `POST` | `/api/evaluation/sheets/:sheetId` | Score one student |
| `POST` | `/api/evaluation/sessions/:sessionId/evaluate-all` | Score remaining sheets |
| `GET` | `/api/evaluation/sessions/:sessionId` | List reports |
| `PATCH` | `/api/evaluation/reports/:reportId/override` | Teacher mark overrides |

## Repo layout

```
backend/          Express API (port 5001)
frontend/         Vite React app (port 5173)
```
