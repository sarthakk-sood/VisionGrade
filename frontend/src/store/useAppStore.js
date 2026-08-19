import { create } from 'zustand';
import { uploadApi, topicApi, questionApi, sessionApi, ocrApi, evaluationApi } from '../services/api';
import { displaySessionStatus } from '../utils/sessionHelpers';

const defaultBlueprint = {
  totalMarks: 100,
  sections: [],
  difficultySplit: { easy: 0, medium: 0, hard: 0 },
};

// ─── Store ────────────────────────────────────────────────────────────────────
function loadStoredUser() {
  try {
    const raw = localStorage.getItem('vg_user');
    if (!raw) return null;
    const teacher = JSON.parse(raw);
    return {
      name: teacher.name || 'Faculty User',
      email: teacher.email || '',
      role: 'Faculty Evaluator',
      department: teacher.department || '',
      institution: teacher.institution || 'Thapar Institute of Engineering & Technology',
    };
  } catch {
    localStorage.removeItem('vg_user');
    return null;
  }
}

const defaultUser = loadStoredUser() || {
  name: 'Faculty User',
  role: 'Faculty Evaluator',
  email: '',
  institution: 'Thapar Institute of Engineering & Technology',
};

function loadWorkflowState() {
  try {
    const projectId = localStorage.getItem('vg_projectId');
    const step = parseInt(localStorage.getItem('vg_m1_step') || '0', 10);
    const examInfoRaw = localStorage.getItem('vg_exam_info');
    const examInfo = examInfoRaw ? JSON.parse(examInfoRaw) : null;
    return {
      projectId: projectId || null,
      m1CompletedStep: Number.isFinite(step) ? step : 0,
      examInfo,
    };
  } catch {
    return { projectId: null, m1CompletedStep: 0, examInfo: null };
  }
}

const workflowState = loadWorkflowState();

const mapApiQuestion = (q, idx) => ({
  id:          q._id?.toString() || q.id?.toString() || String(idx + 1),
  type:        q.type,
  text:        q.questionText || q.text || '',
  topic:       q.topicName || q.topic || '',
  marks:       q.marks ?? 0,
  difficulty:  q.difficulty || 'Medium',
  approved:    q.approved ?? false,
  options:     q.options,
  answer:      q.correctAnswer || q.answer || '',
  explanation: q.explanation || '',
  modelAnswer: q.modelAnswer || '',
  markingScheme: q.markingScheme || '',
  markingCriteria: Array.isArray(q.markingCriteria) ? q.markingCriteria : [],
  // Provenance — the PDF passage this question was written from.
  sourceEvidence: q.sourceEvidence || '',
  sourceFile:     q.sourceFile || '',
  sourcePage:     q.sourcePage ?? null,
  grounded:       q.grounded ?? false,
});

const mapApiSession = (s, questions = null) => {
  const qs = questions ?? s.questions ?? null;
  return {
    id:            s.id || s._id,
    projectId:     s.projectId,
    examName:      s.examTitle || 'Untitled Exam',
    subject:       s.subject || '',
    totalMarks:    s.totalMarks,
    questionCount: s.questionCount,
    dateCreated:   s.finalizedAt || s.createdAt || null,
    status:        displaySessionStatus(s.status),
    rawStatus:     s.status || 'finalized',
    // Filled in from /evaluation/overview once sessions are loaded (see loadSessionsFromBackend).
    studentsEvaluated: 0,
    pendingSheets:     0,
    avgScore: 0,
    evaluationDate: null,
    answerProvider: s.answerProvider || null,
    sessionQuestions:  qs,
    hasModelAnswers: Boolean(qs?.length) || Boolean(s.hasAnswerKey) || Boolean(s.answerProvider),
  };
};

const persistWorkflow = (state) => {
  if (state.projectId) localStorage.setItem('vg_projectId', state.projectId);
  else localStorage.removeItem('vg_projectId');
  localStorage.setItem('vg_m1_step', String(state.m1CompletedStep ?? 0));
  if (state.examInfo) localStorage.setItem('vg_exam_info', JSON.stringify(state.examInfo));
};

export const useAppStore = create((set, get) => ({
  user: defaultUser,

  examSessions: [],
  studentEvaluations: [],
  flaggedResponsesData: [],
  selectedSessionId: localStorage.getItem('vg_session_id') || null,
  sessionsLoading: false,

  topics: [],
  blueprint: defaultBlueprint,
  questions: [],
  ocrResults: [],
  evaluations: [],
  reports: [],
  uploadedFiles: [],

  loadingStates: { uploading: false, generating: false, ocrReview: false, evaluating: false },

  // ─── Module 1 Workflow — step gate ────────────────────────────────────────
  // 0 = nothing done yet, 1 = ExamDetails done, 2 = PDFs uploaded + topics detected,
  // 3 = topics saved, 4 = questions generated, 5 = questions reviewed, 6 = exported
  m1CompletedStep: workflowState.m1CompletedStep,

  // ─── Project / Topic API state ─────────────────────────────────────────────
  projectId:       workflowState.projectId,
  topicsLoading:   false,
  topicsSaved:     false,
  topicsError:     null,
  detectedSubject: null,
  llmProvider:     null,

  // ─── Exam Info (teacher fills on QuestionGeneration page) ─────────────────────
  examInfo: workflowState.examInfo || {
    examTitle:       '',
    subject:         '',
    totalMarks:      100,
    durationMinutes: 90,
    instructions:    [],
    questionTypes: {
      MCQ:             { count: 0, marks: 1 },
      ShortAnswer:     { count: 0, marks: 2 },
      MediumAnswer:    { count: 0, marks: 3 },
      LongAnswer:      { count: 0, marks: 5 },
      FillInTheBlanks: { count: 0, marks: 1 },
    },
  },

  // ─── Generated questions ───────────────────────────────────────────────────
  generatedQuestions: [],
  questionsLoading:   false,
  questionsError:     null,
  generationProvider: null,

  // How many questions had their source passage verified in the uploaded PDFs,
  // plus any allocation warnings the backend reported.
  groundedCount:       0,
  generationWarnings:  [],

  // ─── Actions ───────────────────────────────────────────────────────────────
  setLoadingState: (key, value) =>
    set((s) => ({ loadingStates: { ...s.loadingStates, [key]: value } })),

  /** Mark step N as completed (only advances forward, never goes back). */
  completeM1Step: (step) =>
    set((s) => {
      const m1CompletedStep = Math.max(s.m1CompletedStep, step);
      persistWorkflow({ projectId: s.projectId, m1CompletedStep, examInfo: s.examInfo });
      return { m1CompletedStep };
    }),

  /** Resets the whole Module 1 workflow so teacher can start a new exam. */
  resetM1Workflow: () => {
    localStorage.removeItem('vg_projectId');
    localStorage.removeItem('vg_m1_step');
    localStorage.removeItem('vg_exam_info');
    set({
      m1CompletedStep: 0,
      projectId:        null,
      topics:           [],
      detectedSubject:  null,
      llmProvider:      null,
      generatedQuestions: [],
      questions:        [],
      questionsError:   null,
      topicsError:      null,
      uploadedFiles:    [],
      groundedCount:      0,
      generationWarnings: [],
      examInfo: {
        examTitle: '', subject: '', totalMarks: 100, durationMinutes: 90,
        instructions: [],
        questionTypes: {
          MCQ:             { count: 0, marks: 1 },
          ShortAnswer:     { count: 0, marks: 2 },
          MediumAnswer:    { count: 0, marks: 3 },
          LongAnswer:      { count: 0, marks: 5 },
          FillInTheBlanks: { count: 0, marks: 1 },
        },
      },
    });
  },

  setUser:    (user)    => set({ user }),

  logout: () => {
    localStorage.removeItem('vg_token');
    localStorage.removeItem('vg_user');
    set({
      user: {
        name: 'Faculty User',
        role: 'Faculty Evaluator',
        email: '',
        institution: 'Thapar Institute of Engineering & Technology',
      },
    });
  },
  setSession: (session) => set({ session }),

  selectSession: (id) => {
    if (id) localStorage.setItem('vg_session_id', id);
    else localStorage.removeItem('vg_session_id');
    set({ selectedSessionId: id });
  },

  createExamSession: (newSession) =>
    set((s) => ({
      examSessions: [
        { id: `ES-2026-00${s.examSessions.length + 1}`, ...newSession },
        ...s.examSessions,
      ],
    })),

  updateExamSession: (id, patch) =>
    set((s) => ({
      examSessions: s.examSessions.map((sess) => (sess.id === id ? { ...sess, ...patch } : sess)),
    })),

  addTopic: (topic) =>
    set((s) => ({ topics: [...s.topics, { id: Date.now(), ...topic }] })),

  updateTopic: (id, patch) =>
    set((s) => ({ topics: s.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  removeTopic: (id) =>
    set((s) => ({ topics: s.topics.filter((t) => t.id !== id) })),

  setBlueprint: (patch) =>
    set((s) => ({ blueprint: { ...s.blueprint, ...patch } })),

  updateSection: (id, patch) =>
    set((s) => ({
      blueprint: {
        ...s.blueprint,
        sections: s.blueprint.sections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)),
      },
    })),

  addQuestion: (question) =>
    set((s) => ({ questions: [question, ...s.questions] })),

  updateQuestion: (id, patch) =>
    set((s) => ({ questions: s.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) })),

  removeQuestion: (id) =>
    set((s) => ({ questions: s.questions.filter((q) => q.id !== id) })),

  questionsActionError: null,
  questionsActionLoading: false,
  savingQuestionId: null,

  syncQuestionsFromApi: (apiQuestions) =>
    set({
      questions: (apiQuestions || []).map(mapApiQuestion),
      generatedQuestions: apiQuestions || [],
    }),

  loadQuestionsFromBackend: async (projectId) => {
    if (!projectId) return false;
    try {
      const data = await questionApi.list(projectId);
      set({
        questions: (data.questions || []).map(mapApiQuestion),
        generatedQuestions: data.questions || [],
        generationProvider: data.generationProvider,
        questionsActionError: null,
      });
      if (data.examInfo) {
        set((s) => ({ examInfo: { ...s.examInfo, ...data.examInfo } }));
      }
      return true;
    } catch (err) {
      set({ questionsActionError: err?.response?.data?.error || err.message });
      return false;
    }
  },

  approveQuestion: async (id) => {
    const { projectId } = get();
    if (!projectId) {
      set((s) => ({
        questions: s.questions.map((q) => (q.id === id ? { ...q, approved: true } : q)),
      }));
      return;
    }
    set({ savingQuestionId: id, questionsActionError: null });
    try {
      const data = await questionApi.update(projectId, id, { approved: true });
      set({
        questions: (data.questions || []).map(mapApiQuestion),
        generatedQuestions: data.questions || [],
        savingQuestionId: null,
      });
    } catch (err) {
      set({
        questionsActionError: err?.response?.data?.error || err.message,
        savingQuestionId: null,
      });
    }
  },

  unapproveQuestion: async (id) => {
    const { projectId } = get();
    if (!projectId) {
      set((s) => ({
        questions: s.questions.map((q) => (q.id === id ? { ...q, approved: false } : q)),
      }));
      return;
    }
    set({ savingQuestionId: id, questionsActionError: null });
    try {
      const data = await questionApi.update(projectId, id, { approved: false });
      set({
        questions: (data.questions || []).map(mapApiQuestion),
        generatedQuestions: data.questions || [],
        savingQuestionId: null,
      });
    } catch (err) {
      set({
        questionsActionError: err?.response?.data?.error || err.message,
        savingQuestionId: null,
      });
    }
  },

  approveAllQuestions: async () => {
    const { projectId, questions } = get();
    if (!projectId || !questions.length) return false;
    set({ questionsActionLoading: true, questionsActionError: null });
    try {
      const data = await questionApi.approveSelection(
        projectId,
        questions.map((q) => q.id),
      );
      set({
        questions: (data.questions || []).map(mapApiQuestion),
        generatedQuestions: data.questions || [],
        questionsActionLoading: false,
      });
      return true;
    } catch (err) {
      set({
        questionsActionError: err?.response?.data?.error || err.message,
        questionsActionLoading: false,
      });
      return false;
    }
  },

  saveApprovedSelection: async (questionIds) => {
    const { projectId } = get();
    if (!projectId || !questionIds?.length) return false;
    set({ questionsActionLoading: true, questionsActionError: null });
    try {
      const data = await questionApi.approveSelection(projectId, questionIds);
      set({
        questions: (data.questions || []).map(mapApiQuestion),
        generatedQuestions: data.questions || [],
        questionsActionLoading: false,
      });
      return true;
    } catch (err) {
      set({
        questionsActionError: err?.response?.data?.error || err.message,
        questionsActionLoading: false,
      });
      return false;
    }
  },

  saveQuestionEdit: async (id, payload) => {
    const { projectId } = get();
    if (!projectId) return false;
    set({ savingQuestionId: id, questionsActionError: null });
    try {
      const data = await questionApi.update(projectId, id, payload);
      set({
        questions: (data.questions || []).map(mapApiQuestion),
        generatedQuestions: data.questions || [],
        savingQuestionId: null,
      });
      return true;
    } catch (err) {
      set({
        questionsActionError: err?.response?.data?.error || err.message,
        savingQuestionId: null,
      });
      return false;
    }
  },

  addQuestionToBackend: async (payload) => {
    const { projectId } = get();
    if (!projectId) return false;
    set({ questionsActionLoading: true, questionsActionError: null });
    try {
      const data = await questionApi.add(projectId, payload);
      set({
        questions: (data.questions || []).map(mapApiQuestion),
        generatedQuestions: data.questions || [],
        questionsActionLoading: false,
      });
      return true;
    } catch (err) {
      set({
        questionsActionError: err?.response?.data?.error || err.message,
        questionsActionLoading: false,
      });
      return false;
    }
  },

  deleteQuestionFromBackend: async (id) => {
    const { projectId } = get();
    if (!projectId) {
      set((s) => ({ questions: s.questions.filter((q) => q.id !== id) }));
      return true;
    }
    set({ savingQuestionId: id, questionsActionError: null });
    try {
      const data = await questionApi.delete(projectId, id);
      set({
        questions: (data.questions || []).map(mapApiQuestion),
        generatedQuestions: data.questions || [],
        savingQuestionId: null,
      });
      return true;
    } catch (err) {
      set({
        questionsActionError: err?.response?.data?.error || err.message,
        savingQuestionId: null,
      });
      return false;
    }
  },

  duplicateQuestion: async (id) => {
    const q = get().questions.find((item) => item.id === id);
    if (!q) return false;
    return get().addQuestionToBackend({
      questionText: q.text,
      type: q.type,
      difficulty: q.difficulty,
      marks: q.marks,
      topicName: q.topic,
      options: q.options || undefined,
      correctAnswer: q.answer || '',
      explanation: q.explanation || '',
    });
  },

  // Tracks which question IDs are currently being regenerated (for per-button spinner)
  regeneratingIds: new Set(),

  regenerateQuestion: async (questionId) => {
    const s = get();
    const projectId = s.projectId;
    const question  = s.questions.find((q) => q.id === questionId);

    // Mark as regenerating
    set((prev) => {
      const ids = new Set(prev.regeneratingIds);
      ids.add(questionId);
      return { regeneratingIds: ids };
    });

    try {
      // Fall back gracefully if there's no real projectId (demo mode)
      if (!projectId) {
        await new Promise((r) => setTimeout(r, 1200)); // simulate delay
        set((prev) => ({
          questions: prev.questions.map((q) =>
            q.id === questionId
              ? { ...q, approved: false, text: `[Regenerated] ${q.text}` }
              : q,
          ),
        }));
        return;
      }

      const data = await questionApi.regenerateSingle(projectId, questionId, {
        questionType: question?.type,
        topicName:    question?.topic,
        marks:        question?.marks,
        difficulty:   question?.difficulty,
      });

      const newQ = data.question;
      set((prev) => ({
        questions: prev.questions.map((q) =>
          q.id === questionId
            ? {
                ...q,
                text:        newQ.questionText,
                options:     newQ.options ?? q.options,
                answer:      newQ.correctAnswer,
                explanation: newQ.explanation,
                sourceEvidence: newQ.sourceEvidence || '',
                sourceFile:     newQ.sourceFile || '',
                sourcePage:     newQ.sourcePage ?? null,
                grounded:       newQ.grounded ?? false,
                approved:    false,
              }
            : q,
        ),
        questionsActionError: null,
      }));
    } catch (err) {
      set({ questionsActionError: err?.response?.data?.error || err.message });
    } finally {
      set((prev) => {
        const ids = new Set(prev.regeneratingIds);
        ids.delete(questionId);
        return { regeneratingIds: ids };
      });
    }
  },

  setOcrText: (id, text) =>
    set((s) => ({
      ocrResults: s.ocrResults.map((r) => (r.id === id ? { ...r, text } : r)),
    })),

  setEvaluation: (id, patch) =>
    set((s) => ({
      evaluations: s.evaluations.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  addReport: (report) =>
    set((s) => ({ reports: [report, ...s.reports] })),

  addUploadedFile: (file) =>
    set((s) => ({ uploadedFiles: [...s.uploadedFiles, { id: Date.now(), ...file }] })),

  removeUploadedFile: (id) =>
    set((s) => ({ uploadedFiles: s.uploadedFiles.filter((f) => f.id !== id) })),

  // ─── Real backend: upload PDFs and create project ─────────────────────────
  uploadPDFsToBackend: async (files, title, subject) => {
    set((s) => ({ loadingStates: { ...s.loadingStates, uploading: true }, topicsError: null }));
    try {
      const formData = new FormData();
      formData.append('title',   title   || 'Untitled Project');
      formData.append('subject', subject || '');
      files.forEach((f) => formData.append('pdfs', f));

      const data = await uploadApi.uploadPDFs(formData, (pct) => {
        // Update each uploaded file's progress in the store
        set((s) => ({
          uploadedFiles: s.uploadedFiles.map((uf) =>
            files.some((f) => f.name === uf.name) ? { ...uf, progress: pct } : uf
          ),
        }));
      });

      // Save projectId and add files to the uploaded list
      set((s) => {
        const next = {
          projectId: data.projectId,
          uploadedFiles: [
            ...s.uploadedFiles.filter((uf) => !files.some((f) => f.name === uf.name)),
            ...(data.documents || []).map((doc) => ({
              id:         doc.docId,
              name:       doc.filename,
              size:       'uploaded',
              pages:      doc.pageCount,
              uploadTime: new Date().toLocaleTimeString(),
              progress:   100,
              pdfUrl:     doc.pdfUrl,
            })),
          ],
          loadingStates: { ...s.loadingStates, uploading: false },
        };
        persistWorkflow({ projectId: next.projectId, m1CompletedStep: s.m1CompletedStep, examInfo: s.examInfo });
        return next;
      });

      return data.projectId;
    } catch (err) {
      set((s) => ({
        topicsError: err?.response?.data?.error || err.message || 'Upload failed',
        loadingStates: { ...s.loadingStates, uploading: false },
      }));
      return null;
    }
  },

  // ─── Real backend: detect topics via GPT-4o / Gemini ─────────────────────
  detectTopicsFromBackend: async (projectId) => {
    set({ topicsLoading: true, topicsError: null, topicsSaved: false });
    try {
      const data = await topicApi.detect(projectId);
      set({
        topics:          data.topics,           // already has isSelected: true
        detectedSubject: data.detectedSubject,
        llmProvider:     data.provider,
        topicsLoading:   false,
      });
      return data.topics;
    } catch (err) {
      set({
        topicsError:  err?.response?.data?.error || err.message || 'Topic detection failed',
        topicsLoading: false,
      });
      return null;
    }
  },

  // ─── Toggle a single topic's isSelected ──────────────────────────────────
  toggleTopicSelection: (id) =>
    set((s) => ({
      topics: s.topics.map((t) => (t.id === id ? { ...t, isSelected: !t.isSelected } : t)),
      topicsSaved: false,
    })),

  // ─── Bulk select/deselect all ────────────────────────────────────────────
  selectAllTopics:   () => set((s) => ({ topics: s.topics.map((t) => ({ ...t, isSelected: true  })), topicsSaved: false })),
  deselectAllTopics: () => set((s) => ({ topics: s.topics.map((t) => ({ ...t, isSelected: false })), topicsSaved: false })),

  // ─── Save topic selection to backend ─────────────────────────────────────
  saveTopicSelection: async (projectId) => {
    const topics = get().topics;
    try {
      await topicApi.updateSelection(
        projectId,
        topics.map((t) => ({
          id: t.id,
          isSelected: t.isSelected,
          marks: t.marks,
          weightage: t.weightage,
          difficulty: t.difficulty,
        }))
      );
      set({ topicsSaved: true });
      return true;
    } catch (err) {
      set({ topicsError: err?.response?.data?.error || err.message || 'Save failed' });
      return false;
    }
  },

  hydrateProjectFromBackend: async (projectId) => {
    if (!projectId) return false;
    try {
      const data = await topicApi.get(projectId);
      const patch = {
        topics: data.topics || [],
        detectedSubject: data.detectedSubject,
        generationProvider: data.generationProvider || null,
        topicsError: null,
      };
      if (data.examInfo?.examTitle || data.examInfo?.subject) {
        patch.examInfo = { ...get().examInfo, ...data.examInfo };
      }
      if (data.generatedQuestions?.length) {
        patch.generatedQuestions = data.generatedQuestions;
        patch.questions = data.generatedQuestions.map(mapApiQuestion);
        patch.m1CompletedStep = Math.max(get().m1CompletedStep, 4);
      } else if (data.topics?.length) {
        patch.m1CompletedStep = Math.max(get().m1CompletedStep, 2);
      }
      set(patch);
      persistWorkflow({
        projectId,
        m1CompletedStep: patch.m1CompletedStep ?? get().m1CompletedStep,
        examInfo: patch.examInfo ?? get().examInfo,
      });
      return true;
    } catch (err) {
      console.error('[store] hydrateProjectFromBackend failed:', err?.response?.data?.error || err.message);
      return false;
    }
  },

  // ─── Update exam info ────────────────────────────────────────────────────
  setExamInfo: (patch) =>
    set((s) => {
      const examInfo = { ...s.examInfo, ...patch };
      persistWorkflow({ projectId: s.projectId, m1CompletedStep: s.m1CompletedStep, examInfo });
      return { examInfo };
    }),

  setQuestionType: (type, patch) =>
    set((s) => ({
      examInfo: {
        ...s.examInfo,
        questionTypes: {
          ...s.examInfo.questionTypes,
          [type]: { ...s.examInfo.questionTypes[type], ...patch },
        },
      },
    })),

  // ─── Update per-topic config (marks, weightage, difficulty) ──────────────────
  updateTopicConfig: (id, patch) =>
    set((s) => ({
      topics: s.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  // ─── Generate questions via LLM ─────────────────────────────────────────────
  generateQuestionsFromBackend: async (projectId) => {
    const s = get();
    set({ questionsLoading: true, questionsError: null });

    // Only include selected topics
    const selectedTopics = s.topics
      .filter((t) => t.isSelected)
      .map((t) => ({
        topicName:     t.name,
        weightage:     t.weightage     || 0,
        marks:         t.marks         || 0,
        difficulty:    t.difficulty    || 'Mixed',
        // Used server-side to retrieve the PDF passages for this topic.
        description:   t.description   || '',
        keywords:      t.keywords      || [],
      }));

    try {
      const data = await questionApi.generate(projectId, {
        examInfo: s.examInfo,
        topics:   selectedTopics,
      });
      set({
        generatedQuestions: data.questions,
        generationProvider: data.provider,
        groundedCount:      data.groundedCount ?? 0,
        generationWarnings: data.warnings || [],
        questionsLoading:   false,
        questions: data.questions.map(mapApiQuestion),
      });
      return data.questions;
    } catch (err) {
      set({
        questionsError:   err?.response?.data?.error || err.message || 'Question generation failed',
        questionsLoading: false,
      });
      return null;
    }
  },

  // ─── Computed helpers ──────────────────────────────────────────────────────
  activeQuestionCount: () => get().questions.length,

  getSessionById: (id) =>
    get().examSessions.find((s) => s.id === id),

  getStudentsForSession: (sessionId) =>
    get().studentEvaluations.filter((s) => s.sessionId === sessionId),

  getFlagsForSession: (sessionId) =>
    get().flaggedResponsesData.filter((f) => f.sessionId === sessionId),

  finalizedSessionId: null,
  finalizeLoading:    false,
  finalizeError:      null,

  finalizeExamSession: async (projectId) => {
    if (!projectId) return null;
    set({ finalizeLoading: true, finalizeError: null });
    try {
      const data = await sessionApi.finalize(projectId);
      const s = data.session;
      const mapped = mapApiSession(s, s.questions);
      set((state) => ({
        finalizedSessionId: s.id,
        finalizeLoading:    false,
        examSessions: [
          mapped,
          ...state.examSessions.filter(
            (es) => es.id !== s.id && es.projectId !== s.projectId
          ),
        ],
        selectedSessionId: s.id,
      }));
      localStorage.setItem('vg_session_id', s.id);
      get().completeM1Step(6);
      return s;
    } catch (err) {
      set({
        finalizeError:   err?.response?.data?.error || err.message || 'Finalize failed',
        finalizeLoading: false,
      });
      return null;
    }
  },

  fetchSessionById: async (sessionId) => {
    if (!sessionId) return null;
    try {
      const data = await sessionApi.get(sessionId);
      const s = data.session;
      const mapped = mapApiSession(s, s.questions);
      set((state) => ({
        examSessions: [
          mapped,
          ...state.examSessions.filter((es) => es.id !== mapped.id),
        ],
      }));
      return mapped;
    } catch {
      return null;
    }
  },

  loadSessionsFromBackend: async () => {
    set({ sessionsLoading: true });
    try {
      const data = await sessionApi.list();
      const mapped = (data.sessions || []).map((s) => mapApiSession(s));
      set((state) => ({
        sessionsLoading: false,
        examSessions: mapped,
        selectedSessionId: state.selectedSessionId || mapped[0]?.id || null,
      }));
      get().loadEvaluationOverview();
      return mapped;
    } catch {
      set({ sessionsLoading: false });
      return [];
    }
  },

  /** Merges real Module 2 evaluation stats (evaluated/pending/avg score) into examSessions. */
  loadEvaluationOverview: async () => {
    try {
      const data = await evaluationApi.overview();
      const bySession = new Map((data.overview || []).map((o) => [String(o.sessionId), o]));
      set((state) => ({
        examSessions: state.examSessions.map((sess) => {
          const o = bySession.get(String(sess.id));
          if (!o) return sess;
          return {
            ...sess,
            studentsEvaluated: o.evaluated,
            pendingSheets: o.pending,
            avgScore: o.averagePercentage,
            evaluationDate: o.lastEvaluatedAt,
          };
        }),
      }));
    } catch {
      // Non-critical — dashboard just falls back to zeros for eval stats.
    }
  },

  answerSheets: [],
  evaluationReports: [],
  evaluationSummary: null,
  currentAnswerSheetId: localStorage.getItem('vg_sheet_id') || null,
  evaluationError: null,

  setCurrentAnswerSheet: (id) => {
    if (id) localStorage.setItem('vg_sheet_id', id);
    else localStorage.removeItem('vg_sheet_id');
    set({ currentAnswerSheetId: id });
  },

  loadAnswerSheets: async (sessionId) => {
    if (!sessionId) {
      set({ answerSheets: [] });
      return [];
    }
    try {
      const data = await ocrApi.listBySession(sessionId);
      const sheets = data.sheets || [];
      set({ answerSheets: sheets });
      return sheets;
    } catch {
      set({ answerSheets: [] });
      return [];
    }
  },

  loadEvaluationReports: async (sessionId) => {
    if (!sessionId) {
      set({ evaluationReports: [], evaluationSummary: null });
      return null;
    }
    try {
      const data = await evaluationApi.list(sessionId);
      set({
        evaluationReports: data.reports || [],
        evaluationSummary: data.summary || null,
        evaluationError: null,
      });
      return data;
    } catch (err) {
      set({
        evaluationError: err?.response?.data?.error || err.message || 'Failed to load evaluations',
      });
      return null;
    }
  },
}));