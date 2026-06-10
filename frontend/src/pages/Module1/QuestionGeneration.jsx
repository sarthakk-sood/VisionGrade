import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Loader2, ArrowRight, ArrowLeft,
  AlertCircle, CheckCircle2, Cpu, BookOpen, Clock, Hash,
  Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  'Reading source documents…',
  'Analysing topic distribution…',
  'Mapping difficulty requirements…',
  'Balancing global question constraints…',
  'Solving question-to-topic constraints…',
  'Generating diverse questions…',
  'Validating marks distribution…',
  'Finalising question paper…',
];

const PROVIDER_LABELS = {
  'gpt-4o':                'GPT-4o',
  'gemini-2.5-flash':      'Gemini 2.5 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
};

const QUESTION_TYPES = ['MCQ', 'ShortAnswer', 'MediumAnswer', 'LongAnswer', 'FillInTheBlanks'];
const TYPE_LABELS     = { MCQ: 'MCQ', ShortAnswer: 'Short Answer', MediumAnswer: 'Medium Answer', LongAnswer: 'Long Answer', FillInTheBlanks: 'Fill in Blanks' };

export default function QuestionGeneration() {
  const navigate = useNavigate();

  const projectId                   = useAppStore((s) => s.projectId);
  const examInfo                    = useAppStore((s) => s.examInfo);
  const topics                      = useAppStore((s) => s.topics);
  const questionsLoading            = useAppStore((s) => s.questionsLoading);
  const questionsError              = useAppStore((s) => s.questionsError);
  const generatedQuestions          = useAppStore((s) => s.generatedQuestions);
  const generationProvider          = useAppStore((s) => s.generationProvider);
  const setExamInfo                 = useAppStore((s) => s.setExamInfo);
  const setQuestionType             = useAppStore((s) => s.setQuestionType);
  const generateQuestionsFromBackend = useAppStore((s) => s.generateQuestionsFromBackend);

  const [stageIdx, setStageIdx]   = useState(0);
  const [progress, setProgress]   = useState(0);
  const [done, setDone]           = useState(generatedQuestions.length > 0);

  // Derived
  const selectedTopics  = topics.filter((t) => t.isSelected);

  // Calculate marks based on global question distribution
  const totalQuestionMarks = Object.values(examInfo.questionTypes).reduce(
    (sum, q) => sum + (q.count * q.marks), 0
  );
  
  const totalQuestionCount = Object.values(examInfo.questionTypes).reduce(
    (sum, q) => sum + q.count, 0
  );

  const isMarksValid = totalQuestionMarks === examInfo.totalMarks;

  // ── Animate progress bar during generation ─────────────────────────────────
  const startFakeProgress = () => {
    let p = 0;
    const interval = setInterval(() => {
      p += 1.2;
      const capped = Math.min(p, 92); // hold at 92% until LLM responds
      setProgress(capped);
      setStageIdx(Math.floor((capped / 100) * (GENERATION_STAGES.length - 1)));
      if (p >= 92) clearInterval(interval);
    }, 300);
    return interval;
  };

  const handleGenerate = async () => {
    if (questionsLoading || !projectId || !isMarksValid) return;
    setDone(false);
    setProgress(0);
    setStageIdx(0);

    const timer = startFakeProgress();
    const result = await generateQuestionsFromBackend(projectId);
    clearInterval(timer);

    if (result) {
      setProgress(100);
      setStageIdx(GENERATION_STAGES.length - 1);
      setDone(true);
      setTimeout(() => navigate('/module1/review'), 1200);
    } else {
      setProgress(0);
    }
  };

  return (
    <div className={`min-h-screen ${BG}`}>
      <Navbar />
      <PageContainer subtitle="Module 1 / Step 4" title="Generate Questions">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M1_STEPS} currentStep={4} />

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">

              {/* ── Left: Config ── */}
              <div className="space-y-5">

                {/* Exam Info */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Exam Information</p>
                  <h3 className="mt-1 text-base font-bold text-white">Paper Details</h3>

                  <div className="mt-4 space-y-4">
                    {/* Exam Title */}
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <BookOpen className="h-3 w-3" /> Exam Title
                      </label>
                      <input
                        type="text"
                        value={examInfo.examTitle}
                        onChange={(e) => setExamInfo({ examTitle: e.target.value })}
                        placeholder="e.g. Mid Semester Examination — Data Structures"
                        className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-400/40 transition"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Total Marks (Read-Only here, set in Step 3) */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Marks (From Topics)</label>
                        <input
                          type="text"
                          readOnly
                          value={examInfo.totalMarks}
                          className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xl font-black text-slate-400 outline-none cursor-not-allowed"
                        />
                      </div>
                      {/* Duration */}
                      <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <Clock className="h-3 w-3" /> Duration (min)
                        </label>
                        <input
                          type="number" min="30" max="300"
                          value={examInfo.durationMinutes}
                          onChange={(e) => setExamInfo({ durationMinutes: Number(e.target.value) })}
                          className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-xl font-black text-white outline-none focus:border-blue-400/40 transition"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Overall Question Types Distribution */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Question Blueprint</p>
                  <div className="flex items-center justify-between">
                    <h3 className="mt-1 text-base font-bold text-white">Overall Question Distribution</h3>
                    <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${isMarksValid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                      {isMarksValid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      Marks: {totalQuestionMarks} / {examInfo.totalMarks}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Specify exactly how many of each question type you want in the entire exam, and how many marks each carries.</p>

                  <div className="mt-5 space-y-3">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_100px_100px_80px] gap-3 px-3">
                      <span className="text-[10px] font-bold uppercase text-slate-500">Type</span>
                      <span className="text-[10px] font-bold uppercase text-slate-500 text-center">Count</span>
                      <span className="text-[10px] font-bold uppercase text-slate-500 text-center">Marks / Q</span>
                      <span className="text-[10px] font-bold uppercase text-slate-500 text-right">Total</span>
                    </div>

                    {/* Rows */}
                    {QUESTION_TYPES.map((qt) => {
                      const data = examInfo.questionTypes[qt];
                      const total = data.count * data.marks;
                      
                      return (
                        <div key={qt} className="grid grid-cols-[1fr_100px_100px_80px] gap-3 items-center rounded-xl border border-white/[0.04] bg-white/[0.02] p-2 hover:bg-white/[0.04] transition">
                          <span className="text-sm font-semibold text-slate-300 ml-2">{TYPE_LABELS[qt]}</span>
                          
                          <input
                            type="number" min="0" max="50"
                            value={data.count || 0}
                            onChange={(e) => setQuestionType(qt, { count: Number(e.target.value) })}
                            className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-center text-sm font-bold text-white outline-none focus:border-blue-400/40"
                          />
                          
                          <input
                            type="number" min="1" max="50"
                            value={data.marks || 1}
                            onChange={(e) => setQuestionType(qt, { marks: Number(e.target.value) })}
                            className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-center text-sm font-bold text-white outline-none focus:border-blue-400/40"
                          />
                          
                          <span className={`text-right font-black ${total > 0 ? 'text-blue-400' : 'text-slate-600'} mr-2`}>
                            {total}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Generate button */}
                <motion.button
                  type="button"
                  onClick={handleGenerate}
                  disabled={questionsLoading || !projectId || !examInfo.examTitle || !isMarksValid || selectedTopics.length === 0}
                  whileHover={!questionsLoading ? { scale: 1.01, y: -1 } : undefined}
                  whileTap={!questionsLoading ? { scale: 0.99 } : undefined}
                  className={[
                    'w-full rounded-xl px-6 py-4 text-sm font-bold transition-all',
                    questionsLoading
                      ? 'cursor-not-allowed bg-blue-500/20 text-blue-300'
                      : done
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed',
                  ].join(' ')}
                >
                  {questionsLoading ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Generating…</span>
                  ) : done ? (
                    <span className="flex items-center justify-center gap-2"><Sparkles className="h-4 w-4" /> Regenerate Questions</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2"><Sparkles className="h-4 w-4" /> Generate Questions with AI</span>
                  )}
                </motion.button>

                {/* Error */}
                <AnimatePresence>
                  {questionsError && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                      <p className="text-xs text-rose-300">{questionsError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Right: Status + Summary ── */}
              <div className="space-y-5">

                {/* AI Provider card */}
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  className="rounded-2xl border border-blue-400/20 bg-blue-500/[0.06] p-5"
                >
                  <div className="flex items-center gap-2 text-blue-200">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-sm font-semibold">VisionGrade AI</p>
                    <span className="ml-auto rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300">
                      {generationProvider ? PROVIDER_LABELS[generationProvider] || generationProvider : 'GPT-4o → Gemini fallback'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-slate-300">
                    {done
                      ? `${generatedQuestions.length} questions generated successfully across ${selectedTopics.length} topic(s).`
                      : `The LLM will intelligently assign the ${totalQuestionCount} required global questions to the ${selectedTopics.length} topics while respecting each topic's allocated marks.`}
                  </p>
                </motion.div>

                {/* Progress during generation */}
                <AnimatePresence>
                  {(questionsLoading || done) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl border border-blue-400/20 bg-blue-500/[0.06] p-5"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        {questionsLoading
                          ? <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
                          : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                        <p className="text-xs font-semibold text-blue-200">
                          {questionsLoading ? 'AI Processing…' : 'Generation Complete!'}
                        </p>
                      </div>
                      <ProgressBar value={progress} tone={done ? 'emerald' : 'blue'} />
                      <p className="mt-2 text-[10px] text-slate-400">
                        {done ? `${generatedQuestions.length} questions ready — navigating to review…` : GENERATION_STAGES[stageIdx]}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Topic Blueprint Summary */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Topic Blueprint</p>
                  <h3 className="mt-1 text-sm font-bold text-white">Configured Topics</h3>

                  <div className="mt-4 space-y-3">
                    {selectedTopics.length === 0 ? (
                      <p className="text-xs text-slate-500">No topics selected. Go back and select topics.</p>
                    ) : (
                      selectedTopics.map((t) => {
                        const pct = examInfo.totalMarks > 0 ? Math.round(((t.marks || 0) / examInfo.totalMarks) * 100) : 0;
                        return (
                          <div key={t.id}>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="truncate text-slate-400 max-w-[140px]">{t.name}</span>
                              <span className="shrink-0 font-semibold text-white">{t.difficulty || 'Mixed'} · {t.marks || 0}m</span>
                            </div>
                            <ProgressBar value={pct} showValue={false} height="h-1" tone="blue" />
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module1/topics" icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
              <Button
                to="/module1/review"
                disabled={generatedQuestions.length === 0}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Review Questions
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
