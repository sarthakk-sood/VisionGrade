import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Download } from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import StatusBadge   from '../../components/common/StatusBadge';
import EmptyState    from '../../components/common/EmptyState';
import { useAppStore } from '../../store/useAppStore';
import { evaluationApi } from '../../services/api';
import { PAGE_BG } from '../../utils/theme';

const M2_STEPS = ['Select Exam', 'Upload Sheets', 'Review', 'Results'];

const scoreColor = (p) =>
  p >= 80 ? 'text-emerald-700' : p >= 60 ? 'text-amber-700' : 'text-rose-600';

const MATCH_LEVEL_STYLE = {
  full:    'border-emerald-200 bg-emerald-50 text-emerald-700',
  partial: 'border-amber-200 bg-amber-50 text-amber-700',
  none:    'border-rose-200 bg-rose-50 text-rose-600',
};

const MATCH_LEVEL_LABEL = { full: 'Full', partial: 'Half', none: 'Missed' };

export default function EvaluationPage() {
  const selectedSessionId = useAppStore((s) => s.selectedSessionId);
  const examSessions = useAppStore((s) => s.examSessions);
  const evaluationReports = useAppStore((s) => s.evaluationReports);
  const evaluationSummary = useAppStore((s) => s.evaluationSummary);
  const loadEvaluationReports = useAppStore((s) => s.loadEvaluationReports);
  const loadAnswerSheets = useAppStore((s) => s.loadAnswerSheets);
  const answerSheets = useAppStore((s) => s.answerSheets);
  const loadSessionsFromBackend = useAppStore((s) => s.loadSessionsFromBackend);

  const session = examSessions.find((s) => s.id === selectedSessionId);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [draftMarks, setDraftMarks] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!examSessions.length) loadSessionsFromBackend();
  }, [examSessions.length, loadSessionsFromBackend]);

  useEffect(() => {
    if (!selectedSessionId) return;
    loadEvaluationReports(selectedSessionId);
    loadAnswerSheets(selectedSessionId);
  }, [selectedSessionId, loadEvaluationReports, loadAnswerSheets]);

  const selectedReport = useMemo(
    () => evaluationReports.find((r) => r.id === selectedReportId) || evaluationReports[0] || null,
    [evaluationReports, selectedReportId]
  );

  useEffect(() => {
    if (!selectedReport) {
      setDraftMarks({});
      return;
    }
    const next = {};
    for (const row of selectedReport.questionEvals || []) {
      next[row.questionNumber] = row.marksAwarded;
    }
    setDraftMarks(next);
  }, [selectedReport]);

  const unevaluated = answerSheets.filter((s) => s.status === 'uploaded').length;

  const handleEvaluateAll = async () => {
    if (!selectedSessionId) return;
    setBusy(true);
    setError('');
    try {
      await evaluationApi.evaluateAll(selectedSessionId);
      await loadEvaluationReports(selectedSessionId);
      await loadAnswerSheets(selectedSessionId);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Bulk evaluation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOverrides = async () => {
    if (!selectedReport) return;
    const overrides = (selectedReport.questionEvals || []).map((row) => ({
      questionNumber: row.questionNumber,
      marksAwarded: Number(draftMarks[row.questionNumber] ?? row.marksAwarded),
    }));
    setBusy(true);
    setError('');
    try {
      await evaluationApi.override(selectedReport.id, overrides);
      await loadEvaluationReports(selectedSessionId);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Could not save overrides');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const header = ['Roll Number', 'Student Name', 'Marks Obtained', 'Total Marks', 'Percentage', 'Status'];
    const rows = evaluationReports.map((r) => [
      r.rollNumber, r.studentName || '', r.marksObtained, r.totalMarks, r.percentage, r.status,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(session?.examName || 'evaluation').replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!selectedSessionId) {
    return (
      <div className={PAGE_BG}>
        <Navbar />
        <PageContainer subtitle="Module 2 / Step 4" title="Evaluation Results">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <EmptyState
                icon={BarChart3}
                title="Select an exam session"
                action={<Button to="/module2/upload">Go to Upload</Button>}
              />
            </div>
          </div>
        </PageContainer>
      </div>
    );
  }

  const avgScore = evaluationSummary?.averagePercentage ?? 0;
  const top = evaluationReports.reduce((best, r) => (!best || r.percentage > best.percentage ? r : best), null);

  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="Module 2 / Step 4" title="Evaluation Results">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />
          <div className="flex-1 min-w-0">
            <Stepper steps={M2_STEPS} currentStep={4} />

            <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Average Score', value: `${avgScore}%` },
                { label: 'Top Performer', value: top?.studentName || top?.rollNumber || '—' },
                { label: 'Pending sheets', value: unevaluated },
                { label: 'Evaluated', value: evaluationReports.length },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xl font-black text-slate-900">{s.value}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button onClick={handleEvaluateAll} loading={busy} disabled={unevaluated === 0 && evaluationReports.length === 0}>
                {busy ? 'Scoring…' : `Score remaining (${unevaluated})`}
              </Button>
              <p className="text-[11px] text-slate-500">
                Scores the sheet photo against the Module 1 marking scheme.
              </p>
              <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!evaluationReports.length}>
                Export CSV
              </Button>
            </div>

            <div className="flex flex-col gap-5 xl:flex-row">
              <Card p="p-0" hover={false} className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Results</p>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-900">{session?.examName || 'Student Evaluation Report'}</h3>
                  </div>
                </div>
                {evaluationReports.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={AlertTriangle}
                      title="No scores yet"
                      description="Upload a sheet, review the photo against the key, then score."
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Student</th>
                          <th className="px-4 py-3 font-semibold">Roll No</th>
                          <th className="px-4 py-3 font-semibold">Marks</th>
                          <th className="px-4 py-3 font-semibold">Score</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluationReports.map((r) => (
                          <tr
                            key={r.id}
                            onClick={() => setSelectedReportId(r.id)}
                            className={`cursor-pointer border-t border-slate-100 ${selectedReport?.id === r.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                          >
                            <td className="px-5 py-3 font-semibold text-slate-900">{r.studentName || '—'}</td>
                            <td className="px-4 py-3 text-slate-600">{r.rollNumber}</td>
                            <td className="px-4 py-3">{r.marksObtained}/{r.totalMarks}</td>
                            <td className={`px-4 py-3 font-black ${scoreColor(r.percentage)}`}>{r.percentage}%</td>
                            <td className="px-4 py-3">
                              <StatusBadge tone={r.status === 'approved' ? 'success' : 'info'}>{r.status}</StatusBadge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <a
                                href={evaluationApi.exportReportPdfUrl(r.id)}
                                onClick={(e) => e.stopPropagation()}
                                title="Download evaluated sheet PDF"
                                className="inline-flex items-center rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {selectedReport && (
                <Card className="xl:w-[380px] shrink-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Question marks</p>
                      <h3 className="mt-1 text-sm font-bold text-slate-900">
                        {selectedReport.studentName || selectedReport.rollNumber}
                      </h3>
                    </div>
                    <a
                      href={evaluationApi.exportReportPdfUrl(selectedReport.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </a>
                  </div>
                  <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {(selectedReport.questionEvals || []).map((row) => (
                      <div key={row.questionNumber} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-slate-500">Q{row.questionNumber} · max {row.maxMarks}</p>
                          <input
                            type="number"
                            min="0"
                            max={row.maxMarks}
                            step="0.5"
                            value={draftMarks[row.questionNumber] ?? row.marksAwarded}
                            onChange={(e) => setDraftMarks((prev) => ({ ...prev, [row.questionNumber]: e.target.value }))}
                            className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                          />
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs text-slate-700">{row.questionText}</p>
                        {row.studentAnswer ? (
                          <p className="mt-2 text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-500">Student: </span>
                            {row.studentAnswer}
                          </p>
                        ) : null}

                        {row.criteriaBreakdown?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              Step marking
                            </p>
                            {row.criteriaBreakdown.map((c, i) => (
                              <div
                                key={`${row.questionNumber}-${i}`}
                                className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-[10px] ${MATCH_LEVEL_STYLE[c.matchLevel] || MATCH_LEVEL_STYLE.none}`}
                              >
                                <span className="truncate">{c.point}</span>
                                <span className="shrink-0 font-semibold">
                                  {MATCH_LEVEL_LABEL[c.matchLevel] || 'Missed'} · {c.marksAwarded}/{c.maxMarks}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {row.matchedKeywords?.length > 0 && (
                          <p className="mt-1 text-[10px] text-emerald-700">
                            Keywords: {row.matchedKeywords.slice(0, 8).join(', ')}
                          </p>
                        )}
                        {row.feedback && <p className="mt-2 text-[11px] text-slate-500">{row.feedback}</p>}
                      </div>
                    ))}
                  </div>
                  <Button className="mt-4 w-full" onClick={handleSaveOverrides} loading={busy}>
                    Save mark overrides
                  </Button>
                </Card>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module2/mapping" icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
              <Button to="/module2/report" icon={<ArrowRight className="h-4 w-4" />}>Class report</Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
