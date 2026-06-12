import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
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

const BG = 'bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]';
const M1_STEPS = ['Exam Details', 'Upload PDFs', 'Topics & Weightage', 'Generate Questions', 'Review Questions', 'Export'];

function ExportButton({ icon: Icon, title, subtitle, to, primary = false }) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.18 }}
      className={[
        'flex cursor-pointer flex-col items-center rounded-2xl border p-5 text-center transition',
        primary
          ? 'border-blue-400/30 bg-blue-500/15 text-blue-100 hover:bg-blue-500/20'
          : 'border-white/[0.08] bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]',
      ].join(' ')}
    >
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${primary ? 'bg-blue-500/25' : 'bg-white/[0.07]'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      {to && (
        <Link to={to} className="mt-3 text-xs text-blue-400 transition hover:text-blue-300">
          Proceed →
        </Link>
      )}
    </motion.div>
  );
}

const DOT_COLORS = [
  'bg-blue-400', 'bg-purple-400', 'bg-cyan-400',
  'bg-emerald-400', 'bg-amber-400', 'bg-rose-400',
];

export default function BlueprintConfig() {
  const topics    = useAppStore((s) => s.topics);
  const questions = useAppStore((s) => s.questions);

  const totalMarks = topics.reduce((sum, t) => sum + t.marks, 0);
  const mcqCount   = questions.filter((q) => q.type === 'MCQ').length;
  const shortCount = questions.filter((q) => q.type === 'Short').length;
  const longCount  = questions.filter((q) => q.type === 'Long').length;
  const easy       = questions.filter((q) => q.difficulty === 'Easy').length;
  const medium     = questions.filter((q) => q.difficulty === 'Medium').length;
  const hard       = questions.filter((q) => q.difficulty === 'Hard').length;
  const total      = questions.length || 1;

  return (
    <StepGuard step={6}>
      <div className={`min-h-screen ${BG}`}>
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
                <p className="font-semibold text-white">Question paper is ready for export</p>
                <p className="mt-0.5 text-xs text-slate-400">
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Exam Blueprint</p>
                  <h3 className="mt-1 text-base font-bold text-white">Topic Weightage Summary</h3>
                  <div className="mt-4 space-y-4">
                    {topics.map((t, i) => {
                      const dot = DOT_COLORS[i % DOT_COLORS.length];
                      return (
                        <div key={t.id}>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                              <span className="truncate text-xs text-slate-300">{t.title}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-[10px] text-slate-500">{t.marks}m</span>
                              <span className="text-[10px] font-bold text-white">{t.weight}%</span>
                            </div>
                          </div>
                          <ProgressBar value={t.weight} showValue={false} height="h-1" />
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Question Distribution */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Question Mix</p>
                  <h3 className="mt-1 text-base font-bold text-white">Type Distribution</h3>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: 'MCQ',          count: mcqCount,   pct: Math.round(mcqCount / total * 100),   tone: 'purple' },
                      { label: 'Short Answer', count: shortCount, pct: Math.round(shortCount / total * 100), tone: 'blue'   },
                      { label: 'Long Answer',  count: longCount,  pct: Math.round(longCount / total * 100),  tone: 'amber'  },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-400">{row.label}</span>
                          <span className="font-semibold text-white">{row.count} questions ({row.pct}%)</span>
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Difficulty</p>
                  <h3 className="mt-1 text-base font-bold text-white">Difficulty Distribution</h3>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: 'Easy',   count: easy,   pct: Math.round(easy / total * 100),   tone: 'emerald' },
                      { label: 'Medium', count: medium, pct: Math.round(medium / total * 100), tone: 'amber'   },
                      { label: 'Hard',   count: hard,   pct: Math.round(hard / total * 100),   tone: 'rose'    },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-400">{row.label}</span>
                          <span className="font-semibold text-white">{row.count} questions</span>
                        </div>
                        <ProgressBar value={row.pct} tone={row.tone} showValue={false} height="h-1" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Marks Distribution per Topic */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Marks</p>
                  <h3 className="mt-1 text-base font-bold text-white">Marks per Topic</h3>
                  <div className="mt-4 space-y-3">
                    {topics.map((t) => {
                      const pct = Math.round((t.marks / (totalMarks || 100)) * 100);
                      return (
                        <div key={t.id}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="truncate text-slate-400 max-w-[160px]">{t.title}</span>
                            <span className="shrink-0 font-semibold text-white">{t.marks}m</span>
                          </div>
                          <ProgressBar value={pct} showValue={false} height="h-1" />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>

            {/* ── Export Actions ── */}
            <Card variant="accent" className="mt-5">
              <h3 className="text-base font-bold text-white">Export Options</h3>
              <p className="mt-1 text-xs text-slate-400">Choose your preferred format to export the question paper.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <ExportButton icon={FileText}    title="Question Paper PDF"    subtitle="Formatted for printing"       />
                <ExportButton icon={FileCode}    title="Answer Key PDF"        subtitle="With model answers"          />
                <ExportButton icon={BookMarked}  title="Create Exam Session"   subtitle="Save & go to evaluation" to="/dashboard" primary />
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
