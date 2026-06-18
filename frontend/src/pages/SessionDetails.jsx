import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileText, Target,
  Calendar, BookOpen, Hash, BarChart3, Download,
  CheckCircle2, Clock3,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { sessionApi, downloadBlobResponse } from '../services/api';
import Navbar        from '../components/layout/Navbar';
import Sidebar       from '../components/layout/Sidebar';
import PageContainer from '../components/layout/PageContainer';
import Card          from '../components/common/Card';
import Button        from '../components/common/Button';
import StatusBadge   from '../components/common/StatusBadge';
import ProgressBar   from '../components/common/ProgressBar';
import EmptyState    from '../components/common/EmptyState';
import { PAGE_BG } from '../utils/theme';
import {
  buildSessionActivity,
  countQuestionsByType,
  deriveTopicsFromQuestions,
  sessionDetailRows,
} from '../utils/sessionHelpers';


const STATUS_TONE = {
  Generated: 'info',
  Exported:  'success',
  Evaluated: 'success',
  Evaluating: 'warning',
  Draft: 'neutral',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

export default function SessionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const examSessions        = useAppStore((s) => s.examSessions);
  const getSessionById      = useAppStore((s) => s.getSessionById);
  const fetchSessionById    = useAppStore((s) => s.fetchSessionById);
  const loadSessionsFromBackend = useAppStore((s) => s.loadSessionsFromBackend);

  const session  = examSessions.find((s) => s.id === id) || getSessionById(id);

  const [modelAnswers, setModelAnswers] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [exportingPaper, setExportingPaper] = useState(false);
  const [exportingKey, setExportingKey] = useState(false);
  const [exportError, setExportError] = useState(null);

  const parseExportError = async (err) => {
    const data = err?.response?.data;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const json = JSON.parse(text);
        return json.error || 'Export failed';
      } catch {
        return 'Export failed';
      }
    }
    return err?.response?.data?.error || err.message || 'Export failed';
  };

  const handleExportQuestionPaper = async () => {
    if (!id) return;
    setExportingPaper(true);
    setExportError(null);
    try {
      const res = await sessionApi.exportQuestionPaper(id);
      downloadBlobResponse(res, `${session?.examName || 'exam'}-question-paper.pdf`);
    } catch (err) {
      setExportError(await parseExportError(err));
    } finally {
      setExportingPaper(false);
    }
  };

  const handleExportAnswerKey = async () => {
    if (!id) return;
    setExportingKey(true);
    setExportError(null);
    try {
      const res = await sessionApi.exportAnswerKey(id);
      downloadBlobResponse(res, `${session?.examName || 'exam'}-answer-key.pdf`);
    } catch (err) {
      setExportError(await parseExportError(err));
    } finally {
      setExportingKey(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoadingSession(true);
      await loadSessionsFromBackend();
      const cached = getSessionById(id);
      if (cached?.sessionQuestions?.length) {
        setModelAnswers(cached.sessionQuestions);
        setLoadingSession(false);
        return;
      }
      const fetched = await fetchSessionById(id);
      setModelAnswers(fetched?.sessionQuestions || []);
      setLoadingSession(false);
    };

    load();
  }, [id, fetchSessionById, getSessionById, loadSessionsFromBackend]);

  const topicRows = session ? deriveTopicsFromQuestions(modelAnswers || []) : [];
  const typeRows = session ? countQuestionsByType(modelAnswers || []) : [];
  const sessionActivity = session ? buildSessionActivity(session) : [];
  const detailRows = session ? sessionDetailRows(session) : [];

  if (loadingSession) {
    return (
      <div className={PAGE_BG}>
        <Navbar />
        <PageContainer title="Loading session…" subtitle="Exam Session">
          <Card className="py-12 text-center text-sm text-slate-500">Fetching questions and model answers…</Card>
        </PageContainer>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={PAGE_BG}>
        <Navbar />
        <PageContainer title="Session Not Found" subtitle="Error">
          <EmptyState
            icon={FileText}
            title="Session not found"
            description="The exam session you are looking for does not exist."
            action={<Button to="/dashboard">Back to Dashboard</Button>}
          />
        </PageContainer>
      </div>
    );
  }

  const totalTopicMarks = topicRows.reduce((sum, t) => sum + (t.marks || 0), 0);

  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer
        subtitle="Session Hub"
        title={session.examName}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
            <StatusBadge tone={STATUS_TONE[session.status] ?? 'neutral'} dot pulse={session.status === 'Evaluating'}>
              {session.status}
            </StatusBadge>
          </div>
        }
      >
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />
          <div className="flex-1 min-w-0 space-y-5">

            {/* ── Top stat chips ── */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Total Marks', value: session.totalMarks, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Questions', value: session.questionCount, icon: Hash, color: 'text-purple-700', bg: 'bg-purple-50' },
                { label: 'Model Answers', value: modelAnswers?.length || 0, icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-2xl border border-slate-200 p-4"
                  >
                    <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${stat.bg}`}>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                    <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{stat.label}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Two-column content ── */}
            <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">

              {/* Left column */}
              <div className="space-y-5">

                {/* Exam Information */}
                <Card>
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Exam Information</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">Session Details</h3>
                  </div>
                  {detailRows.map((row) => (
                    <InfoRow key={row.label} label={row.label} value={row.value} />
                  ))}
                </Card>

                {topicRows.length > 0 && (
                <Card>
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Topic Coverage</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">Marks by Topic</h3>
                  </div>
                  <div className="space-y-4">
                    {topicRows.map((topic) => (
                      <div key={topic.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-600 truncate">{topic.name}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-slate-500">{topic.questionCount} qns</span>
                            <span className="text-xs font-bold text-blue-600">{topic.marks}m</span>
                          </div>
                        </div>
                        <ProgressBar value={totalTopicMarks ? Math.round((topic.marks / totalTopicMarks) * 100) : 0} showValue={false} height="h-1" />
                      </div>
                    ))}
                  </div>
                </Card>
                )}

                {sessionActivity.length > 0 && (
                <Card>
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">History</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">Session Activity</h3>
                  </div>
                  <div className="space-y-4">
                    {sessionActivity.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex gap-3"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                          <Clock3 className="h-3 w-3 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{item.detail}</p>
                          <p className="mt-0.5 text-[10px] text-slate-600">{item.time}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-5">

                {typeRows.length > 0 && (
                <Card>
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Paper Structure</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">Question Distribution</h3>
                  </div>
                  <div className="space-y-3">
                    {typeRows.map((row) => (
                      <div key={row.label} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">{row.label}</span>
                          <span className="font-semibold text-slate-900">{row.count} question{row.count !== 1 ? 's' : ''}</span>
                        </div>
                        <ProgressBar value={row.pct} showValue={false} tone={row.color} height="h-1" />
                      </div>
                    ))}
                  </div>
                </Card>
                )}

                {/* Model Answers (from finalized session) */}
                {modelAnswers?.length > 0 && (
                  <Card>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Answer Key</p>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">Model Answers ({modelAnswers.length})</h3>
                    <div className="mt-4 space-y-4 max-h-96 overflow-y-auto">
                      {modelAnswers.map((q) => (
                        <div key={q.id || q.questionNumber} className="rounded-xl border border-slate-100 bg-white/[0.03] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900">Q{q.questionNumber} · {q.type}</span>
                            <span className="text-[10px] text-slate-500">{q.marks} marks</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-600">{q.questionText}</p>
                          <p className="mt-2 text-xs text-emerald-700">
                            <span className="font-semibold">Answer: </span>{q.correctAnswer}
                          </p>
                          {q.modelAnswer && (
                            <p className="mt-1 text-xs text-slate-500 leading-5">
                              <span className="font-semibold text-slate-600">Model: </span>{q.modelAnswer}
                            </p>
                          )}
                          {q.markingScheme && (
                            <p className="mt-1 text-[10px] text-slate-500">{q.markingScheme}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

              </div>
            </div>

            {/* ── Export Actions ── */}
            <Card variant="accent">
              <h3 className="text-sm font-bold text-slate-900">Export & Actions</h3>
              <p className="mt-1 text-xs text-slate-500">Download LaTeX-compiled PDFs or proceed to evaluation for this session.</p>
              {exportError && (
                <p className="mt-2 text-xs text-rose-600">{exportError}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                  onClick={handleExportQuestionPaper}
                  loading={exportingPaper}
                  disabled={exportingKey || !modelAnswers?.length}
                >
                  Export Question Paper PDF
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                  onClick={handleExportAnswerKey}
                  loading={exportingKey}
                  disabled={exportingPaper || !modelAnswers?.length}
                >
                  Export Answer Key PDF
                </Button>
                <Button to="/module2/upload" size="sm" icon={<BarChart3 className="h-4 w-4" />}>
                  Evaluate Answer Sheets
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
