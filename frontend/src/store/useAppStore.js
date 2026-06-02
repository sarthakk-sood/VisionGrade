import { create } from 'zustand';

// ─── Exam Sessions ────────────────────────────────────────────────────────────
const examSessions = [
  {
    id: 'ES-2026-001',
    examName: 'DBMS Mid Semester Examination',
    subject: 'Database Management Systems',
    subjectCode: 'CS401',
    academicYear: '2025–26',
    semester: 'IV Semester',
    session: 'Mid Semester 2026',
    totalMarks: 100,
    questionCount: 17,
    questionType: 'Mixed',
    difficulty: 'Mixed',
    dateCreated: '2026-05-12',
    dateGenerated: '2026-05-12',
    status: 'Evaluated',
    topics: [
      { id: 1, name: 'Database Normalization',       weightage: 25, marks: 25, questionCount: 4 },
      { id: 2, name: 'Indexing & Query Optimization', weightage: 20, marks: 20, questionCount: 3 },
      { id: 3, name: 'Transaction Management',        weightage: 20, marks: 20, questionCount: 3 },
      { id: 4, name: 'Concurrency Control',           weightage: 15, marks: 15, questionCount: 3 },
      { id: 5, name: 'Recovery Techniques',           weightage: 10, marks: 10, questionCount: 2 },
      { id: 6, name: 'Distributed Databases',         weightage: 10, marks: 10, questionCount: 2 },
    ],
    studentsEvaluated: 32,
    flaggedResponses: 7,
    avgScore: 76.4,
    evaluationDate: '2026-05-28',
  },
  {
    id: 'ES-2026-002',
    examName: 'Operating Systems End Semester',
    subject: 'Operating Systems',
    subjectCode: 'CS302',
    academicYear: '2025–26',
    semester: 'III Semester',
    session: 'End Semester 2026',
    totalMarks: 80,
    questionCount: 14,
    questionType: 'Theory',
    difficulty: 'Hard',
    dateCreated: '2026-04-20',
    dateGenerated: '2026-04-20',
    status: 'Generated',
    topics: [
      { id: 1, name: 'Process Management',  weightage: 30, marks: 24, questionCount: 4 },
      { id: 2, name: 'Memory Management',   weightage: 25, marks: 20, questionCount: 3 },
      { id: 3, name: 'File Systems',        weightage: 20, marks: 16, questionCount: 3 },
      { id: 4, name: 'Deadlock Handling',   weightage: 15, marks: 12, questionCount: 2 },
      { id: 5, name: 'CPU Scheduling',      weightage: 10, marks:  8, questionCount: 2 },
    ],
    studentsEvaluated: 0,
    flaggedResponses: 0,
    avgScore: 0,
    evaluationDate: null,
  },
  {
    id: 'ES-2026-003',
    examName: 'AI & Machine Learning Quiz 03',
    subject: 'Artificial Intelligence',
    subjectCode: 'CS501',
    academicYear: '2025–26',
    semester: 'V Semester',
    session: 'Quiz 3 — 2026',
    totalMarks: 40,
    questionCount: 20,
    questionType: 'MCQ',
    difficulty: 'Medium',
    dateCreated: '2026-05-30',
    dateGenerated: '2026-05-30',
    status: 'Exported',
    topics: [
      { id: 1, name: 'Neural Networks',            weightage: 40, marks: 16, questionCount: 8 },
      { id: 2, name: 'Search Algorithms',           weightage: 35, marks: 14, questionCount: 7 },
      { id: 3, name: 'Knowledge Representation',    weightage: 25, marks: 10, questionCount: 5 },
    ],
    studentsEvaluated: 45,
    flaggedResponses: 3,
    avgScore: 82.1,
    evaluationDate: '2026-05-31',
  },
  {
    id: 'ES-2026-004',
    examName: 'Computer Networks Lab Practical',
    subject: 'Computer Networks',
    subjectCode: 'CS403',
    academicYear: '2025–26',
    semester: 'IV Semester',
    session: 'Lab Practical 2026',
    totalMarks: 50,
    questionCount: 10,
    questionType: 'Theory',
    difficulty: 'Easy',
    dateCreated: '2026-05-15',
    dateGenerated: '2026-05-15',
    status: 'Draft',
    topics: [
      { id: 1, name: 'TCP/IP Protocol Suite', weightage: 40, marks: 20, questionCount: 4 },
      { id: 2, name: 'Network Security',       weightage: 30, marks: 15, questionCount: 3 },
      { id: 3, name: 'Routing Algorithms',     weightage: 30, marks: 15, questionCount: 3 },
    ],
    studentsEvaluated: 0,
    flaggedResponses: 0,
    avgScore: 0,
    evaluationDate: null,
  },
  {
    id: 'ES-2026-005',
    examName: 'Software Engineering Internal Test',
    subject: 'Software Engineering',
    subjectCode: 'CS404',
    academicYear: '2025–26',
    semester: 'IV Semester',
    session: 'Internal Test 2026',
    totalMarks: 60,
    questionCount: 12,
    questionType: 'Mixed',
    difficulty: 'Medium',
    dateCreated: '2026-06-01',
    dateGenerated: '2026-06-01',
    status: 'Evaluating',
    topics: [
      { id: 1, name: 'SDLC Models',       weightage: 30, marks: 18, questionCount: 4 },
      { id: 2, name: 'Agile & Scrum',     weightage: 25, marks: 15, questionCount: 3 },
      { id: 3, name: 'Testing Strategies', weightage: 25, marks: 15, questionCount: 3 },
      { id: 4, name: 'Design Patterns',   weightage: 20, marks: 12, questionCount: 2 },
    ],
    studentsEvaluated: 18,
    flaggedResponses: 5,
    avgScore: 71.3,
    evaluationDate: '2026-06-02',
  },
];

// ─── Student Evaluations ──────────────────────────────────────────────────────
const studentEvaluations = [
  {
    id: 1, sessionId: 'ES-2026-001',
    studentName: 'Aarav Sharma', rollNo: 'CS2026-014',
    marksObtained: 86, totalMarks: 100, percentage: 86, flagCount: 1, status: 'Evaluated',
    questionWiseMarks: [
      { qNo: 'Q1', question: 'Explain 1NF, 2NF, and 3NF with examples',            maxMarks: 15, obtained: 14, flagged: false },
      { qNo: 'Q2', question: 'Clustered vs non-clustered indexing',                 maxMarks: 10, obtained:  9, flagged: false },
      { qNo: 'Q3', question: 'Transaction states and ACID properties',              maxMarks: 15, obtained:  9, flagged: true  },
      { qNo: 'Q4', question: 'Two-phase locking protocol',                          maxMarks: 10, obtained:  9, flagged: false },
      { qNo: 'Q5', question: 'Compare B-tree and Hash indexing',                    maxMarks: 10, obtained:  9, flagged: false },
      { qNo: 'Q6', question: 'Distributed database architecture',                   maxMarks: 20, obtained: 18, flagged: false },
      { qNo: 'Q7', question: 'MCQ Section — 5 × 4 marks',                          maxMarks: 20, obtained: 18, flagged: false },
    ],
    strengths: ['Correct ACID explanation', 'Strong diagramming', 'Well-structured answers'],
    weaknesses: ['Minor formatting issues in Q3', 'Handwriting unclear near diagram'],
    feedback: 'Excellent conceptual clarity with only small presentation gaps. Strong understanding of normalization and indexing.',
  },
  {
    id: 2, sessionId: 'ES-2026-001',
    studentName: 'Meera Iyer', rollNo: 'CS2026-021',
    marksObtained: 73, totalMarks: 100, percentage: 73, flagCount: 3, status: 'Flagged',
    questionWiseMarks: [
      { qNo: 'Q1', question: 'Explain 1NF, 2NF, and 3NF with examples',            maxMarks: 15, obtained: 12, flagged: false },
      { qNo: 'Q2', question: 'Clustered vs non-clustered indexing',                 maxMarks: 10, obtained:  5, flagged: true  },
      { qNo: 'Q3', question: 'Transaction states and ACID properties',              maxMarks: 15, obtained: 10, flagged: false },
      { qNo: 'Q4', question: 'Two-phase locking protocol',                          maxMarks: 10, obtained:  8, flagged: false },
      { qNo: 'Q5', question: 'Compare B-tree and Hash indexing',                    maxMarks: 10, obtained:  6, flagged: true  },
      { qNo: 'Q6', question: 'Distributed database architecture',                   maxMarks: 20, obtained: 16, flagged: false },
      { qNo: 'Q7', question: 'MCQ Section — 5 × 4 marks',                          maxMarks: 20, obtained: 16, flagged: true  },
    ],
    strengths: ['Clear transaction definition', 'Good normalization examples'],
    weaknesses: ['Incomplete answer for Q2 — cut off at page edge', 'OCR flags on Q5 and Q7'],
    feedback: 'Solid attempt; partial credit applied for complete sub-parts. OCR review recommended for flagged sections.',
  },
  {
    id: 3, sessionId: 'ES-2026-001',
    studentName: 'Kabir Singh', rollNo: 'CS2026-033',
    marksObtained: 91, totalMarks: 100, percentage: 91, flagCount: 1, status: 'Evaluated',
    questionWiseMarks: [
      { qNo: 'Q1', question: 'Explain 1NF, 2NF, and 3NF with examples',            maxMarks: 15, obtained: 15, flagged: false },
      { qNo: 'Q2', question: 'Clustered vs non-clustered indexing',                 maxMarks: 10, obtained: 10, flagged: false },
      { qNo: 'Q3', question: 'Transaction states and ACID properties',              maxMarks: 15, obtained: 12, flagged: true  },
      { qNo: 'Q4', question: 'Two-phase locking protocol',                          maxMarks: 10, obtained:  9, flagged: false },
      { qNo: 'Q5', question: 'Compare B-tree and Hash indexing',                    maxMarks: 10, obtained:  9, flagged: false },
      { qNo: 'Q6', question: 'Distributed database architecture',                   maxMarks: 20, obtained: 18, flagged: false },
      { qNo: 'Q7', question: 'MCQ Section — 5 × 4 marks',                          maxMarks: 20, obtained: 18, flagged: false },
    ],
    strengths: ['Precise indexing analysis', 'Strong technical structure', 'Excellent diagrams'],
    weaknesses: ['Slight OCR ambiguity in Q3 diagram section'],
    feedback: 'High quality work with strong technical reasoning. Top performer in batch.',
  },
  {
    id: 4, sessionId: 'ES-2026-001',
    studentName: 'Priya Nair', rollNo: 'CS2026-045',
    marksObtained: 78, totalMarks: 100, percentage: 78, flagCount: 0, status: 'Evaluated',
    questionWiseMarks: [
      { qNo: 'Q1', question: 'Explain 1NF, 2NF, and 3NF with examples',            maxMarks: 15, obtained: 12, flagged: false },
      { qNo: 'Q2', question: 'Clustered vs non-clustered indexing',                 maxMarks: 10, obtained:  7, flagged: false },
      { qNo: 'Q3', question: 'Transaction states and ACID properties',              maxMarks: 15, obtained: 11, flagged: false },
      { qNo: 'Q4', question: 'Two-phase locking protocol',                          maxMarks: 10, obtained:  8, flagged: false },
      { qNo: 'Q5', question: 'Compare B-tree and Hash indexing',                    maxMarks: 10, obtained:  8, flagged: false },
      { qNo: 'Q6', question: 'Distributed database architecture',                   maxMarks: 20, obtained: 16, flagged: false },
      { qNo: 'Q7', question: 'MCQ Section — 5 × 4 marks',                          maxMarks: 20, obtained: 16, flagged: false },
    ],
    strengths: ['Consistent performance', 'Good conceptual coverage'],
    weaknesses: ['Could improve depth on indexing strategies'],
    feedback: 'Good overall performance with room for improvement in indexing concepts.',
  },
  {
    id: 5, sessionId: 'ES-2026-001',
    studentName: 'Rahul Verma', rollNo: 'CS2026-052',
    marksObtained: 65, totalMarks: 100, percentage: 65, flagCount: 4, status: 'Flagged',
    questionWiseMarks: [
      { qNo: 'Q1', question: 'Explain 1NF, 2NF, and 3NF with examples',            maxMarks: 15, obtained:  8, flagged: true  },
      { qNo: 'Q2', question: 'Clustered vs non-clustered indexing',                 maxMarks: 10, obtained:  7, flagged: false },
      { qNo: 'Q3', question: 'Transaction states and ACID properties',              maxMarks: 15, obtained: 10, flagged: true  },
      { qNo: 'Q4', question: 'Two-phase locking protocol',                          maxMarks: 10, obtained:  5, flagged: true  },
      { qNo: 'Q5', question: 'Compare B-tree and Hash indexing',                    maxMarks: 10, obtained:  5, flagged: true  },
      { qNo: 'Q6', question: 'Distributed database architecture',                   maxMarks: 20, obtained: 15, flagged: false },
      { qNo: 'Q7', question: 'MCQ Section — 5 × 4 marks',                          maxMarks: 20, obtained: 15, flagged: false },
    ],
    strengths: ['Basic concepts understood'],
    weaknesses: ['Poor handwriting causing OCR issues', 'Incomplete answers in multiple sections'],
    feedback: 'Partial understanding shown; several answers require manual review due to OCR confidence issues.',
  },
];

// ─── Flagged Responses ────────────────────────────────────────────────────────
const flaggedResponsesData = [
  { id: 1, sessionId: 'ES-2026-001', studentName: 'Aarav Sharma', rollNo: 'CS2026-014', questionNo: 'Q3', confidenceScore: 61, reason: 'Bad Handwriting',           confidence: 'Low',    ocrText: 'The answer mentions locking but handwriting is partially unclear near the diagram area.' },
  { id: 2, sessionId: 'ES-2026-001', studentName: 'Meera Iyer',   rollNo: 'CS2026-021', questionNo: 'Q2', confidenceScore: 72, reason: 'Answer Partially Visible',   confidence: 'Medium', ocrText: 'Normalization reduces redundancy and improves integrity. Clustered index... [text cut off at page edge]' },
  { id: 3, sessionId: 'ES-2026-001', studentName: 'Meera Iyer',   rollNo: 'CS2026-021', questionNo: 'Q5', confidenceScore: 58, reason: 'OCR Confidence Low',         confidence: 'Low',    ocrText: 'The candidate describes B-tree indexing but the comparison with hash index is unclear due to smudging.' },
  { id: 4, sessionId: 'ES-2026-001', studentName: 'Meera Iyer',   rollNo: 'CS2026-021', questionNo: 'Q7', confidenceScore: 74, reason: 'Question Mapping Uncertain', confidence: 'Medium', ocrText: 'MCQ responses partially overwritten; optical mark recognition uncertain for questions 3 and 4.' },
  { id: 5, sessionId: 'ES-2026-001', studentName: 'Rahul Verma',  rollNo: 'CS2026-052', questionNo: 'Q1', confidenceScore: 55, reason: 'Bad Handwriting',           confidence: 'Low',    ocrText: 'Primary key constraints definition is partially legible; normalization steps are unclear.' },
  { id: 6, sessionId: 'ES-2026-001', studentName: 'Rahul Verma',  rollNo: 'CS2026-052', questionNo: 'Q3', confidenceScore: 45, reason: 'Question Mapping Uncertain', confidence: 'Low',    ocrText: 'Response appears to address a different topic than the transaction states question mapped by OCR.' },
  { id: 7, sessionId: 'ES-2026-001', studentName: 'Rahul Verma',  rollNo: 'CS2026-052', questionNo: 'Q4', confidenceScore: 52, reason: 'OCR Confidence Low',         confidence: 'Low',    ocrText: 'Two-phase locking explanation is partially visible; remainder of text is smudged and illegible.' },
  { id: 8, sessionId: 'ES-2026-001', studentName: 'Rahul Verma',  rollNo: 'CS2026-052', questionNo: 'Q5', confidenceScore: 63, reason: 'Bad Handwriting',           confidence: 'Medium', ocrText: 'Hash indexing uses... [unclear text]... compared to B-tree which allows range queries.' },
  { id: 9, sessionId: 'ES-2026-005', studentName: 'Divya Krishnan', rollNo: 'CS2026-011', questionNo: 'Q2', confidenceScore: 69, reason: 'Answer Partially Visible', confidence: 'Medium', ocrText: 'Agile sprint planning process described but answer is cut off before conclusion.' },
  { id: 10, sessionId: 'ES-2026-005', studentName: 'Anil Mehta',  rollNo: 'CS2026-027', questionNo: 'Q4', confidenceScore: 48, reason: 'OCR Confidence Low',        confidence: 'Low',    ocrText: 'Design pattern classification partially legible; singleton and factory descriptions are unclear.' },
];

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
const dashboardStats = [
  { label: 'Total Exam Sessions',     value: '5',  delta: '+2 this month'  },
  { label: 'Question Papers Generated', value: '5', delta: 'All sessions'  },
  { label: 'Answer Sheets Evaluated', value: '95', delta: '+45 this week'  },
  { label: 'Flagged Responses',       value: '15', delta: '7 need review'  },
];

// ─── Activity Timeline ────────────────────────────────────────────────────────
const activityTimeline = [
  { id: 1, time: '2h ago',  title: 'Evaluation completed',    detail: 'DBMS Mid Semester — 32 students evaluated, 7 flagged.',           type: 'evaluation' },
  { id: 2, time: '5h ago',  title: 'Question paper exported', detail: 'AI & ML Quiz 03 exported as PDF + DOCX package.',               type: 'export'     },
  { id: 3, time: '1d ago',  title: 'OCR review completed',    detail: 'SE Internal Test — low confidence regions flagged for review.', type: 'ocr'        },
  { id: 4, time: '2d ago',  title: 'New session created',     detail: 'Software Engineering Internal Test — 12 questions generated.',  type: 'session'    },
  { id: 5, time: '3d ago',  title: 'Blueprint finalized',     detail: 'Computer Networks — 10 questions, 50 marks configured.',        type: 'blueprint'  },
];

// ─── Topics ───────────────────────────────────────────────────────────────────
const topics = [
  { id: 1, title: 'Database Normalization',       weight: 25, marks: 25, questionCount: 4, status: 'Approved'     },
  { id: 2, title: 'Indexing & Query Optimization', weight: 20, marks: 20, questionCount: 3, status: 'Approved'     },
  { id: 3, title: 'Transaction Management',        weight: 20, marks: 20, questionCount: 3, status: 'Needs Review' },
  { id: 4, title: 'Concurrency Control',           weight: 15, marks: 15, questionCount: 3, status: 'Approved'     },
  { id: 5, title: 'Recovery Techniques',           weight: 10, marks: 10, questionCount: 2, status: 'Needs Review' },
  { id: 6, title: 'Distributed Databases',         weight: 10, marks: 10, questionCount: 2, status: 'Approved'     },
];

// ─── Blueprint ────────────────────────────────────────────────────────────────
const blueprint = {
  totalMarks: 100,
  sections: [
    { id: 1, name: 'Part A — MCQ',         marks: 20, questions: 10, difficulty: 'Easy'   },
    { id: 2, name: 'Part B — Short Answer', marks: 40, questions: 5,  difficulty: 'Medium' },
    { id: 3, name: 'Part C — Long Answer',  marks: 40, questions: 2,  difficulty: 'Hard'   },
  ],
  difficultySplit: { easy: 20, medium: 40, hard: 40 },
};

// ─── Questions ────────────────────────────────────────────────────────────────
const questions = [
  { id: 1, type: 'MCQ',   text: 'Which normal form eliminates transitive functional dependencies?',                                                   topic: 'Database Normalization',       marks:  2, difficulty: 'Easy',   approved: true  },
  { id: 2, type: 'Short', text: 'Define indexing and explain the difference between clustered and non-clustered indexes.',                            topic: 'Indexing & Query Optimization', marks:  8, difficulty: 'Medium', approved: true  },
  { id: 3, type: 'Long',  text: 'Describe all transaction states with a state diagram and explain the ACID properties with real-world examples.',     topic: 'Transaction Management',        marks: 15, difficulty: 'Hard',   approved: false },
  { id: 4, type: 'MCQ',   text: 'Which of the following is NOT a property of a well-normalized relational schema?',                                   topic: 'Database Normalization',       marks:  2, difficulty: 'Easy',   approved: true  },
  { id: 5, type: 'Long',  text: 'Analyze and design a distributed database schema for a national university admissions system. Justify your fragmentation and replication strategy.', topic: 'Distributed Databases', marks: 20, difficulty: 'Hard', approved: false },
  { id: 6, type: 'Short', text: 'Explain the two-phase locking (2PL) protocol and its variants used to ensure serializability.',                      topic: 'Concurrency Control',           marks: 10, difficulty: 'Medium', approved: true  },
  { id: 7, type: 'MCQ',   text: 'In B+ tree indexing, what is the time complexity of a search operation?',                                            topic: 'Indexing & Query Optimization', marks:  2, difficulty: 'Easy',   approved: true  },
];

// ─── OCR Results ─────────────────────────────────────────────────────────────
const ocrResults = [
  { id: 1, question: 'Q1', confidence: 97, status: 'High',   text: 'The candidate defines primary key and foreign key accurately with correct SQL syntax.' },
  { id: 2, question: 'Q2', confidence: 82, status: 'Medium', text: 'Normalization reduces redundancy and improves referential integrity across related tables.' },
  { id: 3, question: 'Q3', confidence: 61, status: 'Low',    text: 'The answer mentions locking but the handwriting is partially unclear near the transaction diagram.' },
  { id: 4, question: 'Q4', confidence: 74, status: 'Medium', text: 'The response compares B-tree and hash indexing with reasonable accuracy.' },
  { id: 5, question: 'Q5', confidence: 91, status: 'High',   text: 'Two-phase locking protocol is correctly described with grow and shrink phases.' },
];

// ─── Evaluations ─────────────────────────────────────────────────────────────
const evaluations = [
  { id: 1, student: 'Aarav Sharma', rollNo: 'CS2026-014', score: 86, status: 'Completed',   strengths: ['Correct ACID explanation', 'Strong diagramming'], weaknesses: ['Minor formatting issues'],         feedback: 'Excellent conceptual clarity with only small presentation gaps.' },
  { id: 2, student: 'Meera Iyer',   rollNo: 'CS2026-021', score: 73, status: 'Needs review', strengths: ['Clear transaction definition', 'Good examples'],  weaknesses: ['Incomplete normalization answer'],  feedback: 'Solid attempt; partial credit applied for complete sub-parts.' },
  { id: 3, student: 'Kabir Singh',  rollNo: 'CS2026-033', score: 91, status: 'Completed',   strengths: ['Precise indexing analysis', 'Strong structure'],  weaknesses: ['Slight OCR ambiguity in Q3'],      feedback: 'High quality work with strong technical reasoning.' },
];

// ─── Reports ──────────────────────────────────────────────────────────────────
const reports = [
  { id: 1, title: 'Final Marksheet DOCX',    format: 'DOCX', size: '2.4 MB', downloadLabel: 'Download DOCX' },
  { id: 2, title: 'Evaluation Summary PDF',  format: 'PDF',  size: '1.8 MB', downloadLabel: 'Download PDF'  },
  { id: 3, title: 'Batch Export ZIP',        format: 'ZIP',  size: '8.9 MB', downloadLabel: 'Download ZIP'  },
];

// ─── Uploaded Files ───────────────────────────────────────────────────────────
const uploadedFiles = [
  { id: 1, name: 'DBMS_Syllabus_2026.pdf',        size: '4.2 MB', pages: 24, uploadTime: '10:23 AM', progress: 100 },
  { id: 2, name: 'Previous_Year_Questions.pdf',    size: '2.8 MB', pages: 18, uploadTime: '10:24 AM', progress: 100 },
  { id: 3, name: 'Topic_Coverage_Guide.pdf',       size: '1.6 MB', pages: 12, uploadTime: '10:25 AM', progress: 100 },
];

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAppStore = create((set, get) => ({
  user: {
    name: 'Dr. Ananya Rao',
    role: 'Faculty Evaluator',
    email: 'ananya.rao@visiongrade.edu',
    institution: 'NIT Trichy',
  },
  session: {
    id: 'VG-2026-MIDSEM-07',
    course: 'Database Management Systems',
    batch: 'B.Tech CSE 2026',
    activeModule: 'module1',
    progress: 68,
  },

  // Data
  examSessions,
  studentEvaluations,
  flaggedResponsesData,
  selectedSessionId: 'ES-2026-001',
  dashboardStats,
  activityTimeline,
  topics,
  blueprint,
  questions,
  ocrResults,
  evaluations,
  reports,
  uploadedFiles,

  loadingStates: { uploading: false, generating: false, ocrReview: false, evaluating: false },

  // ─── Actions ───────────────────────────────────────────────────────────────
  setLoadingState: (key, value) =>
    set((s) => ({ loadingStates: { ...s.loadingStates, [key]: value } })),

  setUser:    (user)    => set({ user }),
  setSession: (session) => set({ session }),

  selectSession: (id) => set({ selectedSessionId: id }),

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

  regenerateQuestion: (id) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === id ? { ...q, approved: false, text: `${q.text} (regenerated)` } : q,
      ),
    })),

  approveQuestion: (id) =>
    set((s) => ({
      questions: s.questions.map((q) => (q.id === id ? { ...q, approved: true } : q)),
    })),

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

  // ─── Computed helpers ──────────────────────────────────────────────────────
  activeQuestionCount: () => get().questions.length,

  getSessionById: (id) =>
    get().examSessions.find((s) => s.id === id),

  getStudentsForSession: (sessionId) =>
    get().studentEvaluations.filter((s) => s.sessionId === sessionId),

  getFlagsForSession: (sessionId) =>
    get().flaggedResponsesData.filter((f) => f.sessionId === sessionId),
}));