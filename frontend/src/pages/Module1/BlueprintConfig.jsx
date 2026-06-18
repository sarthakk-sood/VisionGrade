import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, FileText, FileCode, BookMarked, Download,
  ArrowLeft,
} from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import StatusBadge   from '../../components/common/StatusBadge';
import ProgressBar   from '../../components/common/ProgressBar';
import { useAppStore } from '../../store/useAppStore';
import { StepGuard } from '../../hooks/useWorkflow';
import { countByType } from '../../utils/questionTypes';
import { PAGE_BG } from '../../utils/theme';

const M1_STEPS = ['Exam Details', 'Upload PDFs', 'Topics & Weightage', 'Generate Questions', 'Review Questions', 'Export'];

function ExportButton({ icon: Icon, title, subtitle, onClick, primary = false, loading = false }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={loading || !onClick}
      whileHover={{ y: onClick ? -3 : 0, scale: onClick ? 1.01 : 1 }}
      transition={{ duration: 0.18 }}
      className={[
        'flex w-full flex-col items-center rounded-2xl border p-5 text-center transition disabled:opacity-50',
        primary
          ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white/[0.07]',
      ].join(' ')}
    >
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${primary ? 'bg-blue-500/25' : 'bg-white/[0.07]'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </motion.button>
  );
}

const DOT_COLORS = [
  'bg-blue-400', 'bg-purple-400', 'bg-cyan-400',
  'bg-emerald-400', 'bg-amber-400', 'bg-rose-400',
];

export default function BlueprintConfig() {
  const navigate = useNavigate();
  const projectId           = useAppStore((s) => s.projectId);
  const topics              = useAppStore((s) => s.topics);
  const questions           = useAppStore((s) => s.questions);
  const examInfo            = useAppStore((s) => s.examInfo);
  const finalizeExamSession = useAppStore((s) => s.finalizeExamSession);
  const finalizeLoading     = useAppStore((s) => s.finalizeLoading);
  const finalizeError       = useAppStore((s) => s.finalizeError);

  const approvedCount = questions.filter((q) => q.approved).length;

  const handleCreateSession = async () => {
    if (!projectId) {
      navigate('/sessions');
      return;
    }
    if (approvedCount === 0) return;
    const session = await finalizeExamSession(projectId);
    if (session?.id) navigate(`/session/${session.id}`);
  };

  const totalMarks = examInfo.totalMarks || topics.reduce((sum, t) => sum + (t.marks || 0), 0);
  const { mcq: mcqCount, short: shortCount, long: longCount } = countByType(questions);
  const easy       = questions.filter((q) => q.difficulty === 'Easy').length;
  const medium     = questions.filter((q) => q.difficulty === 'Medium').length;
  const hard       = questions.filter((q) => q.difficulty === 'Hard').length;
  const total      = questions.length || 1;

  return (
    <StepGuard step={6}>
      <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="Module 1 / Step 6" title="Export Question Paper">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M1_STEPS} currentStep={6} />

            {/* ── Success Banner ── */}
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] px-5 py-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">Question paper is ready for export</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {questions.length} questions · {totalMarks} marks · All topics covered
                </p>
              </div>
              <StatusBadge tone="success" dot pulse className="ml-auto shrink-0">
                Export Ready
              </StatusBadge>
            </div>

            {/* ── Two columns ── */}
            <div className="grid gap-5 xl:grid-cols-2">

              {/* Left */}
              <div className="space-y-5">

                {/* Topic Weightage Summary */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Exam Blueprint</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">Topic Weightage Summary</h3>
                  <div className="mt-4 space-y-4">
                    {topics.filter((t) => t.isSelected !== false).map((t, i) => {
                      const dot = DOT_COLORS[i % DOT_COLORS.length];
                      const weight = t.weightage ?? (totalMarks ? Math.round(((t.marks || 0) / totalMarks) * 100) : 0);
                      return (
                        <div key={t.id}>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                              <span className="truncate text-xs text-slate-600">{t.name}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-[10px] text-slate-500">{t.marks}m</span>
                              <span className="text-[10px] font-bold text-slate-900">{weight}%</span>
                            </div>
                          </div>
                          <ProgressBar value={weight} showValue={false} height="h-1" />
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Question Distribution */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Question Mix</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">Type Distribution</h3>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: 'MCQ',          count: mcqCount,   pct: Math.round(mcqCount / total * 100),   tone: 'purple' },
                      { label: 'Short Answer', count: shortCount, pct: Math.round(shortCount / total * 100), tone: 'blue'   },
                      { label: 'Long Answer',  count: longCount,  pct: Math.round(longCount / total * 100),  tone: 'amber'  },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-500">{row.label}</span>
                          <span className="font-semibold text-slate-900">{row.count} questions ({row.pct}%)</span>
                        </div>
                        <ProgressBar value={row.pct} tone={row.tone} showValue={false} height="h-1" />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Right */}
              <div className="space-y-5">

                {/* Difficulty Distribution */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Difficulty</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">Difficulty Distribution</h3>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: 'Easy',   count: easy,   pct: Math.round(easy / total * 100),   tone: 'emerald' },
                      { label: 'Medium', count: medium, pct: Math.round(medium / total * 100), tone: 'amber'   },
                      { label: 'Hard',   count: hard,   pct: Math.round(hard / total * 100),   tone: 'rose'    },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-500">{row.label}</span>
                          <span className="font-semibold text-slate-900">{row.count} questions</span>
                        </div>
                        <ProgressBar value={row.pct} tone={row.tone} showValue={false} height="h-1" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Marks Distribution per Topic */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Marks</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">Marks per Topic</h3>
                  <div className="mt-4 space-y-3">
                    {topics.map((t) => {
                      const pct = Math.round((t.marks / (totalMarks || 100)) * 100);
                      return (
                        <div key={t.id}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="truncate text-slate-500 max-w-[160px]">{t.name}</span>
                            <span className="shrink-0 font-semibold text-slate-900">{t.marks}m</span>
                          </div>
                          <ProgressBar value={pct} showValue={false} height="h-1" />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>

            {finalizeError && (
              <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-50 px-4 py-3 text-xs text-rose-600">
                {finalizeError}
              </div>
            )}

            {/* ── Export Actions ── */}
            <Card variant="accent" className="mt-5">
              <h3 className="text-base font-bold text-slate-900">Save Exam Session</h3>
              <p className="mt-1 text-xs text-slate-500">
                Sends {approvedCount} approved question{approvedCount !== 1 ? 's' : ''} to the LLM to generate type-appropriate model answers and stores them in MongoDB.
              </p>
              {approvedCount === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  No approved questions yet. Go back to Review and approve at least one question.
                </p>
              )}
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <ExportButton icon={FileText}    title="Question Paper PDF"    subtitle="Coming soon" />
                <ExportButton icon={FileCode}    title="Answer Key PDF"        subtitle="Coming soon" />
                <ExportButton
                  icon={BookMarked}
                  title={finalizeLoading ? 'Saving…' : 'Create Exam Session'}
                  subtitle={approvedCount > 0 ? `${approvedCount} approved → LLM` : 'Approve questions first'}
                  onClick={approvedCount > 0 ? handleCreateSession : undefined}
                  primary
                  loading={finalizeLoading}
                />
              </div>
            </Card>

            {/* ── Bottom nav ── */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module1/review" icon={<ArrowLeft className="h-4 w-4" />}>
                Back to Review
              </Button>
              <Button to="/dashboard" variant="secondary" icon={<Download className="h-4 w-4" />}>
                Download All
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
    </StepGuard>
  );
}
