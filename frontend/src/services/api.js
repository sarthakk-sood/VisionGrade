import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api',
  timeout: 120000, // 2 min — topic detection can take ~60s with Gemini retry
});

// ── Auth interceptor — attach JWT from localStorage automatically ─────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vg_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('vg_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Topic API ─────────────────────────────────────────────────────────────────
export const topicApi = {
  /**
   * POST /api/topics/detect/:projectId
   * Sends PDF extracted text to GPT-4o / Gemini and returns detected topics.
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
  /**
   * POST /api/questions/generate
   * Sends teacher config to backend; backend calls GPT-4o → Gemini fallback.
   * @param {string} projectId
   * @param {{ examInfo, difficultyDistribution, topics[] }} config
   */
  generate: (projectId, config) =>
    api.post('/questions/generate', { projectId, ...config }).then((r) => r.data),
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

  verifyOTP: (email, otp) =>
    api.post('/auth/verify-otp', { email, otp }).then((r) => r.data),
};

export const apiService = {
  async ping() { return { ok: true }; },
};