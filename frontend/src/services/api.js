import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 120000, // 2 min — topic detection can take ~60s with Gemini retry
});

/**
 * Question generation and answer generation run the LLM once per small batch of
 * questions so each batch can be given the source passages it needs, so a full
 * paper takes several sequential calls.
 */
const LLM_BATCH_TIMEOUT = 6 * 60 * 1000;

// ── Auth interceptor — attach JWT from localStorage automatically ─────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vg_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — auto-logout on 401 (expired/stale token) ──────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear the stale token and bounce to login
      localStorage.removeItem('vg_token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Topic API ─────────────────────────────────────────────────────────────────
export const topicApi = {
  /**
   * POST /api/topics/detect/:projectId
   * Sends PDF extracted text to the LLM and returns detected topics.
   */
  detect: (projectId) =>
    api.post(`/topics/detect/${projectId}`).then((r) => r.data),

  /**
   * GET /api/topics/:projectId
   * Returns previously saved topics for a project.
   */
  get: (projectId) =>
    api.get(`/topics/${projectId}`).then((r) => r.data),

  /**
   * PATCH /api/topics/:projectId/selection
   * Updates which topics are selected/deselected by the teacher.
   * @param {string} projectId
   * @param {Array<{id: number, isSelected: boolean}>} topics
   */
  updateSelection: (projectId, topics) =>
    api.patch(`/topics/${projectId}/selection`, { topics }).then((r) => r.data),
};

// ── Question Generation API ────────────────────────────────────────────────────
export const questionApi = {
  generate: (projectId, config) =>
    api.post('/questions/generate', { projectId, ...config }, { timeout: LLM_BATCH_TIMEOUT })
      .then((r) => r.data),

  list: (projectId) =>
    api.get(`/questions/list/${projectId}`).then((r) => r.data),

  add: (projectId, payload) =>
    api.post(`/questions/${projectId}/add`, payload).then((r) => r.data),

  update: (projectId, questionId, payload) =>
    api.patch(`/questions/${projectId}/${questionId}`, payload).then((r) => r.data),

  delete: (projectId, questionId) =>
    api.delete(`/questions/${projectId}/${questionId}`).then((r) => r.data),

  regenerateSingle: (projectId, questionId, { questionType, topicName, marks, difficulty }) =>
    api.post('/questions/regenerate-single', {
      projectId, questionId, questionType, topicName, marks, difficulty,
    }, { timeout: LLM_BATCH_TIMEOUT }).then((r) => r.data),

  approveSelection: (projectId, questionIds) =>
    api.patch(`/questions/${projectId}/approve-selection`, { questionIds }).then((r) => r.data),
};

// ── Exam Session API ─────────────────────────────────────────────────────────
export const sessionApi = {
  finalize: (projectId) =>
    api.post(`/sessions/finalize/${projectId}`, null, { timeout: LLM_BATCH_TIMEOUT })
      .then((r) => r.data),

  list: () =>
    api.get('/sessions').then((r) => r.data),

  get: (sessionId) =>
    api.get(`/sessions/${sessionId}`).then((r) => r.data),

  /**
   * Returns a direct download URL with ?token= embedded.
   * This lets IDM (and other download managers) re-request the URL
   * without needing the Authorization header, preventing the 401 error.
   */
  exportQuestionPaperUrl: (sessionId) => {
    const token = localStorage.getItem('vg_token') || '';
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    return `${base}/sessions/${sessionId}/export/question-paper?token=${encodeURIComponent(token)}`;
  },

  exportAnswerKeyUrl: (sessionId) => {
    const token = localStorage.getItem('vg_token') || '';
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    return `${base}/sessions/${sessionId}/export/answer-key?token=${encodeURIComponent(token)}`;
  },
};

/** Trigger a browser download from an axios blob response. */
export const downloadBlobResponse = (response, fallbackName = 'export.pdf') => {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || fallbackName;
  const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// ── Upload API ────────────────────────────────────────────────────────────────
export const uploadApi = {
  /**
   * POST /api/questions/upload-pdfs
   * Uploads PDFs and returns a projectId + extracted text preview per doc.
   * @param {FormData} formData  — must include fields: pdfs[], title, subject
   * @param {function} onProgress  — (percent: number) => void
   */
  uploadPDFs: (formData, onProgress) =>
    api.post('/questions/upload-pdfs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }).then((r) => r.data),
};

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),

  register: (payload) =>
    api.post('/auth/register', payload).then((r) => r.data),

  logout: () =>
    api.post('/auth/logout').then((r) => r.data).catch(() => { }), // best-effort

  getMe: () =>
    api.get('/auth/me').then((r) => r.data),
};

// ── OCR / Answer Sheet API (Module 2) ─────────────────────────────────────────
//
// Architecture note — async job polling:
//   TrOCR on CPU can take 5–30 min per page. The Node backend now uses an async
//   job pattern: POST /extract submits the job to Python, then polls every 5 s
//   until done (up to 30 min). This request must stay open that long, so the
//   axios timeout below is set to 35 min to comfortably cover that window.
//
export const ocrApi = {
  /**
   * POST /api/ocr/extract
   * Upload a PDF answer sheet and receive TrOCR extracted text per page.
   * Node backend polls the Python job internally — this call resolves when
   * OCR is complete (which can take up to 30 min on CPU).
   *
   * Required FormData fields : pdf (File), rollNumber (string)
   * Optional FormData fields : studentName (string), sessionId (string)
   *
   * @param {FormData} formData
   * @param {(pct: number) => void} [onUploadProgress]
   * @returns {Promise<{
   *   success: boolean,
   *   data: {
   *     answerSheetId: string | null,
   *     rollNumber: string,
   *     studentName: string | null,
   *     totalPages: number,
   *     avgConfidence: number,
   *     lowConfidencePages: number[],
   *     isLowConfidence: boolean,
   *     pages: Array<{
   *       pageNumber: number,
   *       text: string,
   *       confidence: number,
   *       lines: Array<{ lineNumber: number, text: string, confidence: number, bbox: number[] }>
   *     }>
   *   }
   * }>}
   */
  extract: (formData, onUploadProgress) =>
    api.post('/ocr/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // 35 min — covers the 30-min backend polling window with margin
      timeout: 35 * 60 * 1000,
      onUploadProgress: (e) => {
        if (onUploadProgress && e.total) {
          onUploadProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }).then((r) => r.data),

  /**
   * GET /api/ocr/:sheetId
   * Fetch a previously extracted AnswerSheet document from MongoDB.
   */
  get: (sheetId) => api.get(`/ocr/${sheetId}`).then((r) => r.data),

  /**
   * GET /api/ocr/service-health
   * Check whether the Python TrOCR microservice is reachable.
   */
  serviceHealth: () => api.get('/ocr/service-health').then((r) => r.data),
};