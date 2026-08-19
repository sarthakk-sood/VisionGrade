import { useState, useEffect } from 'react';
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
import { PAGE_BG } from '../utils/theme';
import { buildDashboardStats, buildActivityTimeline } from '../utils/sessionHelpers';

const STAT_ICONS = [BookOpen, FileText, FileCheck2, AlertTriangle];

const STATUS_TONE = {
  Evaluated: 'success', Exported: 'success',
  Evaluating: 'warning', Generated: 'info', Draft: 'neutral',
};


function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DashboardPage() {
  const examSessions  = useAppStore((s) => s.examSessions);
  const sessionsLoading = useAppStore((s) => s.sessionsLoading);
  const loadSessionsFromBackend = useAppStore((s) => s.loadSessionsFromBackend);
  const navigate      = useNavigate();

  useEffect(() => {
    loadSessionsFromBackend();
  }, [loadSessionsFromBackend]);

  const stats = buildDashboardStats(examSessions);
  const timeline = buildActivityTimeline(examSessions);

  const [search, setSearch] = useState('');

  const filtered = examSessions.filter((s) =>
    s.examName.toLowerCase().includes(search.toLowerCase()) ||
    s.subject.toLowerCase().includes(search.toLowerCase()),
  );

  const evaluated = examSessions.filter((s) => s.studentsEvaluated > 0);
  const hasSessions = examSessions.length > 0;

  return (
    <div className={PAGE_BG}>
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-600 focus:border-blue-400/40 focus:outline-none focus:ring-1 focus:ring-blue-200 transition"
                />
              </div>
              <p className="shrink-0 text-xs text-slate-500">{filtered.length} sessions found</p>
            </div>

            {/* ── Two table panels ── */}
            <div className="grid gap-5 xl:grid-cols-2">

              {/* Left — Question Papers Generated */}
              <Card p="p-0" hover={false}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Exam Paper Library</p>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-900">Question Papers Generated</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                    {filtered.length} papers
                  </span>
                </div>

                {sessionsLoading ? (
                  <div className="px-5 py-12 text-center text-sm text-slate-500">Loading sessions…</div>
                ) : !hasSessions ? (
                  <EmptyState
                    icon={FileText}
                    title="No exam sessions yet"
                    description="Generate and finalize a question paper to see it here."
                    action={<Button to="/module1/exam-details" size="sm">Create Exam Session</Button>}
                  />
                ) : filtered.length === 0 ? (
                  <EmptyState icon={FileText} title="No matches" description="Try a different search term." />
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
                            className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                          >
                            <td className="px-5 py-3.5">
                              <div>
                                <p className="font-semibold text-slate-900 truncate max-w-[160px]">{s.examName}</p>
                                {s.subject && (
                                  <p className="text-[10px] text-slate-500 mt-0.5">{s.subject}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-bold text-slate-900">{s.totalMarks}</td>
                            <td className="px-4 py-3.5 text-slate-500">{s.questionCount}</td>
                            <td className="px-4 py-3.5 text-slate-500">{formatDate(s.dateCreated)}</td>
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
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Evaluation Tracker</p>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-900">Answer Sheet Evaluations</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                    {evaluated.length} evaluated
                  </span>
                </div>

                {evaluated.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <FileCheck2 className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">Evaluation not started</p>
                    <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
                      Once you upload answer sheets in Module 2, student scores and flagged responses will appear here.
                    </p>
                    <Button to="/module2/upload" size="sm" className="mt-5">
                      Go to Module 2
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Exam Name</th>
                          <th className="px-4 py-3 font-semibold">Students</th>
                          <th className="px-4 py-3 font-semibold">Pending</th>
                          <th className="px-4 py-3 font-semibold">Avg Score</th>
                          <th className="px-4 py-3 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluated.map((s, i) => {
                          const scoreColor =
                            s.avgScore >= 80 ? 'text-emerald-700'
                            : s.avgScore >= 60 ? 'text-amber-700'
                            : 'text-rose-600';
                          return (
                            <motion.tr
                              key={s.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.04 }}
                              onClick={() => navigate(`/session/${s.id}`)}
                              className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                            >
                              <td className="px-5 py-3.5">
                                <p className="font-semibold text-slate-900 truncate max-w-[160px]">{s.examName}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{s.subject}</p>
                              </td>
                              <td className="px-4 py-3.5 text-slate-600">{s.studentsEvaluated}</td>
                              <td className="px-4 py-3.5">
                                {s.pendingSheets > 0 ? (
                                  <span className="flex items-center gap-1 text-amber-700 font-semibold">
                                    <AlertTriangle className="h-3 w-3" />
                                    {s.pendingSheets}
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
