import { motion } from 'framer-motion';
import { Hash, ArrowRight, ArrowLeft, CheckCircle2, Target } from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import ProgressBar   from '../../components/common/ProgressBar';
import StatusBadge   from '../../components/common/StatusBadge';
import { useAppStore } from '../../store/useAppStore';

const BG = 'bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]';
const M1_STEPS = ['Exam Details', 'Upload PDFs', 'Topics & Weightage', 'Generate Questions', 'Review Questions', 'Export'];

const DOT_COLORS = [
  'bg-blue-400', 'bg-purple-400', 'bg-cyan-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400',
];

export default function TopicReview() {
  const topics      = useAppStore((s) => s.topics);
  const updateTopic = useAppStore((s) => s.updateTopic);

  const totalMarks     = topics.reduce((sum, t) => sum + t.marks, 0);
  const totalQuestions = topics.reduce((sum, t) => sum + t.questionCount, 0);
  const approvedCount  = topics.filter((t) => t.status === 'Approved').length;
  const needsReview    = topics.filter((t) => t.status !== 'Approved').length;
  const targetMarks    = 100;
  const marksValid     = totalMarks === targetMarks;

  return (
    <div className={`min-h-screen ${BG}`}>
      <Navbar />
      <PageContainer subtitle="Module 1 / Step 3" title="Topics & Weightage">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M1_STEPS} currentStep={3} />

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">

              {/* ── Left: Topic Cards ── */}
              <div className="space-y-4">
                {topics.map((topic, i) => {
                  const dot = DOT_COLORS[i % DOT_COLORS.length];
                  return (
                    <motion.div
                      key={topic.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                            <Hash className="h-4 w-4 text-blue-300" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{topic.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {topic.questionCount} questions · {topic.marks} marks
                            </p>
                          </div>
                        </div>
                        <StatusBadge tone={topic.status === 'Approved' ? 'success' : 'warning'} dot>
                          {topic.status}
                        </StatusBadge>
                      </div>

                      {/* Weightage slider */}
                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Weightage</label>
                          <span className="text-sm font-black text-blue-300">{topic.weight}%</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          value={topic.weight}
                          onChange={(e) => updateTopic(topic.id, { weight: Number(e.target.value) })}
                          className="w-full cursor-pointer"
                        />
                      </div>

                      {/* Marks + Questions */}
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
                          <p className="text-[10px] text-slate-500">Marks</p>
                          <input
                            type="number"
                            value={topic.marks}
                            min="1"
                            onChange={(e) => updateTopic(topic.id, { marks: Number(e.target.value) })}
                            className="mt-1 w-full bg-transparent text-xl font-black text-white outline-none"
                          />
                        </div>
                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
                          <p className="text-[10px] text-slate-500">Questions</p>
                          <input
                            type="number"
                            value={topic.questionCount}
                            min="1"
                            onChange={(e) => updateTopic(topic.id, { questionCount: Number(e.target.value) })}
                            className="mt-1 w-full bg-transparent text-xl font-black text-white outline-none"
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* ── Right: Live Summary ── */}
              <div className="space-y-4">
                {/* Summary */}
                <Card className="sticky top-24">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Live Summary</p>
                  <h3 className="mt-1 text-base font-bold text-white">Blueprint Overview</h3>

                  {/* Marks tally */}
                  <div className="mt-5 flex items-end gap-2">
                    <span className={`text-4xl font-black leading-none ${
                      marksValid ? 'text-emerald-300'
                      : totalMarks > targetMarks ? 'text-rose-300'
                      : 'text-amber-300'
                    }`}>
                      {totalMarks}
                    </span>
                    <span className="mb-1 text-slate-500">/ {targetMarks} marks</span>
                  </div>

                  {marksValid ? (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Marks perfectly allocated
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-400">
                      {totalMarks > targetMarks ? `${totalMarks - targetMarks} marks over budget` : `${targetMarks - totalMarks} marks remaining`}
                    </p>
                  )}

                  <div className="mt-4">
                    <ProgressBar value={Math.min((totalMarks / targetMarks) * 100, 100)} tone={marksValid ? 'emerald' : totalMarks > targetMarks ? 'rose' : 'amber'} />
                  </div>

                  {/* Stats */}
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Questions',  value: totalQuestions },
                      { label: 'Approved',   value: approvedCount  },
                      { label: 'Review',     value: needsReview    },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-3 text-center">
                        <p className="text-xl font-black text-white">{s.value}</p>
                        <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Topic list with dots */}
                  <div className="mt-5 space-y-2">
                    {topics.map((t, i) => {
                      const dot = DOT_COLORS[i % DOT_COLORS.length];
                      return (
                        <div key={t.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                            <span className="truncate text-[10px] text-slate-400">{t.title}</span>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold text-white">{t.weight}%</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module1/upload" icon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button to="/module1/generate" icon={<ArrowRight className="h-4 w-4" />}>
                Continue to Generate
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
