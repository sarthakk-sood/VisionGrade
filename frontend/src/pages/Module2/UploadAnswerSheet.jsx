import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, ScanLine, User, CheckCircle2, FileText,
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
import { PAGE_BG } from '../../utils/theme';

const M2_STEPS = ['Select Exam', 'Upload Sheets', 'Processing', 'Review Flags', 'Results'];

const STATUS_TONE = {
  Evaluated: 'success', Exported: 'success',
  Evaluating: 'warning', Generated: 'info', Draft: 'neutral',
};

const demoSheets = [
  { id: 1, studentName: 'Aarav Sharma',   rollNo: 'CS2026-014', fileName: 'Sheet_014.jpg', size: '3.2 MB', progress: 100, status: 'Processed' },
  { id: 2, studentName: 'Meera Iyer',     rollNo: 'CS2026-021', fileName: 'Sheet_021.pdf', size: '6.7 MB', progress: 100, status: 'Processed' },
  { id: 3, studentName: 'Kabir Singh',    rollNo: 'CS2026-033', fileName: 'Sheet_033.png', size: '2.8 MB', progress: 100, status: 'Processed' },
  { id: 4, studentName: 'Priya Nair',     rollNo: 'CS2026-045', fileName: 'Sheet_045.jpg', size: '4.1 MB', progress: 78,  status: 'Uploading' },
  { id: 5, studentName: 'Rahul Verma',    rollNo: 'CS2026-052', fileName: 'Sheet_052.pdf', size: '5.3 MB', progress: 45,  status: 'Uploading' },
];

export default function UploadAnswerSheet() {
  const examSessions    = useAppStore((s) => s.examSessions);
  const selectedSessionId = useAppStore((s) => s.selectedSessionId);
  const selectSession   = useAppStore((s) => s.selectSession);

  const [phase, setPhase] = useState(1);

  const selectedSession = examSessions.find((s) => s.id === selectedSessionId) ?? null;

  // ── Phase 1: Select Exam ──────────────────────────────
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

              {examSessions.length === 0 ? (
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
                        {/* Status badge top-right */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">{session.examName}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{session.subject}</p>
                            <p className="mt-0.5 text-[10px] text-slate-600">{session.semester} · {session.session}</p>
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
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Selected
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
                  Confirm & Continue
                </Button>
              </div>
            </div>
          </div>
        </PageContainer>
      </div>
    );
  }

  // ── Phase 2: Upload Sheets ────────────────────────────
  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="Module 2 / Step 2" title="Upload Answer Sheets">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M2_STEPS} currentStep={2} />

            {/* Selected session chip */}
            {selectedSession && (
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900">{selectedSession.examName}</p>
                  <p className="text-[10px] text-slate-500">{selectedSession.subject} · {selectedSession.questionCount} questions · {selectedSession.totalMarks} marks</p>
                </div>
                <StatusBadge tone={STATUS_TONE[selectedSession.status] ?? 'neutral'} className="ml-auto shrink-0">
                  {selectedSession.status}
                </StatusBadge>
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-2">

              {/* Left: Upload zone */}
              <Card>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Upload</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">Upload Answer Sheets</h3>
                <p className="mt-1 text-xs text-slate-500">Drop student answer sheets for OCR processing.</p>

                <motion.div
                  whileHover={{ borderColor: 'rgba(96,165,250,0.4)', backgroundColor: 'rgba(59,130,246,0.05)' }}
                  className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-500/[0.03] p-10 text-center transition-colors duration-200"
                >
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <ScanLine className="mx-auto h-10 w-10 text-blue-600/50" />
                  </motion.div>
                  <p className="mt-4 text-sm font-semibold text-slate-900">Drop answer sheet images or PDFs</p>
                  <p className="mt-1.5 text-xs text-slate-500">JPG, PNG, PDF supported · Max 10MB per file</p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100">
                    Browse Files
                  </div>
                </motion.div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge tone="success" dot>JPG / PNG</StatusBadge>
                  <StatusBadge tone="info"    dot>PDF Supported</StatusBadge>
                  <StatusBadge tone="neutral">Max 10MB / file</StatusBadge>
                </div>
              </Card>

              {/* Right: Student queue */}
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Upload Queue</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">Student Sheets</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                    {demoSheets.length} sheets
                  </span>
                </div>

                <div className="space-y-3">
                  {demoSheets.map((sheet, i) => (
                    <motion.div
                      key={sheet.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/[0.03] p-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-slate-900">{sheet.studentName}</p>
                          <StatusBadge tone={sheet.status === 'Processed' ? 'success' : 'info'} dot>
                            {sheet.status}
                          </StatusBadge>
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">{sheet.rollNo} · {sheet.fileName} · {sheet.size}</p>
                        <div className="mt-2">
                          <ProgressBar value={sheet.progress} showValue={false} height="h-1" tone={sheet.status === 'Processed' ? 'emerald' : 'blue'} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setPhase(1)} icon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button to="/module2/ocr" icon={<ArrowRight className="h-4 w-4" />}>
                Start Processing
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
