import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, FileText } from 'lucide-react';
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

const isPdfSheet = (sheet) => {
  const mime = String(sheet?.mimeType || '').toLowerCase();
  const name = String(sheet?.originalFilename || sheet?.fileUrl || '').split('?')[0];
  return mime === 'application/pdf' || /\.pdf$/i.test(name);
};

export default function AnswerMapping() {
  const navigate = useNavigate();
  const selectedSessionId = useAppStore((s) => s.selectedSessionId);
  const examSessions = useAppStore((s) => s.examSessions);
  const answerSheets = useAppStore((s) => s.answerSheets);
  const loadAnswerSheets = useAppStore((s) => s.loadAnswerSheets);
  const loadSessionsFromBackend = useAppStore((s) => s.loadSessionsFromBackend);
  const fetchSessionById = useAppStore((s) => s.fetchSessionById);
  const setCurrentAnswerSheet = useAppStore((s) => s.setCurrentAnswerSheet);
  const currentAnswerSheetId = useAppStore((s) => s.currentAnswerSheetId);

  const session = examSessions.find((s) => s.id === selectedSessionId);
  const [evaluatingId, setEvaluatingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!examSessions.length) loadSessionsFromBackend();
  }, [examSessions.length, loadSessionsFromBackend]);

  useEffect(() => {
    if (selectedSessionId) {
      loadAnswerSheets(selectedSessionId);
      fetchSessionById(selectedSessionId);
    }
  }, [selectedSessionId, loadAnswerSheets, fetchSessionById]);

  const selectedSheet = useMemo(
    () => answerSheets.find((s) => s.id === currentAnswerSheetId) || answerSheets[0] || null,
    [answerSheets, currentAnswerSheetId]
  );

  const questions = session?.sessionQuestions || [];
  const evaluatedCount = answerSheets.filter((s) => s.status === 'evaluated').length;

  const handleEvaluate = async (sheetId) => {
    setError('');
    setEvaluatingId(sheetId);
    try {
      await evaluationApi.evaluateSheet(sheetId);
      await loadAnswerSheets(selectedSessionId);
      navigate('/module2/evaluate');
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Evaluation failed');
    } finally {
      setEvaluatingId(null);
    }
  };

  if (!selectedSessionId) {
    return (
      <div className={PAGE_BG}>
        <Navbar />
        <PageContainer subtitle="Module 2 / Step 3" title="Review Sheets">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <Stepper steps={M2_STEPS} currentStep={3} />
              <EmptyState
                icon={FileText}
                title="Select an exam first"
                description="Upload answer sheets against a finalized Module 1 session."
                action={<Button to="/module2/upload">Go to Upload</Button>}
              />
            </div>
          </div>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="Module 2 / Step 3" title="Review Sheets">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />
          <div className="flex-1 min-w-0">
            <Stepper steps={M2_STEPS} currentStep={3} />

            <div className="mb-5 grid grid-cols-3 gap-4">
              {[
                { label: 'Sheets uploaded', value: answerSheets.length },
                { label: 'Already scored', value: evaluatedCount },
                { label: 'Questions in key', value: questions.length },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                {error}
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Students</p>
                <h3 className="mt-1 text-sm font-bold text-slate-900">Uploaded answer sheets</h3>
                <div className="mt-4 space-y-2">
                  {answerSheets.length === 0 && (
                    <p className="text-xs text-slate-500">No sheets yet. Upload from the previous step.</p>
                  )}
                  {answerSheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      type="button"
                      onClick={() => setCurrentAnswerSheet(sheet.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left ${
                        selectedSheet?.id === sheet.id
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {sheet.studentName || sheet.rollNumber}
                        </p>
                        <StatusBadge tone={sheet.status === 'evaluated' ? 'success' : 'info'}>
                          {sheet.status}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">{sheet.rollNumber}</p>
                    </button>
                  ))}
                </div>
              </Card>

              <div className="space-y-5">
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Sheet photo</p>
                      <h3 className="mt-1 text-sm font-bold text-slate-900">
                        {selectedSheet ? (selectedSheet.studentName || selectedSheet.rollNumber) : 'Select a student'}
                      </h3>
                    </div>
                    {selectedSheet?.fileUrl && (
                      <a href={selectedSheet.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600">
                        Open original
                      </a>
                    )}
                  </div>
                  {!selectedSheet?.fileUrl ? (
                    <p className="mt-4 text-xs text-slate-500">No file stored for this sheet.</p>
                  ) : isPdfSheet(selectedSheet) ? (
                    <iframe
                      src={selectedSheet.fileUrl}
                      title="Answer sheet"
                      className="mt-3 h-96 w-full rounded-xl border border-slate-200 bg-slate-50"
                    />
                  ) : (
                    <img
                      src={selectedSheet.fileUrl}
                      alt="Answer sheet"
                      className="mt-3 max-h-96 w-full rounded-xl border border-slate-200 bg-slate-100 object-contain"
                    />
                  )}
                </Card>

                <Card>
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">Answer key to mark against</h3>
                  </div>
                  {questions.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      This session has no stored questions. Open it from Sessions to load the answer key.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {questions.map((q) => (
                        <div key={q.id || q.questionNumber} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[10px] font-bold uppercase text-slate-500">
                            Q{q.questionNumber} · {q.marks} marks · {q.type}
                          </p>
                          <p className="mt-1 text-xs text-slate-800">{q.questionText}</p>
                          {(q.markingCriteria?.length || q.markingScheme) && (
                            <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                              {(q.markingCriteria?.length
                                ? q.markingCriteria.map((c) => `${c.marks} mark${Number(c.marks) === 1 ? '' : 's'}: ${c.point}`)
                                : [`Scheme: ${q.markingScheme}`]
                              ).map((line) => (
                                <li key={line}>{line}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module2/upload" icon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button
                onClick={() => selectedSheet && handleEvaluate(selectedSheet.id)}
                disabled={!selectedSheet || Boolean(evaluatingId) || questions.length === 0}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                {evaluatingId ? 'Scoring…' : 'Score this student'}
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
