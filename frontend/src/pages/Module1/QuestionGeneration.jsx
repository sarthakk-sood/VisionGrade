import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import ProgressBar   from '../../components/common/ProgressBar';
import { useAppStore } from '../../store/useAppStore';

const BG = 'bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]';
const M1_STEPS = ['Exam Details', 'Upload PDFs', 'Topics & Weightage', 'Generate Questions', 'Review Questions', 'Export'];

const GENERATION_STAGES = [
  'Analyzing blueprint and topic distribution...',
  'Mapping questions to difficulty levels...',
  'Generating MCQ question bank...',
  'Generating short-answer questions...',
  'Generating long-answer questions...',
  'Validating marks distribution...',
  'Finalizing question paper...',
];

export default function QuestionGeneration() {
  const questions = useAppStore((s) => s.questions);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [stageIdx,     setStageIdx]     = useState(0);
  const [done,         setDone]         = useState(false);

  const [config, setConfig] = useState({
    difficulty:   'Mixed',
    questionType: 'Mixed',
    count: 17,
  });

  const set = (key, val) => setConfig((c) => ({ ...c, [key]: val }));

  const handleGenerate = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setProgress(0);
    setStageIdx(0);
    setDone(false);

    let p = 0;
    const interval = setInterval(() => {
      p += 3;
      setProgress(Math.min(p, 100));
      setStageIdx(Math.floor((p / 100) * (GENERATION_STAGES.length - 1)));
      if (p >= 100) {
        clearInterval(interval);
        setIsGenerating(false);
        setDone(true);
      }
    }, 140);
  };

  const approved   = questions.filter((q) => q.approved).length;
  const mcqCount   = questions.filter((q) => q.type === 'MCQ').length;
  const shortCount = questions.filter((q) => q.type === 'Short').length;
  const longCount  = questions.filter((q) => q.type === 'Long').length;
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <div className={`min-h-screen ${BG}`}>
      <Navbar />
      <PageContainer subtitle="Module 1 / Step 4" title="Generate Questions">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M1_STEPS} currentStep={4} />

            <div className="grid gap-5 xl:grid-cols-2">

              {/* ── Left: Config + Generate ── */}
              <div className="space-y-5">
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">AI Configuration</p>
                  <h3 className="mt-1 text-lg font-bold text-white">Question Generation Settings</h3>
                  <p className="mt-1 text-xs text-slate-500">Configure the AI model parameters before generating your question paper.</p>

                  <div className="mt-6 space-y-6">
                    {/* Difficulty */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Difficulty Mix</label>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {['Easy','Medium','Hard','Mixed'].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => set('difficulty', d)}
                            className={[
                              'rounded-xl border py-2 text-xs font-semibold transition duration-150',
                              config.difficulty === d
                                ? 'border-blue-400/40 bg-blue-500/20 text-blue-200'
                                : 'border-white/[0.07] bg-white/[0.04] text-slate-500 hover:bg-white/[0.07] hover:text-slate-300',
                            ].join(' ')}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question Type */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Question Type</label>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {['MCQ','Theory','Mixed'].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => set('questionType', t)}
                            className={[
                              'rounded-xl border py-2 text-xs font-semibold transition duration-150',
                              config.questionType === t
                                ? 'border-blue-400/40 bg-blue-500/20 text-blue-200'
                                : 'border-white/[0.07] bg-white/[0.04] text-slate-500 hover:bg-white/[0.07] hover:text-slate-300',
                            ].join(' ')}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Count */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Questions</label>
                      <input
                        type="number"
                        min="5"
                        max="50"
                        value={config.count}
                        onChange={(e) => set('count', Number(e.target.value))}
                        className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xl font-black text-white outline-none focus:border-blue-400/40 transition"
                      />
                    </div>
                  </div>

                  {/* Generate button */}
                  <motion.button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    whileHover={!isGenerating ? { scale: 1.01, y: -1 } : undefined}
                    whileTap={!isGenerating ? { scale: 0.99 } : undefined}
                    className={[
                      'mt-6 w-full rounded-xl px-6 py-4 text-sm font-bold transition-all',
                      isGenerating
                        ? 'cursor-not-allowed bg-blue-500/20 text-blue-300'
                        : done
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                          : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40',
                    ].join(' ')}
                  >
                    {isGenerating ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Questions...
                      </span>
                    ) : done ? (
                      <span className="flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Regenerate Questions
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Generate Questions with AI
                      </span>
                    )}
                  </motion.button>
                </Card>

                {/* Generation progress */}
                {(isGenerating || done) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-blue-400/20 bg-blue-500/[0.06] p-5"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      {isGenerating
                        ? <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
                        : <Sparkles className="h-4 w-4 text-emerald-300" />}
                      <p className="text-xs font-semibold text-blue-200">
                        {isGenerating ? 'AI Processing' : 'Generation Complete'}
                      </p>
                    </div>
                    <ProgressBar value={progress} tone={done ? 'emerald' : 'blue'} />
                    <p className="mt-2 text-[10px] text-slate-400">
                      {done ? 'Question paper successfully generated.' : GENERATION_STAGES[stageIdx]}
                    </p>
                  </motion.div>
                )}
              </div>

              {/* ── Right: Generation Summary ── */}
              <div className="space-y-5">

                {/* AI card */}
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  className="rounded-2xl border border-blue-400/20 bg-blue-500/[0.06] p-5"
                >
                  <div className="flex items-center gap-2 text-blue-200">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-sm font-semibold">VisionGrade AI</p>
                    <span className="ml-auto rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300">GPT-4o</span>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-slate-300">
                    Analyzing topic distribution and difficulty requirements across 6 topic areas. Generating a balanced {config.count}-question paper with MCQ, short answer, and long answer sections.
                  </p>
                </motion.div>

                {/* Existing stats */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Current Paper</p>
                  <h3 className="mt-1 text-base font-bold text-white">Question Statistics</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { label: 'Total Qns', value: questions.length, color: 'text-white' },
                      { label: 'Approved',  value: approved,         color: 'text-emerald-300' },
                      { label: 'MCQ',       value: mcqCount,         color: 'text-purple-300' },
                      { label: 'Theory',    value: shortCount + longCount, color: 'text-blue-300' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-3 text-center">
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 space-y-3">
                    <ProgressBar label="MCQ"          value={Math.round((mcqCount / questions.length) * 100) || 0} tone="purple" />
                    <ProgressBar label="Short Answer" value={Math.round((shortCount / questions.length) * 100) || 0} tone="blue" />
                    <ProgressBar label="Long Answer"  value={Math.round((longCount / questions.length) * 100) || 0} tone="amber" />
                  </div>
                </Card>

                {/* Marks */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Marks Check</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className={`text-4xl font-black ${totalMarks === 100 ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {totalMarks}
                    </span>
                    <span className="mb-1 text-slate-500">/ 100 marks</span>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={totalMarks} tone={totalMarks === 100 ? 'emerald' : 'amber'} />
                  </div>
                </Card>
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module1/topics" icon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button to="/module1/review" icon={<ArrowRight className="h-4 w-4" />}>
                Review Questions
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
