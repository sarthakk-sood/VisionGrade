import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen, FileText, FileCheck2, AlertTriangle,
  Search, Plus, ExternalLink,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import Navbar            from '../components/layout/Navbar';
import Sidebar           from '../components/layout/Sidebar';
import PageContainer     from '../components/layout/PageContainer';
import StatsCard         from '../components/dashboard/StatsCard';
import ActivityTimeline  from '../components/dashboard/ActivityTimeline';
import QuickActions      from '../components/dashboard/QuickActions';
import Card              from '../components/common/Card';
import StatusBadge       from '../components/common/StatusBadge';
import Button            from '../components/common/Button';
import EmptyState        from '../components/common/EmptyState';

const STAT_ICONS = [BookOpen, FileText, FileCheck2, AlertTriangle];

const STATUS_TONE = {
  Evaluated: 'success', Exported: 'success',
  Evaluating: 'warning', Generated: 'info', Draft: 'neutral',
};

const BG = 'bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DashboardPage() {
  const stats         = useAppStore((s) => s.dashboardStats);
  const timeline      = useAppStore((s) => s.activityTimeline);
  const examSessions  = useAppStore((s) => s.examSessions);
  const navigate      = useNavigate();

  const [search, setSearch] = useState('');

  const filtered = examSessions.filter((s) =>
    s.examName.toLowerCase().includes(search.toLowerCase()) ||
    s.subject.toLowerCase().includes(search.toLowerCase()),
  );

  const evaluated = examSessions.filter((s) => s.studentsEvaluated > 0);

  return (
    <div className={`min-h-screen ${BG}`}>
      <Navbar />
      <PageContainer
        subtitle="AI-POWERED ACADEMIC EVALUATION"
        title="Exam Sessions Dashboard"
        actions={
          <Button to="/module1/exam-details" icon={<Plus className="h-4 w-4" />}>
            New Exam Session
          </Button>
        }
      >
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0 space-y-6">
            {/* ── Stat Cards ── */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((item, i) => (
                <StatsCard key={item.label} {...item} icon={STAT_ICONS[i]} index={i} />
              ))}
            </div>

            {/* ── Search + New ── */}
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search exam sessions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-600 focus:border-blue-400/40 focus:outline-none focus:ring-1 focus:ring-blue-400/20 transition"
                />
              </div>
              <p className="shrink-0 text-xs text-slate-500">{filtered.length} sessions found</p>
            </div>

            {/* ── Two table panels ── */}
            <div className="grid gap-5 xl:grid-cols-2">

              {/* Left — Question Papers Generated */}
              <Card p="p-0" hover={false}>
                <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Exam Paper Library</p>
                    <h3 className="mt-0.5 text-sm font-bold text-white">Question Papers Generated</h3>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                    {filtered.length} papers
                  </span>
                </div>

                {filtered.length === 0 ? (
                  <EmptyState icon={FileText} title="No sessions found" description="Try a different search term." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Exam Name</th>
                          <th className="px-4 py-3 font-semibold">Marks</th>
                          <th className="px-4 py-3 font-semibold">Qns</th>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((s, i) => (
                          <motion.tr
                            key={s.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => navigate(`/session/${s.id}`)}
                            className="cursor-pointer border-t border-white/[0.05] transition hover:bg-white/[0.04]"
                          >
                            <td className="px-5 py-3.5">
                              <div>
                                <p className="font-semibold text-white truncate max-w-[160px]">{s.examName}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{s.subjectCode} · {s.session}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-bold text-white">{s.totalMarks}</td>
                            <td className="px-4 py-3.5 text-slate-400">{s.questionCount}</td>
                            <td className="px-4 py-3.5 text-slate-500">{formatDate(s.dateGenerated)}</td>
                            <td className="px-4 py-3.5">
                              <StatusBadge tone={STATUS_TONE[s.status] ?? 'neutral'} dot>
                                {s.status}
                              </StatusBadge>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Right — Answer Sheet Evaluations */}
              <Card p="p-0" hover={false}>
                <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Evaluation Tracker</p>
                    <h3 className="mt-0.5 text-sm font-bold text-white">Answer Sheet Evaluations</h3>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                    {evaluated.length} evaluated
                  </span>
                </div>

                {evaluated.length === 0 ? (
                  <EmptyState
                    icon={FileCheck2}
                    title="No evaluations yet"
                    description="Evaluate answer sheets after generating a question paper."
                    action={<Button to="/module2/upload" size="sm">Start Evaluation</Button>}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Exam Name</th>
                          <th className="px-4 py-3 font-semibold">Students</th>
                          <th className="px-4 py-3 font-semibold">Flagged</th>
                          <th className="px-4 py-3 font-semibold">Avg Score</th>
                          <th className="px-4 py-3 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluated.map((s, i) => {
                          const scoreColor =
                            s.avgScore >= 80 ? 'text-emerald-300'
                            : s.avgScore >= 60 ? 'text-amber-300'
                            : 'text-rose-300';
                          return (
                            <motion.tr
                              key={s.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.04 }}
                              onClick={() => navigate(`/session/${s.id}`)}
                              className="cursor-pointer border-t border-white/[0.05] transition hover:bg-white/[0.04]"
                            >
                              <td className="px-5 py-3.5">
                                <p className="font-semibold text-white truncate max-w-[160px]">{s.examName}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{s.subject}</p>
                              </td>
                              <td className="px-4 py-3.5 text-slate-300">{s.studentsEvaluated}</td>
                              <td className="px-4 py-3.5">
                                {s.flaggedResponses > 0 ? (
                                  <span className="flex items-center gap-1 text-amber-300 font-semibold">
                                    <AlertTriangle className="h-3 w-3" />
                                    {s.flaggedResponses}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                              <td className={`px-4 py-3.5 font-bold ${scoreColor}`}>{s.avgScore}%</td>
                              <td className="px-4 py-3.5 text-slate-500">{formatDate(s.evaluationDate)}</td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            {/* ── Feature Action Cards ── */}
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600">Quick Start</p>
              <QuickActions />
            </div>

            {/* ── Activity Timeline ── */}
            <ActivityTimeline items={timeline} />
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
