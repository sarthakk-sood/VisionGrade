import { useEffect } from 'react';
import { CheckCircle2, Download, ArrowLeft, Plus, BarChart3 } from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import EmptyState    from '../../components/common/EmptyState';
import { useAppStore } from '../../store/useAppStore';
import { PAGE_BG } from '../../utils/theme';

const scoreColor = (s) =>
  s >= 80 ? 'text-emerald-700' : s >= 60 ? 'text-amber-700' : 'text-rose-600';

export default function FinalReport() {
  const selectedSessionId = useAppStore((s) => s.selectedSessionId);
  const examSessions = useAppStore((s) => s.examSessions);
  const evaluationReports = useAppStore((s) => s.evaluationReports);
  const evaluationSummary = useAppStore((s) => s.evaluationSummary);
  const loadEvaluationReports = useAppStore((s) => s.loadEvaluationReports);
  const loadSessionsFromBackend = useAppStore((s) => s.loadSessionsFromBackend);

  const session = examSessions.find((s) => s.id === selectedSessionId);

  useEffect(() => {
    if (!examSessions.length) loadSessionsFromBackend();
  }, [examSessions.length, loadSessionsFromBackend]);

  useEffect(() => {
    if (selectedSessionId) loadEvaluationReports(selectedSessionId);
  }, [selectedSessionId, loadEvaluationReports]);

  const avgScore = evaluationSummary?.averagePercentage ?? 0;
  const topPerformer = evaluationReports.reduce(
    (top, e) => (!top || e.percentage > top.percentage ? e : top),
    null
  );

  const exportCsv = () => {
    const header = ['Roll Number', 'Student Name', 'Marks Obtained', 'Total Marks', 'Percentage'];
    const rows = evaluationReports.map((r) => [
      r.rollNumber, r.studentName || '', r.marksObtained, r.totalMarks, r.percentage,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(session?.examName || 'class-report').replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="Module 2 / Export" title="Final Report">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />
          <div className="flex-1 min-w-0">
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] px-5 py-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {evaluationReports.length ? 'Evaluation complete — class report ready' : 'No evaluations yet'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {evaluationReports.length} students evaluated
                  {session?.examName ? ` · ${session.examName}` : ''}
                </p>
              </div>
            </div>

            {!evaluationReports.length ? (
              <EmptyState
                icon={BarChart3}
                title="Score answer sheets first"
                description="Upload sheets, review the photo, then score against the answer key."
                action={<Button to="/module2/evaluate">Open evaluation</Button>}
              />
            ) : (
              <>
                <div className="mb-5 grid grid-cols-3 gap-4">
                  {[
                    { label: 'Class average', value: `${avgScore}%` },
                    { label: 'Top score', value: topPerformer ? `${topPerformer.percentage}%` : '—' },
                    { label: 'Students', value: evaluationReports.length },
                  ].map((s) => (
                    <Card key={s.label}>
                      <p className={`text-2xl font-black ${scoreColor(typeof s.value === 'string' && s.value.endsWith('%') ? parseFloat(s.value) : 70)}`}>
                        {s.value}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{s.label}</p>
                    </Card>
                  ))}
                </div>

                <Card p="p-0" hover={false}>
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h3 className="text-sm font-bold text-slate-900">Per-student marks</h3>
                    <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
                      Download CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Student</th>
                          <th className="px-4 py-3">Roll No</th>
                          <th className="px-4 py-3">Marks</th>
                          <th className="px-4 py-3">Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluationReports.map((r) => (
                          <tr key={r.id} className="border-t border-slate-100">
                            <td className="px-5 py-3 font-semibold">{r.studentName || '—'}</td>
                            <td className="px-4 py-3">{r.rollNumber}</td>
                            <td className="px-4 py-3">{r.marksObtained}/{r.totalMarks}</td>
                            <td className={`px-4 py-3 font-black ${scoreColor(r.percentage)}`}>{r.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module2/evaluate" icon={<ArrowLeft className="h-4 w-4" />}>
                Back to evaluation
              </Button>
              <Button to="/module1/exam-details" icon={<Plus className="h-4 w-4" />}>
                New exam
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
