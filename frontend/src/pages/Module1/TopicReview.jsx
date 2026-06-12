import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash, ArrowRight, ArrowLeft, CheckCircle2, Loader2,
  AlertCircle, Cpu, CheckSquare, Square, Save, RefreshCw,
  ChevronDown, ChevronUp, Edit3, Scale
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
const DOT_COLORS = ['bg-blue-400','bg-purple-400','bg-cyan-400','bg-emerald-400','bg-amber-400','bg-rose-400'];
const PROVIDER_LABELS = {
  'gpt-4o':                { label: 'GPT-4o',              color: 'text-emerald-400' },
  'gemini-2.5-flash':      { label: 'Gemini 2.5 Flash',    color: 'text-blue-400'   },
  'gemini-2.0-flash-lite': { label: 'Gemini 2.0 Flash Lite', color: 'text-purple-400' },
};

export default function TopicReview() {
  const navigate = useNavigate();

  const topics                  = useAppStore((s) => s.topics);
  const topicsLoading           = useAppStore((s) => s.topicsLoading);
  const topicsSaved             = useAppStore((s) => s.topicsSaved);
  const topicsError             = useAppStore((s) => s.topicsError);
  const detectedSubject         = useAppStore((s) => s.detectedSubject);
  const llmProvider             = useAppStore((s) => s.llmProvider);
  const projectId               = useAppStore((s) => s.projectId);

  const examInfo                = useAppStore((s) => s.examInfo);
  const setExamInfo             = useAppStore((s) => s.setExamInfo);

  const toggleTopicSelection    = useAppStore((s) => s.toggleTopicSelection);
  const selectAllTopics         = useAppStore((s) => s.selectAllTopics);
  const deselectAllTopics       = useAppStore((s) => s.deselectAllTopics);
  const saveTopicSelection      = useAppStore((s) => s.saveTopicSelection);
  const detectTopicsFromBackend = useAppStore((s) => s.detectTopicsFromBackend);
  const updateTopicConfig       = useAppStore((s) => s.updateTopicConfig);
  const completeM1Step          = useAppStore((s) => s.completeM1Step);

  const [expandedId, setExpandedId]   = useState(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedTopics  = topics.filter((t) => t.isSelected);
  const selectedCount   = selectedTopics.length;
  const deselectedCount = topics.length - selectedCount;
  const allSelected     = selectedCount === topics.length;
  const noneSelected    = selectedCount === 0;
  const providerInfo    = PROVIDER_LABELS[llmProvider] || { label: llmProvider || 'AI', color: 'text-slate-400' };

  // Totals across selected topics
  const totalAllocatedMarks = selectedTopics.reduce((s, t) => s + (t.marks || 0), 0);
  const isMarksBalanced = totalAllocatedMarks === examInfo.totalMarks;

  useEffect(() => { setSaveSuccess(false); }, [topics, examInfo.totalMarks]);

  const handleAutoBalance = () => {
    if (selectedCount === 0) return;
    const baseMark = Math.floor(examInfo.totalMarks / selectedCount);
    let remainder = examInfo.totalMarks % selectedCount;

    topics.forEach(t => {
      if (t.isSelected) {
        const extra = remainder > 0 ? 1 : 0;
        updateTopicConfig(t.id, { marks: baseMark + extra });
        remainder--;
      }
    });
  };

  const handleSave = async () => {
    if (!projectId) return;
    setIsSaving(true);
    const ok = await saveTopicSelection(projectId);
    setIsSaving(false);
    if (ok) setSaveSuccess(true);
  };

  const handleContinue = async () => {
    if (projectId && !topicsSaved) await saveTopicSelection(projectId);
    completeM1Step(3);
    navigate('/module1/generate');
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (topicsLoading) {
    return (
      <StepGuard step={3}>
        <div className={`min-h-screen ${BG}`}>
        <Navbar />
        <PageContainer subtitle="Module 1 / Step 3" title="Topics & Weightage">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <Stepper steps={M1_STEPS} currentStep={3} />
              <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/10">
                    <Cpu className="h-10 w-10 text-blue-400" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-50" />
                    <span className="relative inline-flex h-4 w-4 rounded-full bg-blue-500" />
                  </span>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">Detecting Topics…</p>
                  <p className="mt-1.5 text-sm text-slate-400">AI is analysing your documents. This may take ~60s.</p>
                </div>
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              </div>
            </div>
          </div>
        </PageContainer>
      </div>
      </StepGuard>
    );
  }

  return (
    <StepGuard step={3}>
      <div className={`min-h-screen ${BG}`}>
      <Navbar />
      <PageContainer subtitle="Module 1 / Step 3" title="Topics & Weightage">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M1_STEPS} currentStep={3} />

            {/* Error */}
            <AnimatePresence>
              {topicsError && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <p className="text-xs text-rose-300">{topicsError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Global Exam Marks Header */}
            <Card className="mb-5 border-blue-500/20 bg-blue-500/[0.02]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-blue-400" />
                    Total Exam Marks
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Set the total marks for the paper first. We will distribute them across topics.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min="10" max="500"
                    value={examInfo.totalMarks}
                    onChange={(e) => setExamInfo({ totalMarks: Number(e.target.value) })}
                    className="w-24 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-xl font-black text-center text-white outline-none focus:border-blue-400/40 transition"
                  />
                  <button
                    onClick={handleAutoBalance}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-400 transition hover:bg-blue-500/20 disabled:opacity-50"
                  >
                    <Scale className="h-4 w-4" /> Auto-Balance
                  </button>
                </div>
              </div>
            </Card>

            {/* Header controls */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {detectedSubject && <StatusBadge tone="info" dot>{detectedSubject}</StatusBadge>}
                {llmProvider && <span className={`text-[10px] font-semibold ${providerInfo.color}`}>via {providerInfo.label}</span>}
                <span className="text-xs text-slate-500">{selectedCount} of {topics.length} topics selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={selectAllTopics}   disabled={allSelected}  className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-slate-400 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-40"><CheckSquare className="h-3 w-3" /> Select All</button>
                <button onClick={deselectAllTopics} disabled={noneSelected} className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-slate-400 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-40"><Square className="h-3 w-3" /> None</button>
                {projectId && <button onClick={() => detectTopicsFromBackend(projectId)} className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-slate-400 transition hover:bg-white/[0.07] hover:text-white"><RefreshCw className="h-3 w-3" /> Re-detect</button>}
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">

              {/* ── Left: Topic cards ── */}
              <div className="space-y-3">
                {topics.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] py-16 text-center">
                    <Hash className="h-8 w-8 text-slate-700" />
                    <p className="text-sm font-semibold text-slate-400">No topics detected yet</p>
                    <Button variant="ghost" to="/module1/upload">Go to Upload</Button>
                  </div>
                ) : (
                  topics.map((topic, i) => {
                    const dot         = DOT_COLORS[i % DOT_COLORS.length];
                    const isExpanded  = expandedId === topic.id;

                    return (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={`rounded-2xl border transition-all duration-200 ${
                          topic.isSelected
                            ? 'border-blue-500/30 bg-blue-500/[0.05]'
                            : 'border-white/[0.06] bg-white/[0.02] opacity-55'
                        }`}
                      >
                        {/* ── Row 1: checkbox + name + expand ── */}
                        <div className="flex items-center gap-3 p-4">
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleTopicSelection(topic.id)}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                              topic.isSelected ? 'border-blue-500 bg-blue-500' : 'border-white/20 bg-transparent'
                            }`}
                          >
                            <AnimatePresence>
                              {topic.isSelected && (
                                <motion.svg key="chk" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                  className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </motion.svg>
                              )}
                            </AnimatePresence>
                          </button>

                          {/* Dot + name */}
                          <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                          <p className="flex-1 min-w-0 truncate text-sm font-semibold text-white">{topic.name}</p>

                          {/* Stats pill */}
                          {topic.isSelected && (
                            <span className="shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                              {topic.difficulty || 'Mixed'} · {topic.marks || 0}m
                            </span>
                          )}

                          {/* Expand toggle — only if selected */}
                          {topic.isSelected && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                              className="shrink-0 ml-1 rounded-lg p-1 text-slate-500 hover:bg-white/[0.08] hover:text-white transition"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          )}
                        </div>

                        {/* ── Row 2: Config panel (only when expanded) ── */}
                        <AnimatePresence>
                          {isExpanded && topic.isSelected && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden border-t border-white/[0.06]"
                            >
                              <div className="grid gap-5 p-4 sm:grid-cols-2">

                                {/* Marks */}
                                <div className="space-y-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Marks Allocation</p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Total Marks</span>
                                    <input
                                      type="number" min="0" max="200"
                                      value={topic.marks || 0}
                                      onChange={(e) => updateTopicConfig(topic.id, { marks: Number(e.target.value) })}
                                      className="w-20 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2 py-1.5 text-right text-sm font-bold text-white outline-none focus:border-blue-400/40"
                                    />
                                  </div>
                                </div>

                                {/* Difficulty */}
                                <div className="space-y-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Target Difficulty</p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Difficulty Level</span>
                                    <select
                                      value={topic.difficulty || 'Mixed'}
                                      onChange={(e) => updateTopicConfig(topic.id, { difficulty: e.target.value })}
                                      className="rounded-lg border border-white/[0.08] bg-slate-900 px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-blue-400/40"
                                    >
                                      <option value="Easy">Easy</option>
                                      <option value="Medium">Medium</option>
                                      <option value="Hard">Hard</option>
                                      <option value="Mixed">Mixed</option>
                                    </select>
                                  </div>
                                </div>

                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* ── Right: Summary ── */}
              <div className="space-y-4">
                <Card className="sticky top-24">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Selection Summary</p>
                  <h3 className="mt-1 text-base font-bold text-white">Topic Blueprint</h3>

                  <div className="mt-5 flex items-end gap-2">
                    <span className="text-4xl font-black leading-none text-blue-300">{selectedCount}</span>
                    <span className="mb-1 text-slate-500">/ {topics.length} topics</span>
                  </div>

                  {/* Marks Balancer Alert */}
                  <div className={`mt-4 rounded-xl border p-3 ${
                    isMarksBalanced
                      ? 'border-emerald-500/20 bg-emerald-500/10'
                      : 'border-amber-500/20 bg-amber-500/10'
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Allocated Marks</p>
                      <span className={`text-sm font-black ${isMarksBalanced ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {totalAllocatedMarks} / {examInfo.totalMarks}
                      </span>
                    </div>
                    {!isMarksBalanced && (
                      <p className="mt-1 text-[10px] text-amber-300">
                        Warning: Topic marks do not sum to total exam marks.
                      </p>
                    )}
                  </div>

                  {/* Per-topic mini list */}
                  <div className="mt-5 max-h-60 space-y-2 overflow-y-auto pr-1">
                    {selectedTopics.map((t, i) => {
                      const dot = DOT_COLORS[i % DOT_COLORS.length];
                      return (
                        <div key={t.id} className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                          <span className="flex-1 truncate text-[10px] text-slate-300">{t.name}</span>
                          <span className="shrink-0 text-[10px] text-slate-500">{t.difficulty || 'Mixed'} · {t.marks || 0}m</span>
                        </div>
                      );
                    })}
                    {selectedCount === 0 && (
                      <p className="text-[10px] italic text-slate-600">No topics selected</p>
                    )}
                  </div>

                  {/* Save feedback */}
                  <AnimatePresence>
                    {saveSuccess && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="mt-4 flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Config saved!
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {projectId && (
                    <button
                      onClick={handleSave}
                      disabled={isSaving || selectedCount === 0}
                      className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600/20 border border-blue-500/30 py-2.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-600/30 disabled:opacity-40"
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {isSaving ? 'Saving…' : 'Save Selection'}
                    </button>
                  )}
                </Card>

                {/* Tip card */}
                <div className="rounded-2xl border border-blue-400/10 bg-blue-500/[0.04] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70">💡 AI Question Types</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">
                    You will define exactly how many MCQs, Short Answers, etc. you need on the next screen. The LLM will automatically decide which topics they pull from to satisfy the marks!
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module1/upload" icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
              <Button onClick={handleContinue} disabled={selectedCount === 0 || !isMarksBalanced} icon={<ArrowRight className="h-4 w-4" />}>
                Continue to Generate
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
    </StepGuard>
  );
}
