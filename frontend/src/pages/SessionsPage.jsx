import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, Plus, FileText, CheckCircle2, Clock3, AlertTriangle, FileCheck2
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import Navbar        from '../components/layout/Navbar';
import Sidebar       from '../components/layout/Sidebar';
import PageContainer from '../components/layout/PageContainer';
import Card          from '../components/common/Card';
import Button        from '../components/common/Button';
import StatusBadge   from '../components/common/StatusBadge';
import EmptyState    from '../components/common/EmptyState';

const STATUS_TONE = {
  Evaluated: 'success', Exported: 'success',
  Evaluating: 'warning', Generated: 'info', Draft: 'neutral',
};

const BG = 'bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SessionsPage() {
  const examSessions = useAppStore((s) => s.examSessions);
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All'); // All, Evaluated, Pending

  let filtered = examSessions.filter((s) =>
    s.examName.toLowerCase().includes(search.toLowerCase()) ||
    s.subject.toLowerCase().includes(search.toLowerCase())
  );

  if (filter === 'Evaluated') {
    filtered = filtered.filter(s => s.studentsEvaluated > 0);
  } else if (filter === 'Pending') {
    filtered = filtered.filter(s => !s.studentsEvaluated);
  }

  return (
    <div className={`min-h-screen ${BG}`}>
      <Navbar />
      <PageContainer
        subtitle="SESSION MANAGEMENT"
        title="All Exam Sessions"
        actions={
          <Button to="/module1/exam-details" icon={<Plus className="h-4 w-4" />}>
            New Session
          </Button>
        }
      >
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0 space-y-6">

            {/* ── Search & Filters ── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search sessions by name or subject..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-600 focus:border-blue-400/40 focus:outline-none focus:ring-1 focus:ring-blue-400/20 transition"
                />
              </div>

              <div className="flex items-center gap-2">
                {['All', 'Pending', 'Evaluated'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                      filter === f
                        ? 'border-blue-400/30 bg-blue-500/15 text-blue-200'
                        : 'border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Sessions List ── */}
            <Card p="p-0" hover={false}>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Library</p>
                  <h3 className="mt-0.5 text-sm font-bold text-white">Exam Sessions</h3>
                </div>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                  {filtered.length} total
                </span>
              </div>

              {filtered.length === 0 ? (
                <EmptyState icon={FileText} title="No sessions found" description="Try a different search term or filter." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Exam Name & Subject</th>
                        <th className="px-4 py-3 font-semibold">Paper Details</th>
                        <th className="px-4 py-3 font-semibold">Evaluation Status</th>
                        <th className="px-4 py-3 font-semibold">Date Created</th>
                        <th className="px-4 py-3 font-semibold text-right">Status</th>
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
                          <td className="px-5 py-4">
                            <p className="font-bold text-white truncate max-w-[200px] text-sm">{s.examName}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{s.subjectCode} · {s.subject}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-white">{s.totalMarks} Marks</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{s.questionCount} Questions</p>
                          </td>
                          <td className="px-4 py-4">
                            {s.studentsEvaluated ? (
                              <div>
                                <p className="font-semibold text-emerald-300">{s.studentsEvaluated} Evaluated</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Avg: {s.avgScore}%</p>
                              </div>
                            ) : (
                              <p className="font-semibold text-slate-500">—</p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-slate-400">{formatDate(s.dateCreated)}</td>
                          <td className="px-4 py-4 text-right">
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

          </div>
        </div>
      </PageContainer>
    </div>
  );
}
