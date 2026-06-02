import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileText, Users, AlertTriangle, Target,
  Calendar, BookOpen, Hash, BarChart3, Download,
  CheckCircle2, Clock3,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import Navbar        from '../components/layout/Navbar';
import Sidebar       from '../components/layout/Sidebar';
import PageContainer from '../components/layout/PageContainer';
import Card          from '../components/common/Card';
import Button        from '../components/common/Button';
import StatusBadge   from '../components/common/StatusBadge';
import ProgressBar   from '../components/common/ProgressBar';
import EmptyState    from '../components/common/EmptyState';

const BG = 'bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]';

const STATUS_TONE = {
  Evaluated: 'success', Exported: 'success',
  Evaluating: 'warning', Generated: 'info', Draft: 'neutral',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-200">{value}</span>
    </div>
  );
}

export default function SessionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const getSessionById      = useAppStore((s) => s.getSessionById);
  const getStudentsForSession = useAppStore((s) => s.getStudentsForSession);
  const getFlagsForSession  = useAppStore((s) => s.getFlagsForSession);
  const activityTimeline    = useAppStore((s) => s.activityTimeline);

  const session  = getSessionById(id);
  const students = getStudentsForSession(id);
  const flags    = getFlagsForSession(id);

  if (!session) {
    return (
      <div className={`min-h-screen ${BG}`}>
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

  const totalTopicMarks = session.topics.reduce((sum, t) => sum + t.marks, 0);

  const confidenceBadge = {
    High:   'bg-emerald-500/20 text-emerald-300',
    Medium: 'bg-amber-500/20  text-amber-300',
    Low:    'bg-rose-500/20   text-rose-300',
  };

  return (
    <div className={`min-h-screen ${BG}`}>
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Total Marks',       value: session.totalMarks,         icon: Target,        color: 'text-blue-300',    bg: 'bg-blue-500/15'    },
                { label: 'Total Questions',   value: session.questionCount,      icon: Hash,          color: 'text-purple-300',  bg: 'bg-purple-500/15'  },
                { label: 'Students Evaluated', value: session.studentsEvaluated || '—', icon: Users, color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
                { label: 'Flagged Responses', value: session.flaggedResponses || '—',   icon: AlertTriangle, color: 'text-amber-300',  bg: 'bg-amber-500/15'   },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-2xl border border-white/[0.07] p-4"
                  >
                    <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${stat.bg}`}>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                    <p className="text-2xl font-black text-white">{stat.value}</p>
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
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Exam Information</p>
                    <h3 className="mt-1 text-base font-bold text-white">Session Details</h3>
                  </div>
                  <InfoRow label="Subject"           value={session.subject} />
                  <InfoRow label="Subject Code"      value={session.subjectCode} />
                  <InfoRow label="Academic Year"     value={session.academicYear} />
                  <InfoRow label="Semester"          value={session.semester} />
                  <InfoRow label="Session"           value={session.session} />
                  <InfoRow label="Question Type"     value={session.questionType} />
                  <InfoRow label="Difficulty"        value={session.difficulty} />
                  <InfoRow label="Date Created"      value={formatDate(session.dateCreated)} />
                  {session.evaluationDate && (
                    <InfoRow label="Evaluation Date" value={formatDate(session.evaluationDate)} />
                  )}
                  {session.avgScore > 0 && (
                    <InfoRow label="Average Score"   value={`${session.avgScore}%`} />
                  )}
                </Card>

                {/* Topic Weightages */}
                <Card>
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Topic Coverage</p>
                    <h3 className="mt-1 text-base font-bold text-white">Topic Weightages</h3>
                  </div>
                  <div className="space-y-4">
                    {session.topics.map((topic) => (
                      <div key={topic.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-300 truncate">{topic.name}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-slate-500">{topic.marks}m</span>
                            <span className="text-xs font-bold text-blue-300">{topic.weightage}%</span>
                          </div>
                        </div>
                        <ProgressBar value={topic.weightage} showValue={false} height="h-1" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Activity Timeline */}
                <Card>
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">History</p>
                    <h3 className="mt-1 text-base font-bold text-white">Recent Activity</h3>
                  </div>
                  <div className="space-y-4">
                    {activityTimeline.slice(0, 4).map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex gap-3"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
                          <Clock3 className="h-3 w-3 text-blue-300" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">{item.title}</p>
                          <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{item.detail}</p>
                          <p className="mt-0.5 text-[10px] text-slate-600">{item.time}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Right column */}
              <div className="space-y-5">

                {/* Question Distribution */}
                <Card>
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Paper Structure</p>
                    <h3 className="mt-1 text-base font-bold text-white">Question Distribution</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'MCQ', count: Math.floor(session.questionCount * 0.4), color: 'purple', pct: 40 },
                      { label: 'Short Answer', count: Math.floor(session.questionCount * 0.35), color: 'blue', pct: 35 },
                      { label: 'Long Answer', count: Math.ceil(session.questionCount * 0.25), color: 'amber', pct: 25 },
                    ].map((row) => (
                      <div key={row.label} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">{row.label}</span>
                          <span className="font-semibold text-white">{row.count} questions</span>
                        </div>
                        <ProgressBar value={row.pct} showValue={false} tone={row.color} height="h-1" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Student Results (mini) */}
                {students.length > 0 && (
                  <Card p="p-0" hover={false}>
                    <div className="border-b border-white/[0.06] px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Evaluation</p>
                      <h3 className="mt-0.5 text-sm font-bold text-white">Student Results</h3>
                    </div>
                    <div className="divide-y divide-white/[0.05]">
                      {students.map((student) => {
                        const pctColor =
                          student.percentage >= 80 ? 'text-emerald-300'
                          : student.percentage >= 60 ? 'text-amber-300'
                          : 'text-rose-300';
                        return (
                          <div key={student.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-[10px] font-black text-blue-300">
                              {student.studentName[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-white">{student.studentName}</p>
                              <p className="text-[10px] text-slate-600">{student.rollNo}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-bold ${pctColor}`}>{student.percentage}%</p>
                              <StatusBadge tone={student.status === 'Evaluated' ? 'success' : 'warning'} className="mt-0.5 text-[9px]">
                                {student.status}
                              </StatusBadge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Flagged Responses */}
                {flags.length > 0 && (
                  <Card>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Flags</p>
                        <h3 className="mt-0.5 text-sm font-bold text-white">Flagged Responses</h3>
                      </div>
                      <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300">
                        {flags.length} total
                      </span>
                    </div>
                    <div className="space-y-2">
                      {flags.slice(0, 4).map((flag) => (
                        <div key={flag.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-white">{flag.questionNo}</span>
                              <span className="mx-1.5 text-slate-600">·</span>
                              <span className="text-[10px] text-slate-400">{flag.studentName}</span>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${confidenceBadge[flag.confidence]}`}>
                              {flag.confidence}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[10px] text-slate-500 leading-4">{flag.reason}</p>
                          <p className="mt-1 text-[10px] text-slate-600 line-clamp-2 leading-4">{flag.ocrText}</p>
                        </div>
                      ))}
                      {flags.length > 4 && (
                        <p className="text-center text-[10px] text-slate-600">
                          +{flags.length - 4} more flags
                        </p>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* ── Export Actions ── */}
            <Card variant="accent">
              <h3 className="text-sm font-bold text-white">Export & Actions</h3>
              <p className="mt-1 text-xs text-slate-400">Download reports or proceed to evaluation for this session.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />}>
                  Export Question Paper PDF
                </Button>
                <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />}>
                  Export Answer Key PDF
                </Button>
                <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />}>
                  Download Evaluation Report
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
