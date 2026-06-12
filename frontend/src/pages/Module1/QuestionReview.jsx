import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, RefreshCw, Edit3, Copy, Trash2, Plus,
  AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import StatusBadge   from '../../components/common/StatusBadge';
import { useAppStore } from '../../store/useAppStore';
import { StepGuard } from '../../hooks/useWorkflow';

const BG = 'bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]';
const M1_STEPS = ['Exam Details', 'Upload PDFs', 'Topics & Weightage', 'Generate Questions', 'Review Questions', 'Export'];

const TYPE_STYLE = {
  MCQ:   'bg-purple-500/20 text-purple-300',
  Short: 'bg-blue-500/20   text-blue-300',
  Long:  'bg-orange-500/20 text-orange-300',
};
const DIFF_STYLE = {
  Easy:   'bg-emerald-500/15 text-emerald-300',
  Medium: 'bg-amber-500/15  text-amber-300',
  Hard:   'bg-rose-500/15   text-rose-300',
};

function ActionBtn({ onClick, className, icon: Icon, label, loading = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {loading
        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

export default function QuestionReview() {
  const navigate           = useNavigate();
  const questions          = useAppStore((s) => s.questions);
  const approveQuestion    = useAppStore((s) => s.approveQuestion);
  const regenerateQuestion = useAppStore((s) => s.regenerateQuestion);
  const removeQuestion     = useAppStore((s) => s.removeQuestion);
  const completeM1Step     = useAppStore((s) => s.completeM1Step);
  const regeneratingIds    = useAppStore((s) => s.regeneratingIds);

  const handleExport = () => {
    completeM1Step(5);
    navigate('/module1/blueprint');
  };

  const totalMarks  = questions.reduce((sum, q) => sum + q.marks, 0);
  const targetMarks = 100;
  const isValid     = totalMarks === targetMarks;
  const approved    = questions.filter((q) => q.approved).length;
  const pending     = questions.filter((q) => !q.approved).length;
  const mcqCount    = questions.filter((q) => q.type === 'MCQ').length;
  const shortCount  = questions.filter((q) => q.type === 'Short').length;
  const longCount   = questions.filter((q) => q.type === 'Long').length;

  return (
    <StepGuard step={5}>
      <div className={`min-h-screen ${BG}`}>
      <Navbar />
      <PageContainer subtitle="Module 1 / Step 5" title="Review Questions">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M1_STEPS} currentStep={5} />

            {/* ── Marks validation bar ── */}
            <div className={`mb-5 flex items-center justify-between rounded-2xl border px-5 py-3 ${
              isValid
                ? 'border-emerald-400/25 bg-emerald-500/[0.07]'
                : 'border-amber-400/25  bg-amber-500/[0.07]'
            }`}>
              <div className="flex items-center gap-2">
                {isValid
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                <span className="text-sm font-semibold text-white">
                  {isValid ? 'Marks validated — ready to export' : 'Marks need adjustment'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Total:</span>
                <span className={`text-xl font-black ${isValid ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {totalMarks}
                </span>
                <span className="text-slate-600">/</span>
                <span className="text-xl font-black text-white">{targetMarks}</span>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">

              {/* ── Left: Question Cards ── */}
              <div className="space-y-4">
                {/* Add new */}
                <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />}>
                  Add New Question
                </Button>

                <AnimatePresence>
                  {questions.map((q, i) => (
                    <motion.div
                      key={q.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.04 }}
                      className={`rounded-2xl border p-5 transition ${
                        q.approved
                          ? 'border-white/[0.07] bg-white/[0.035]'
                          : 'border-amber-400/20 bg-amber-500/[0.04]'
                      }`}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${TYPE_STYLE[q.type] ?? ''}`}>
                            {q.type}
                          </span>
                          <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${DIFF_STYLE[q.difficulty] ?? ''}`}>
                            {q.difficulty}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge tone={q.approved ? 'success' : 'warning'} dot pulse={!q.approved}>
                            {q.approved ? 'Approved' : 'Pending'}
                          </StatusBadge>
                          <span className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1 text-[10px] font-black text-white">
                            {q.marks}m
                          </span>
                        </div>
                      </div>

                      {/* Question text */}
                      <p className="mt-3 text-sm leading-6 text-slate-200">{q.text}</p>
                      <p className="mt-1 text-[10px] text-slate-600">Topic: {q.topic}</p>

                      {/* Action buttons */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <ActionBtn
                          onClick={() => approveQuestion(q.id)}
                          icon={Check}
                          label="Approve"
                          className="border-emerald-400/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                        />
                        <ActionBtn
                          onClick={() => regenerateQuestion(q.id)}
                          icon={RefreshCw}
                          label={regeneratingIds?.has(q.id) ? 'Regenerating…' : 'Regenerate'}
                          loading={regeneratingIds?.has(q.id)}
                          className="border-blue-400/25 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                        />
                        <ActionBtn
                          icon={Edit3}
                          label="Edit"
                          className="border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                        />
                        <ActionBtn
                          icon={Copy}
                          label="Duplicate"
                          className="border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                        />
                        <ActionBtn
                          onClick={() => removeQuestion(q.id)}
                          icon={Trash2}
                          label="Delete"
                          className="ml-auto border-rose-400/20 bg-rose-500/[0.07] text-rose-300 hover:bg-rose-500/15"
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* ── Right: Review Panel ── */}
              <Card className="sticky top-24 h-fit">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Review Panel</p>
                <h3 className="mt-1 text-base font-bold text-white">Paper Summary</h3>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Qns',  value: questions.length, color: 'text-white'      },
                    { label: 'Approved',   value: approved,          color: 'text-emerald-300' },
                    { label: 'Pending',    value: pending,           color: 'text-amber-300'  },
                    { label: 'Total Marks', value: totalMarks,       color: isValid ? 'text-emerald-300' : 'text-amber-300' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-3 text-center">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-3 border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Question Mix</p>
                  <div className="space-y-2.5">
                    {[
                      { label: 'MCQ',          count: mcqCount,   pct: Math.round((mcqCount / (questions.length || 1)) * 100),   color: 'text-purple-300' },
                      { label: 'Short Answer', count: shortCount, pct: Math.round((shortCount / (questions.length || 1)) * 100), color: 'text-blue-300'   },
                      { label: 'Long Answer',  count: longCount,  pct: Math.round((longCount / (questions.length || 1)) * 100),  color: 'text-orange-300' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">{row.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${row.color}`}>{row.count}</span>
                          <span className="text-[10px] text-slate-600">({row.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* ── Actions ── */}
            <div className="mt-5 flex items-center justify-between">
              <Button to="/module1/generate" variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button onClick={handleExport} icon={<Download className="h-4 w-4" />}>
                Export Paper
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
    </StepGuard>
  );
}
