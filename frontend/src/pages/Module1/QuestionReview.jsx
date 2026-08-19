import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, RefreshCw, Edit3, Copy, Trash2, Plus,
  AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, Download, AlertCircle,
  FileText, Quote,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import StatusBadge   from '../../components/common/StatusBadge';
import QuestionFormModal from '../../components/questions/QuestionFormModal';
import { useAppStore } from '../../store/useAppStore';
import { StepGuard } from '../../hooks/useWorkflow';
import { TYPE_STYLE, displayType, countByType } from '../../utils/questionTypes';
import { PAGE_BG } from '../../utils/theme';

const M1_STEPS = ['Exam Details', 'Upload PDFs', 'Topics & Weightage', 'Generate Questions', 'Review Questions', 'Export'];

const DIFF_STYLE = {
  Easy:   'bg-emerald-100 text-emerald-800 border border-emerald-200',
  Medium: 'bg-amber-100 text-amber-800 border border-amber-200',
  Hard:   'bg-rose-100 text-rose-800 border border-rose-200',
};

/**
 * The passage a question was generated from, with the location in the uploaded
 * PDF. This is how a teacher confirms a question came from their material
 * rather than from the model's general knowledge of the topic.
 */
function SourceEvidence({ question }) {
  const [open, setOpen] = useState(false);

  if (!question.sourceEvidence) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-amber-700">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        No source passage recorded — this question may not come from your PDFs.
      </p>
    );
  }

  const location = [question.sourceFile, question.sourcePage ? `page ${question.sourcePage}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition ${
          question.grounded
            ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
            : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
        }`}
      >
        {question.grounded ? <FileText className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {question.grounded ? 'From your PDF' : 'Not verified in your PDF'}
        {location && <span className="font-normal opacity-80">· {location}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
              <div>
                <p className="text-[11px] italic leading-5 text-slate-600">{question.sourceEvidence}</p>
                {!question.grounded && (
                  <p className="mt-1.5 text-[10px] text-amber-700">
                    This wording could not be found in your uploaded text, so the question may be generic.
                    Regenerate it or edit it before approving.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  const navigate = useNavigate();

  const projectId               = useAppStore((s) => s.projectId);
  const examInfo                = useAppStore((s) => s.examInfo);
  const topics                  = useAppStore((s) => s.topics);
  const questions               = useAppStore((s) => s.questions);
  const approveQuestion         = useAppStore((s) => s.approveQuestion);
  const approveAllQuestions     = useAppStore((s) => s.approveAllQuestions);
  const regenerateQuestion      = useAppStore((s) => s.regenerateQuestion);
  const saveQuestionEdit        = useAppStore((s) => s.saveQuestionEdit);
  const addQuestionToBackend    = useAppStore((s) => s.addQuestionToBackend);
  const deleteQuestionFromBackend = useAppStore((s) => s.deleteQuestionFromBackend);
  const duplicateQuestion       = useAppStore((s) => s.duplicateQuestion);
  const loadQuestionsFromBackend = useAppStore((s) => s.loadQuestionsFromBackend);
  const completeM1Step          = useAppStore((s) => s.completeM1Step);
  const regeneratingIds         = useAppStore((s) => s.regeneratingIds);
  const savingQuestionId        = useAppStore((s) => s.savingQuestionId);
  const questionsActionLoading  = useAppStore((s) => s.questionsActionLoading);
  const questionsActionError    = useAppStore((s) => s.questionsActionError);
  const finalizeExamSession     = useAppStore((s) => s.finalizeExamSession);
  const finalizeLoading         = useAppStore((s) => s.finalizeLoading);
  const finalizeError           = useAppStore((s) => s.finalizeError);
  const finalizedSessionId      = useAppStore((s) => s.finalizedSessionId);

  const [editModal, setEditModal]   = useState({ open: false, question: null });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (projectId && questions.length === 0) {
      loadQuestionsFromBackend(projectId);
    }
  }, [projectId, questions.length, loadQuestionsFromBackend]);

  const handleExport = () => {
    completeM1Step(5);
    navigate('/module1/blueprint');
  };

  const handleFinalize = async () => {
    if (!projectId || approved === 0) return;
    const session = await finalizeExamSession(projectId);
    if (session?.id) navigate(`/session/${session.id}`);
  };

  const handleEditSave = async (payload) => {
    if (!editModal.question) return;
    const ok = await saveQuestionEdit(editModal.question.id, payload);
    if (ok) setEditModal({ open: false, question: null });
  };

  const handleAddSave = async (payload) => {
    const ok = await addQuestionToBackend(payload);
    if (ok) setAddModalOpen(false);
  };

  const handleDelete = async (id) => {
    const ok = await deleteQuestionFromBackend(id);
    if (ok) setDeleteConfirm(null);
  };

  const totalMarks  = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  const targetMarks = examInfo.totalMarks || 100;
  const isValid     = totalMarks === targetMarks;
  const approved    = questions.filter((q) => q.approved).length;
  const pending     = questions.filter((q) => !q.approved).length;
  const { mcq: mcqCount, short: shortCount, long: longCount } = countByType(questions);

  return (
    <StepGuard step={5}>
      <div className={PAGE_BG}>
        <Navbar />
        <PageContainer subtitle="Module 1 / Step 5" title="Review Questions">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Sidebar />

            <div className="flex-1 min-w-0">
              <Stepper steps={M1_STEPS} currentStep={5} />

              {finalizeError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-50 p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <p className="text-xs text-rose-600">{finalizeError}</p>
                </div>
              )}

              {finalizedSessionId && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <p className="text-xs text-emerald-700">Session saved with model answers. View it under Sessions.</p>
                </div>
              )}
              {questionsActionError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-50 p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <p className="text-xs text-rose-600">{questionsActionError}</p>
                </div>
              )}

              <div className={`mb-5 flex items-center justify-between rounded-2xl border px-5 py-3 ${
                isValid
                  ? 'border-emerald-400/25 bg-emerald-500/[0.07]'
                  : 'border-amber-400/25  bg-amber-500/[0.07]'
              }`}>
                <div className="flex items-center gap-2">
                  {isValid
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                  <span className="text-sm font-semibold text-slate-900">
                    {isValid ? 'Marks validated — ready to export' : 'Marks need adjustment'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Total:</span>
                  <span className={`text-xl font-black ${isValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {totalMarks}
                  </span>
                  <span className="text-slate-600">/</span>
                  <span className="text-xl font-black text-slate-900">{targetMarks}</span>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => setAddModalOpen(true)}
                      disabled={!projectId || questionsActionLoading}
                    >
                      Add New Question
                    </Button>
                    {pending > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Check className="h-4 w-4" />}
                        onClick={() => approveAllQuestions()}
                        disabled={!projectId || questionsActionLoading}
                      >
                        Approve All ({pending})
                      </Button>
                    )}
                  </div>

                  {questions.length === 0 && (
                    <Card className="text-center py-10">
                      <p className="text-sm text-slate-500">No questions yet. Generate questions first or add your own.</p>
                    </Card>
                  )}

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
                            ? 'border-slate-200 bg-slate-50'
                            : 'border-amber-400/20 bg-amber-500/[0.04]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${TYPE_STYLE[q.type] ?? 'bg-slate-500/20 text-slate-600'}`}>
                              {displayType(q.type)}
                            </span>
                            <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${DIFF_STYLE[q.difficulty] ?? ''}`}>
                              {q.difficulty}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <StatusBadge tone={q.approved ? 'success' : 'warning'} dot pulse={!q.approved}>
                              {q.approved ? 'Approved' : 'Pending'}
                            </StatusBadge>
                            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-900">
                              {q.marks}m
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-700">{q.text}</p>
                        <p className="mt-1 text-[10px] text-slate-600">Topic: {q.topic}</p>

                        {q.type === 'MCQ' && q.options?.length > 0 && (
                          <ul className="mt-3 space-y-1.5 pl-1">
                            {q.options.map((opt, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                                <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700">{String.fromCharCode(65 + idx)}</span>
                                <span>{opt}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {q.answer && (
                          <p className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                            ✓ Answer: {q.answer}
                          </p>
                        )}

                        <SourceEvidence question={q} />

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <ActionBtn
                            onClick={() => approveQuestion(q.id)}
                            icon={Check}
                            label="Approve"
                            loading={savingQuestionId === q.id}
                            disabled={q.approved}
                            className="border-emerald-400/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                          />
                          <ActionBtn
                            onClick={() => regenerateQuestion(q.id)}
                            icon={RefreshCw}
                            label={regeneratingIds?.has(q.id) ? 'Regenerating…' : 'Regenerate'}
                            loading={regeneratingIds?.has(q.id)}
                            className="border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                          />
                          <ActionBtn
                            onClick={() => setEditModal({ open: true, question: q })}
                            icon={Edit3}
                            label="Edit"
                            className="border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                          />
                          <ActionBtn
                            onClick={() => duplicateQuestion(q.id)}
                            icon={Copy}
                            label="Duplicate"
                            loading={questionsActionLoading}
                            className="border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                          />
                          <ActionBtn
                            onClick={() => setDeleteConfirm(q.id)}
                            icon={Trash2}
                            label="Delete"
                            loading={savingQuestionId === q.id}
                            className="ml-auto border-rose-400/20 bg-rose-500/[0.07] text-rose-600 hover:bg-rose-500/15"
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <Card className="sticky top-24 h-fit">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Review Panel</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">Paper Summary</h3>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {[
                      { label: 'Total Qns',   value: questions.length, color: 'text-slate-900' },
                      { label: 'Approved',    value: approved,         color: 'text-emerald-700' },
                      { label: 'Pending',     value: pending,          color: 'text-amber-700' },
                      { label: 'Total Marks', value: totalMarks,       color: isValid ? 'text-emerald-700' : 'text-amber-700' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Question Mix</p>
                    <div className="space-y-2.5">
                      {[
                        { label: 'MCQ',          count: mcqCount,   pct: Math.round((mcqCount / (questions.length || 1)) * 100),   color: 'text-purple-700' },
                        { label: 'Short Answer', count: shortCount, pct: Math.round((shortCount / (questions.length || 1)) * 100), color: 'text-blue-600' },
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

                  <p className="mt-4 text-[10px] leading-5 text-slate-500">
                    Approve questions, then finalize to send them to the LLM for model answers and save as an exam session.
                  </p>
                  {approved > 0 && (
                    <Button
                      className="mt-4 w-full"
                      onClick={handleFinalize}
                      disabled={finalizeLoading || !projectId}
                      icon={finalizeLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    >
                      {finalizeLoading ? 'Generating answers…' : `Finalize ${approved} Approved Question(s)`}
                    </Button>
                  )}
                </Card>
              </div>

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

        <QuestionFormModal
          open={editModal.open}
          title="Edit Question"
          initialQuestion={editModal.question}
          topics={topics}
          saving={!!savingQuestionId}
          onClose={() => setEditModal({ open: false, question: null })}
          onSave={handleEditSave}
        />

        <QuestionFormModal
          open={addModalOpen}
          title="Add New Question"
          initialQuestion={null}
          topics={topics}
          saving={questionsActionLoading}
          onClose={() => setAddModalOpen(false)}
          onSave={handleAddSave}
        />

        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onClick={() => setDeleteConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6"
              >
                <h3 className="text-lg font-bold text-slate-900">Delete question?</h3>
                <p className="mt-2 text-sm text-slate-500">This cannot be undone.</p>
                <div className="mt-5 flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                  <Button
                    onClick={() => handleDelete(deleteConfirm)}
                    disabled={savingQuestionId === deleteConfirm}
                  >
                    Delete
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StepGuard>
  );
}
