# VisionGrade — Team Handoff Report
**Purpose:** Paste this document (plus your filled-in secrets) into an LLM to continue development from the current state.  
**Branch:** `lakshay-backend` · **Repo:** https://github.com/sarthakk-sood/VisionGrade.git  
**Last updated:** June 2026

---

## 1. What This App Does

VisionGrade is an AI academic platform with two modules:

| Module | Status | Description |
|--------|--------|-------------|
| **Module 1 — Generate** | ✅ Mostly complete | Upload PDFs → detect topics → configure weightage → generate questions → review/approve → finalize with LLM model answers → export LaTeX PDFs |
| **Module 2 — Evaluate** | ❌ UI only | Upload answer sheets → OCR → mapping → evaluation → reports. **No backend wired.** Frontend shows empty states (no mock data). |

---

## 2. Quick Start (New Developer)

```bash
# Clone & branch
git clone https://github.com/sarthakk-sood/VisionGrade.git
cd VisionGrade
git checkout lakshay-backend

# Backend
cd backend && npm install
cp .env.example .env   # create from template below, fill secrets
npm run dev            # nodemon, default PORT from .env

# Frontend (new terminal)
cd frontend && npm install
# create frontend/.env (see below)
chmod +x node_modules/.bin/vite   # macOS if EACCES
npm run dev                       # http://localhost:5173
```

**URLs (local):**
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5001/api` (use **5001** on macOS — port 5000 is used by AirPlay)

---

## 3. Environment Variables

### `backend/.env` (create this file — never commit)

```env
# Server
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# MongoDB Atlas
MONGO_URI=ADD YOURS HERE
DB_NAME=vision_grade

# LLM — Groq primary, Gemini fallback
GROQ_API_KEY=ADD YOURS HERE
GEMINI_API_KEY=ADD YOURS HERE

# Cloudinary (PDF upload + storage)
CLOUDINARY_CLOUD_NAME=ADD YOURS HERE
CLOUDINARY_API_KEY=ADD YOURS HERE
CLOUDINARY_API_SECRET=ADD YOURS HERE

# Auth
JWT_SECRET=ADD YOURS HERE
JWT_EXPIRES_IN=7d

# Upload limits
MAX_FILE_SIZE_MB=50

# LaTeX PDF export (optional — auto-detects if omitted)
TECTONIC_PATH=ADD YOURS HERE
```

**Where to get keys:**
| Key | Source |
|-----|--------|
| `MONGO_URI` | [MongoDB Atlas](https://cloud.mongodb.com) → Cluster → Connect → Node driver URI |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys (starts with `gsk_`) |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) (starts with `AIza`) |
| `CLOUDINARY_*` | [cloudinary.com](https://cloudinary.com) dashboard |
| `JWT_SECRET` | Any long random string |
| `TECTONIC_PATH` | After `brew install tectonic` → usually `/opt/homebrew/bin/tectonic` |

### `frontend/.env`

```env
VITE_API_BASE_URL=http://localhost:5001/api
```

Change port if your backend uses a different `PORT`.

---

## 4. System Dependencies (Not npm)

| Tool | Required for | Install |
|------|--------------|---------|
| **Node.js 18+** | Everything | nodejs.org or nvm |
| **Tectonic** | LaTeX → PDF export | `brew install tectonic` (macOS) |
| **MongoDB Atlas** | Database | Cloud account (no local Mongo needed) |

`pdflatex` works as fallback if Tectonic is missing; Tectonic is preferred.

---

## 5. npm Dependencies

### Backend (`backend/package.json`)
`express`, `mongoose`, `dotenv`, `cors`, `helmet`, `morgan`, `bcryptjs`, `jsonwebtoken`, `multer`, `cloudinary`, `pdf-parse`, `openai` (Groq client), `@google/genai`, `express-rate-limit`, `uuid`, `winston`

### Frontend (`frontend/package.json`)
`react`, `react-router-dom`, `vite`, `tailwindcss`, `zustand`, `axios`, `framer-motion`, `lucide-react`

---

## 6. Module 1 — Complete User Flow

```
Login/Register
  → /module1/exam-details      (exam metadata)
  → /module1/upload            (PDF upload → Cloudinary + text extract)
  → /module1/topics            (LLM topic detection + teacher config)
  → /module1/generate          (LLM question generation)
  → /module1/review            (approve/edit/add/delete/regenerate questions)
  → Finalize                   (LLM model answers → MongoDB ExamSession)
  → /session/:id               (view session + model answers)
  → Export Question Paper PDF  (LaTeX → Tectonic → PDF)
  → Export Answer Key PDF      (LaTeX → Tectonic → PDF)
```

**Workflow state** persists in `localStorage`: `vg_token`, `vg_user`, `vg_projectId`, `vg_m1_step`, `vg_exam_info`, `vg_session_id`

---

## 7. API Reference (All routes need `Authorization: Bearer <JWT>` except auth)

### Auth — `/api/auth`
| Method | Path | Body |
|--------|------|------|
| POST | `/register` | `{ name, email, password, institution? }` |
| POST | `/login` | `{ email, password }` |
| GET | `/me` | — (protected) |

### Questions — `/api/questions`
| Method | Path | Notes |
|--------|------|-------|
| POST | `/upload-pdfs` | multipart: `pdfs[]`, `title`, `subject` |
| POST | `/generate` | `{ projectId, ...config }` |
| GET | `/list/:projectId` | All generated questions |
| PATCH | `/:projectId/:questionId` | Edit / approve single question |
| PATCH | `/:projectId/approve-selection` | `{ questionIds: string[] }` bulk approve |
| POST | `/:projectId/add` | Add manual question |
| DELETE | `/:projectId/:questionId` | Delete question |
| POST | `/regenerate-single` | Regenerate one question via LLM |

### Topics — `/api/topics`
| Method | Path | Notes |
|--------|------|-------|
| POST | `/detect/:projectId` | LLM topic detection from PDF text |
| GET | `/:projectId` | Stored topics |
| PATCH | `/:projectId/selection` | `{ topics: [{id, isSelected}] }` |

### Sessions — `/api/sessions`
| Method | Path | Notes |
|--------|------|-------|
| POST | `/finalize/:projectId` | Approved Qs → LLM answers → `ExamSession` |
| GET | `/` | List sessions (no questions array) |
| GET | `/:sessionId` | Full session with questions + answers |
| GET | `/:sessionId/export/question-paper` | LaTeX PDF download |
| GET | `/:sessionId/export/answer-key` | LaTeX PDF download |

### Health — `/api/health`
Returns `{ mongodb: "connected" | "disconnected" }`

---

## 8. MongoDB Collections (`vision_grade` database)

| Collection | Model file | Purpose |
|------------|------------|---------|
| `teachers` | `Teacher.js` | Faculty accounts (bcrypt password) |
| `projects` | `Project.js` | Workflow project: topics, `generatedQuestions[]`, `examInfo`, status |
| `sourcedocuments` | `sourceDocument.js` | Uploaded PDFs: `extractedText`, `pdfUrl`, `isSelected` |
| `examsessions` | `ExamSession.js` | **Finalized** papers: questions + `modelAnswer`, `markingScheme`, `answerProvider` |
| `questionpapers` | `question-paper.js` | Legacy / unused in current flow |
| `answersheets` | `answer-sheet.js` | Module 2 — not wired |
| `evaluationreports` | `evaluation-report.js` | Module 2 — not wired |

### Key subdocument: `generatedQuestions` (in Project) and `questions` (in ExamSession)
```js
{
  topicName, type,           // MCQ | ShortAnswer | MediumAnswer | LongAnswer | FillInTheBlanks
  difficulty, marks,
  questionText, options[],   // MCQ only
  correctAnswer, modelAnswer, markingScheme, explanation,
  approved                   // Project only — teacher selection flag
}
```

### Project status enum
`uploaded` → `topics_detected` → `paper_generated` → `approved`

---

## 9. LLM Architecture

| Task | Service file | Primary | Fallback |
|------|-------------|---------|----------|
| Topic detection | `llmService.js` | Groq `llama-3.1-8b-instant` | Gemini `gemini-2.0-flash-lite`, `gemini-2.5-flash` |
| Question generation | `questionGenerationService.js` | Groq | Gemini |
| Model answer generation | `answerGenerationService.js` | Groq (batched, 4 Qs/batch) | Gemini |

**Token limits:** PDF text truncated in `backend/utils/llmUtils.js` (~8k chars topic detect, ~10k generation) to avoid Groq 413 errors.

**Answer types by question type** (in `answerGenerationService.js` SYSTEM_PROMPT):
- MCQ → letter + explanation
- ShortAnswer → 2–4 sentences
- MediumAnswer → paragraph
- LongAnswer → multi-part detailed answer
- FillInTheBlanks → exact fill + completed sentence

---

## 10. PDF Export (LaTeX)

| File | Role |
|------|------|
| `latexExportService.js` | Builds `.tex` source (article class, fancyhdr, enumitem) |
| `latexCompileService.js` | Compiles via Tectonic → PDF buffer |
| `latexEscape.js` | Escapes `& % $ # _ { }` etc. |

First compile downloads LaTeX packages (~60–90s). Subsequent exports ~15–30s.

---

## 11. Frontend Architecture

| Area | Path | Notes |
|------|------|-------|
| Routes | `frontend/src/routes/AppRoutes.jsx` | Auth guards via `localStorage vg_token` |
| State | `frontend/src/store/useAppStore.js` | Zustand — workflow, questions, sessions, finalize |
| API client | `frontend/src/services/api.js` | Axios + JWT interceptor, 120s timeout |
| Theme | `frontend/src/utils/theme.js` + `index.css` | Light professional UI |
| Module 1 pages | `frontend/src/pages/Module1/` | 6-step workflow |
| Module 2 pages | `frontend/src/pages/Module2/` | **Mock UI only** |
| Session detail | `frontend/src/pages/SessionDetails.jsx` | Model answers + PDF export buttons |

---

## 12. Key Backend Files

```
backend/
├── server.js                    # Entry, PORT, DB connect
├── app.js                       # Express middleware + route mount
├── config/db.js                 # Mongoose connect
├── config/cloudinary.js         # PDF cloud storage
├── controllers/
│   ├── authController.js
│   ├── questionController.js    # CRUD + generate + upload
│   ├── topicController.js
│   └── sessionController.js     # finalize + export PDFs
├── services/
│   ├── llmService.js            # Topic detection
│   ├── questionGenerationService.js
│   ├── answerGenerationService.js
│   ├── pdfService.js            # PDF parse + Cloudinary upload
│   ├── latexExportService.js
│   └── latexCompileService.js
├── models/                      # See section 8
├── routes/                      # questions, topics, sessions, auth, health
└── middleware/authMiddleware.js # JWT protect
```

---

## 13. What Works vs What Does NOT

### ✅ Working
- Register / Login (JWT, no OTP)
- PDF upload → Cloudinary + text extraction
- LLM topic detection (Groq → Gemini)
- Topic selection, marks, difficulty config
- LLM question generation
- Question CRUD: edit, add, delete, approve, regenerate, duplicate
- Bulk approve selection
- Finalize session → LLM model answers → MongoDB `examsessions`
- List / view sessions with model answers
- LaTeX PDF export (question paper + answer key)
- Light theme UI
- CORS includes PATCH

### ❌ Not implemented / stub only
- **Module 2 entire backend** (OCR, evaluation, answer sheets)
- DOCX export
- `questionpapers` collection integration
- Real dashboard/sessions from API only (no hardcoded mock sessions)
- Email OTP auth (described in old docs, not on this branch)
- `OPENAI_API_KEY` — unused
- `GOOGLE_APPLICATION_CREDENTIALS` — Vision OCR not wired
- Landing page links (no public landing route — `/` redirects to login)
- Blueprint page PDF export buttons (still "Coming soon" — use Session Details export instead)

---

## 14. Known Gotchas

1. **macOS port 5000** — Use `PORT=5001` in backend `.env`
2. **Vite EACCES** — `chmod +x frontend/node_modules/.bin/vite`
3. **Groq 413** — PDF text auto-truncated; if still failing reduce batch size
4. **Gemini key format** — Use AI Studio key (`AIza...`); Vertex-style keys may fail
5. **Finalize requires approved questions** — At least one `approved: true` in `generatedQuestions`
6. **Tectonic first run** — Slow (downloads TeX packages); needs network
7. **Rate limit** — 100 req/15min global; LLM calls count toward this
8. **`Work_Done_Till_Now.md`** — Outdated; trust this handoff instead
9. **Do not commit** `.env`, `node_modules`, or `backend/tmp/`

---

## 15. Suggested Next Tasks (Priority Order)

1. **Module 2 backend** — OCR pipeline, answer sheet upload, evaluation API
2. **Wire Module 2 frontend** to real APIs (replace mock Zustand data)
3. **Dashboard** — Real stats from `examsessions` + projects
4. **DOCX export** — Alternative to LaTeX PDF
5. **Blueprint page** — Enable export buttons (reuse session export endpoints)
6. **`.env.example`** files — Commit templates without secrets
7. **Tests** — Jest/Supertest for auth, finalize, export routes
8. **Deploy** — Dockerize; bundle Tectonic or use CI with TeX

---

## 16. Test Checklist

```bash
# Health
curl http://localhost:5001/api/health

# Register
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.edu","password":"test123"}'

# Login → copy token
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.edu","password":"test123"}'

# List sessions (with token)
curl http://localhost:5001/api/sessions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Manual UI test:** Login → Module 1 full flow → approve questions → finalize → view session → export both PDFs.

---

## 17. LLM Continuation Prompt (copy-paste)

```
You are continuing work on VisionGrade (branch: lakshay-backend).
Read TEAM_HANDOFF.md in the repo root for full context.

Current state: Module 1 is complete (PDF upload → topics → questions → review → 
finalize with LLM answers → MongoDB → LaTeX PDF export). Module 2 is UI-only.

Stack: React + Vite + Zustand + Tailwind frontend; Express + MongoDB + Groq/Gemini backend.

Before coding: ask for backend/.env secrets if needed (MONGO_URI, GROQ_API_KEY, 
GEMINI_API_KEY, CLOUDINARY_*, JWT_SECRET) — each team member uses ADD YOURS HERE.

Backend runs on port 5001 (macOS). Frontend on 5173.
PDF export requires Tectonic installed locally.

Focus next on: [INSERT YOUR TASK HERE]
```

---

*End of handoff. Replace all `ADD YOURS HERE` values with your own credentials before running locally.*

**Also available as Word document:** `TEAM_HANDOFF.docx` (same content, formatted for sharing).
