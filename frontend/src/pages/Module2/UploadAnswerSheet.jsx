/**
 * UploadAnswerSheet.jsx — Module 2, Steps 1 & 2
 * Store the sheet on Cloudinary, then score from the photo with a vision LLM (no OCR).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate }                   from 'react-router-dom';
import { motion, AnimatePresence }       from 'framer-motion';
import {
  ArrowRight, ArrowLeft, ScanLine, User, CheckCircle2,
  FileText, Upload, X, AlertCircle, Loader2,
} from 'lucide-react';

import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import StatusBadge   from '../../components/common/StatusBadge';
import ProgressBar   from '../../components/common/ProgressBar';
import EmptyState    from '../../components/common/EmptyState';
import { useAppStore } from '../../store/useAppStore';
import { ocrApi }    from '../../services/api';
import { PAGE_BG }   from '../../utils/theme';

const M2_STEPS = ['Select Exam', 'Upload Sheets', 'Review', 'Results'];

const STATUS_TONE = {
  Evaluated: 'success', Exported: 'success',
  Evaluating: 'warning', Generated: 'info', Draft: 'neutral',
};

const MAX_FILE_MB = 50;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff'];

export default function UploadAnswerSheet() {
  const navigate = useNavigate();

  const examSessions      = useAppStore((s) => s.examSessions);
  const selectedSessionId = useAppStore((s) => s.selectedSessionId);
  const selectSession     = useAppStore((s) => s.selectSession);
  const loadSessionsFromBackend = useAppStore((s) => s.loadSessionsFromBackend);
  const sessionsLoading   = useAppStore((s) => s.sessionsLoading);
  const answerSheets      = useAppStore((s) => s.answerSheets);
  const loadAnswerSheets  = useAppStore((s) => s.loadAnswerSheets);
  const setCurrentAnswerSheet = useAppStore((s) => s.setCurrentAnswerSheet);

  const [phase, setPhase]           = useState(1);
  const [file, setFile]             = useState(null);
  const [rollNumber, setRollNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadPct, setUploadPct]   = useState(0);

  // 'idle' | 'uploading' | 'done' | 'error'
  const [status, setStatus]   = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef(null);
  const selectedSession = examSessions.find((s) => s.id === selectedSessionId) ?? null;

  useEffect(() => {
    loadSessionsFromBackend();
  }, [loadSessionsFromBackend]);

  useEffect(() => {
    if (selectedSessionId) loadAnswerSheets(selectedSessionId);
  }, [selectedSessionId, loadAnswerSheets]);

  // ── File helpers ─────────────────────────────────────────────────────────────
  const validateFile = (f) => {
    if (!f) return 'No file selected.';
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.toLowerCase().endsWith('.pdf')) {
      return 'Upload a PDF or image (JPEG, PNG, WebP, TIFF).';
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) return `File exceeds ${MAX_FILE_MB} MB limit.`;
    return null;
  };

  const pickFile = (f) => {
    const err = validateFile(f);
    if (err) { setErrorMsg(err); return; }
    setFile(f);
    setErrorMsg('');
    setStatus('idle');
  };

  const onInputChange = (e) => { if (e.target.files?.[0]) pickFile(e.target.files[0]); };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!file) { setErrorMsg('Please select a PDF or image file.'); return; }
    if (!rollNumber.trim()) { setErrorMsg('Roll number is required.'); return; }
    if (!selectedSessionId) { setErrorMsg('Select an exam session first.'); return; }

    setErrorMsg('');
    setStatus('uploading');
    setUploadPct(0);

    const form = new FormData();
    form.append('pdf', file);
    form.append('rollNumber', rollNumber.trim());
    if (studentName.trim()) form.append('studentName', studentName.trim());
    if (selectedSessionId)  form.append('sessionId', selectedSessionId);

    try {
      const resp = await ocrApi.extract(form, (pct) => {
        setUploadPct(pct);
      });

      setStatus('done');
      if (resp.data?.answerSheetId) setCurrentAnswerSheet(resp.data.answerSheetId);
      await loadAnswerSheets(selectedSessionId);
      navigate('/module2/mapping');

    } catch (err) {
      setStatus('error');
      const serverMsg = err?.response?.data?.error
        || err?.response?.data?.detail
        || err?.message
        || 'Upload failed. Please try again.';

      setErrorMsg(serverMsg);
    }
  };

  const isLoading = status === 'uploading';

  // ── Phase 1: Select Exam ──────────────────────────────────────────────────────
  if (phase === 1) {
    return (
      <div className={PAGE_BG}>
        <Navbar />
        <PageContainer subtitle="Module 2 / Step 1" title="Select Exam Session">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <Stepper steps={M2_STEPS} currentStep={1} />

              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Evaluate</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">Select an Exam Session</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Choose the exam session for which you want to evaluate answer sheets.
                </p>
              </div>

              {sessionsLoading ? (
                <p className="text-sm text-slate-500">Loading exam sessions…</p>
              ) : examSessions.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No exam sessions found"
                  description="Create an exam session first using Module 1."
                  action={<Button to="/module1/exam-details">Create Session</Button>}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {examSessions.map((session, i) => {
                    const isSelected = session.id === selectedSessionId;
                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileHover={{ y: -2 }}
                        onClick={() => { selectSession(session.id); setPhase(2); }}
                        className={[
                          'relative cursor-pointer rounded-2xl border p-5 transition duration-200',
                          isSelected
                            ? 'border-blue-400/40 bg-blue-50 shadow-[0_0_22px_rgba(59,130,246,0.18)]'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">{session.examName}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{session.subject}</p>
                            <p className="mt-0.5 text-[10px] text-slate-600">
                              {session.hasModelAnswers ? 'Answer key ready' : 'No answer key yet'}
                            </p>
                          </div>
                          <StatusBadge tone={STATUS_TONE[session.status] ?? 'neutral'} dot>
                            {session.status}
                          </StatusBadge>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                          {[
                            { label: 'Marks',     value: session.totalMarks },
                            { label: 'Questions', value: session.questionCount },
                            { label: 'Students',  value: session.studentsEvaluated || 0 },
                          ].map((s) => (
                            <div key={s.label} className="text-center">
                              <p className="text-lg font-black text-slate-900">{s.value}</p>
                              <p className="text-[9px] uppercase tracking-wider text-slate-600">{s.label}</p>
                            </div>
                          ))}
                        </div>

                        {isSelected && (
                          <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between">
                <Button variant="ghost" to="/dashboard" icon={<ArrowLeft className="h-4 w-4" />}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setPhase(2)}
                  disabled={!selectedSessionId}
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Confirm &amp; Continue
                </Button>
              </div>
            </div>
          </div>
        </PageContainer>
      </div>
    );
  }

  // ── Phase 2: Upload Answer Sheet ──────────────────────────────────────────────
  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="Module 2 / Step 2" title="Upload Answer Sheet">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M2_STEPS} currentStep={2} />

            {/* Session chip */}
            {selectedSession && (
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900">{selectedSession.examName}</p>
                  <p className="text-[10px] text-slate-500">
                    {selectedSession.subject} · {selectedSession.questionCount} questions · {selectedSession.totalMarks} marks
                  </p>
                </div>
                <StatusBadge tone={STATUS_TONE[selectedSession.status] ?? 'neutral'} className="ml-auto shrink-0">
                  {selectedSession.status}
                </StatusBadge>
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-2">

              {/* ── Left: Student info ── */}
              <Card>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Student</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">Student Details</h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Roll Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 gap-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
                      <User className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        type="text"
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        placeholder="e.g. CS2026-014"
                        disabled={isLoading}
                        className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Student Name <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 gap-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
                      <User className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="e.g. Aarav Sharma"
                        disabled={isLoading}
                        className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Model note */}
                <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-800">Scored from the sheet photo</p>
                  <p className="mt-1 text-[11px] leading-5 text-blue-700">
                    The file is stored and later marked by Gemini against the Module 1
                    marking criteria.
                  </p>
                </div>
              </Card>

              {/* ── Right: File drop zone + status ── */}
              <Card>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Upload</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">Answer Sheet PDF</h3>

                {/* Drop zone */}
                <motion.div
                  onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                  animate={{
                    borderColor: isDragging ? 'rgba(59,130,246,0.6)' : 'rgba(96,165,250,0.25)',
                    backgroundColor: isDragging ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.03)',
                  }}
                  className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors duration-200"
                >
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <ScanLine className="mx-auto h-10 w-10 text-blue-500/50" />
                  </motion.div>

                  {file ? (
                    <div className="mt-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null); setStatus('idle'); }}
                        className="rounded-full p-0.5 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-3 text-sm font-semibold text-slate-900">
                        Drop the answer sheet here
                      </p>
                      <p className="mt-1 text-xs text-slate-500">or click to browse · max {MAX_FILE_MB} MB</p>
                    </>
                  )}

                  {file && (
                    <p className="mt-1.5 text-[10px] text-slate-400">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  )}
                </motion.div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/tiff"
                  className="hidden"
                  onChange={onInputChange}
                />

                {/* Error */}
                <AnimatePresence>
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-px" />
                      <p className="text-xs text-rose-700 leading-5">{errorMsg}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Upload progress */}
                <AnimatePresence>
                  {status === 'uploading' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 space-y-2"
                    >
                      <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                        <span>Uploading…</span>
                        <span>{uploadPct}%</span>
                      </div>
                      <ProgressBar value={uploadPct} tone="blue" height="h-1.5" showValue={false} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge tone="info" dot>PDF or image</StatusBadge>
                  <StatusBadge tone="neutral">Max {MAX_FILE_MB} MB</StatusBadge>
                </div>
              </Card>
            </div>

            {answerSheets.length > 0 && (
              <Card className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Stored sheets</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">
                  {answerSheets.length} student{answerSheets.length === 1 ? '' : 's'} uploaded
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Original files are kept on Cloudinary (free tier) so you can re-open them later.
                </p>
                <div className="mt-4 divide-y divide-slate-100">
                  {answerSheets.map((sheet) => (
                    <div key={sheet.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {sheet.studentName || sheet.rollNumber}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {sheet.rollNumber}
                        </p>
                      </div>
                      <StatusBadge tone={sheet.status === 'evaluated' ? 'success' : 'info'}>
                        {sheet.status === 'uploaded' ? 'ready' : sheet.status}
                      </StatusBadge>
                      {sheet.fileUrl && (
                        <a
                          href={sheet.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          File
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setCurrentAnswerSheet(sheet.id);
                          navigate('/module2/mapping');
                        }}
                      >
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="mt-5 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setPhase(1)}
                icon={<ArrowLeft className="h-4 w-4" />}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!file || !rollNumber.trim() || isLoading}
                icon={isLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Upload className="h-4 w-4" />}
              >
                {status === 'uploading' ? `Uploading (${uploadPct}%)` : 'Upload sheet'}
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
