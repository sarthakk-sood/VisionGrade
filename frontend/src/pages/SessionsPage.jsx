import { useState, useEffect } from 'react';
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
import { PAGE_BG } from '../utils/theme';

const STATUS_TONE = {
  Evaluated: 'success', Exported: 'success',
  Evaluating: 'warning', Generated: 'info', Draft: 'neutral',
};


function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SessionsPage() {
  const examSessions = useAppStore((s) => s.examSessions);
  const loadSessionsFromBackend = useAppStore((s) => s.loadSessionsFromBackend);
  const sessionsLoading = useAppStore((s) => s.sessionsLoading);
  const navigate = useNavigate();

  useEffect(() => {
    loadSessionsFromBackend();
  }, [loadSessionsFromBackend]);

  const [search, setSearch] = useState('');

  let filtered = examSessions.filter((s) =>
    s.examName.toLowerCase().includes(search.toLowerCase()) ||
    (s.subject || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={PAGE_BG}>
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-600 focus:border-blue-400/40 focus:outline-none focus:ring-1 focus:ring-blue-200 transition"
                />
              </div>

              <p className="shrink-0 text-xs text-slate-500">
                {filtered.length} session{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>

            <Card p="p-0" hover={false}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Library</p>
                  <h3 className="mt-0.5 text-sm font-bold text-slate-900">Exam Sessions</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                  {filtered.length} total
                </span>
              </div>

              {sessionsLoading ? (
                <div className="px-5 py-12 text-center text-sm text-slate-500">Loading sessions…</div>
              ) : examSessions.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No exam sessions yet"
                  description="Finalize a question paper to create your first session."
                  action={<Button to="/module1/exam-details" size="sm">Start Module 1</Button>}
                />
              ) : filtered.length === 0 ? (
                <EmptyState icon={FileText} title="No matches" description="Try a different search term." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Exam Name & Subject</th>
                        <th className="px-4 py-3 font-semibold">Paper Details</th>
                        <th className="px-4 py-3 font-semibold">Answer Key</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
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
                          className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-900 truncate max-w-[200px] text-sm">{s.examName}</p>
                            {s.subject && (
                              <p className="text-[10px] text-slate-500 mt-0.5">{s.subject}</p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-900">{s.totalMarks} Marks</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{s.questionCount} Questions</p>
                          </td>
                          <td className="px-4 py-4">
                            {s.hasModelAnswers ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-slate-500">{formatDate(s.dateCreated)}</td>
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
