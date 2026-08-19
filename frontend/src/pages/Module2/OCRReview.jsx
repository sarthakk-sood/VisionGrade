/**
 * OCRReview.jsx — Module 2, Step 3
 *
 * Displays the TrOCR extraction result passed via React Router location state
 * from UploadAnswerSheet after a successful /api/ocr/extract call.
 *
 * Features:
 *  - Summary cards: total pages, avg confidence, low-confidence pages
 *  - Warning banner when avgConfidence < 70 % (isLowConfidence flag)
 *  - Per-page accordion: full extracted text + per-line confidence inline
 *  - Low-confidence lines are highlighted in amber within each expanded page
 *  - Copyable full-text textarea (all pages concatenated)
 *  - "Continue to Mapping" CTA (links to /module2/mapping)
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanFace, FileText, AlertTriangle, ArrowRight, ArrowLeft,
  ClipboardCopy, CheckCircle2, ChevronDown, ChevronUp,
  ShieldAlert, List,
} from 'lucide-react';

import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import ProgressBar   from '../../components/common/ProgressBar';
import StatusBadge   from '../../components/common/StatusBadge';
import EmptyState    from '../../components/common/EmptyState';
import { PAGE_BG }   from '../../utils/theme';
import { useAppStore } from '../../store/useAppStore';
import { ocrApi } from '../../services/api';

const M2_STEPS = ['Select Exam', 'Upload Sheets', 'Processing', 'Review Flags', 'Results'];

// ── Helpers ────────────────────────────────────────────────────────────────────
const confTone = (c) =>
  c >= 85 ? 'success' : c >= 70 ? 'warning' : 'danger';

const confText = (c) =>
  c >= 85 ? 'text-emerald-700' : c >= 70 ? 'text-amber-600' : 'text-rose-600';

const confBar = (c) =>
  c >= 85 ? 'emerald' : c >= 70 ? 'amber' : 'rose';

const confBg = (c) =>
  c >= 85 ? 'bg-emerald-50' : c >= 70 ? 'bg-amber-50' : 'bg-rose-50';

export default function OCRReview() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentAnswerSheetId = useAppStore((s) => s.currentAnswerSheetId);
  const setCurrentAnswerSheet = useAppStore((s) => s.setCurrentAnswerSheet);

  const [ocrData, setOcrData] = useState(location.state?.ocrData ?? null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(!location.state?.ocrData);

  useEffect(() => {
    const sheetId = location.state?.ocrData?.answerSheetId
      || location.state?.sheetId
      || currentAnswerSheetId;
    if (location.state?.ocrData) {
      if (location.state.ocrData.answerSheetId) {
        setCurrentAnswerSheet(location.state.ocrData.answerSheetId);
      }
      setLoading(false);
      return;
    }
    if (!sheetId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    ocrApi.get(sheetId)
      .then((resp) => {
        if (cancelled) return;
        const sheet = resp.data;
        setCurrentAnswerSheet(sheet._id || sheetId);
        setOcrData({
          answerSheetId: sheet._id,
          rollNumber: sheet.rollNumber,
          studentName: sheet.studentName,
          sessionId: sheet.sessionId,
          fileUrl: sheet.fileUrl,
          totalPages: sheet.pageCount || sheet.pages?.length || 0,
          avgConfidence: sheet.ocrConfidence,
          lowConfidencePages: (sheet.pages || [])
            .filter((p) => p.confidence < 70)
            .map((p) => p.pageNumber),
          isLowConfidence: sheet.isFlaggedForReview,
          pages: sheet.pages || [],
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.response?.data?.error || 'Could not load OCR result.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [location.state, currentAnswerSheetId, setCurrentAnswerSheet]);

  const [expandedPage, setExpandedPage] = useState(null);
  const [showLines, setShowLines]       = useState({});
  const [copied, setCopied]             = useState(false);
  const [editText, setEditText]         = useState('');
  const [savingText, setSavingText]     = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');

  useEffect(() => {
    if (!ocrData?.pages) return;
    const text = (ocrData.pages || [])
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
      .join('\n\n');
    setEditText(text);
  }, [ocrData]);

  if (loading) {
    return (
      <div className={PAGE_BG}>
        <Navbar />
        <PageContainer subtitle="Module 2 / Step 3" title="Processing Dashboard">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <Stepper steps={M2_STEPS} currentStep={3} />
              <EmptyState icon={FileText} title="Loading OCR results…" description="Fetching the stored extraction for this answer sheet." />
            </div>
          </div>
        </PageContainer>
      </div>
    );
  }

  if (!ocrData) {
    return (
      <div className={PAGE_BG}>
        <Navbar />
        <PageContainer subtitle="Module 2 / Step 3" title="Processing Dashboard">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <Stepper steps={M2_STEPS} currentStep={3} />
              <EmptyState
                icon={FileText}
                title="No OCR results found"
                description={loadError || 'Upload an answer sheet PDF first to see extraction results here.'}
                action={
                  <Button onClick={() => navigate('/module2/upload')}>
                    Go to Upload
                  </Button>
                }
              />
            </div>
          </div>
        </PageContainer>
      </div>
    );
  }

  const {
    rollNumber, studentName, totalPages,
    avgConfidence, lowConfidencePages = [],
    isLowConfidence, pages = [],
  } = ocrData;

  // Full text for copy / correct-before-marking
  const fullText = pages
    .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
    .join('\n\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(editText || fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveText = async () => {
    if (!ocrData?.answerSheetId) return;
    setSavingText(true);
    setSaveMsg('');
    try {
      await ocrApi.updateText(ocrData.answerSheetId, { ocrRawText: editText });
      setSaveMsg('Saved. Scoring will use this corrected text.');
    } catch (err) {
      setSaveMsg(err?.response?.data?.error || err.message || 'Could not save text');
    } finally {
      setSavingText(false);
    }
  };

  const togglePage = (num) =>
    setExpandedPage((prev) => (prev === num ? null : num));

  const toggleLines = (num) =>
    setShowLines((prev) => ({ ...prev, [num]: !prev[num] }));

  // ── Summary cards ─────────────────────────────────────────────────────────────
  const summaryCards = [
    {
      label: 'Total Pages',
      value: String(totalPages),
      icon: FileText,
      tone: 'info',
    },
    {
      label: 'Avg. Confidence',
      value: `${avgConfidence}%`,
      icon: ScanFace,
      tone: confTone(avgConfidence),
    },
    {
      label: 'Low-Conf Pages',
      value: String(lowConfidencePages.length),
      icon: AlertTriangle,
      tone: lowConfidencePages.length ? 'warning' : 'success',
    },
  ];

  const cardIconBg = {
    success: 'bg-emerald-50 text-emerald-700',
    info:    'bg-blue-50 text-blue-600',
    warning: 'bg-amber-50 text-amber-700',
    danger:  'bg-rose-50 text-rose-600',
  };

  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="Module 2 / Step 3" title="Processing Dashboard">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M2_STEPS} currentStep={3} />

            {/* ── Low-confidence warning banner ── */}
            <AnimatePresence>
              {isLowConfidence && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4"
                >
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Low recognition confidence ({avgConfidence}%)
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-700">
                      TrOCR ({' '}
                      <code className="rounded bg-amber-100 px-1 text-[10px]">
                        microsoft/trocr-base-handwritten
                      </code>
                      {' '}) is optimised for clean, well-lit handwritten text.
                      Camera-photographed sheets with glare, skew, or faint ink will score lower.
                      Lines highlighted in amber below need manual review before evaluation.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Student chip ── */}
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
                <ScanFace className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">
                  {studentName || 'Student'} · Roll #{rollNumber}
                </p>
                <p className="text-[10px] text-slate-500">
                  TrOCR extraction complete · {totalPages} page{totalPages !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <StatusBadge tone={confTone(avgConfidence)} dot>
                  {avgConfidence}% avg confidence
                </StatusBadge>
                {isLowConfidence && (
                  <StatusBadge tone="warning" dot>Flagged for review</StatusBadge>
                )}
              </div>
            </div>

            {/* ── Summary cards ── */}
            <div className="grid gap-4 sm:grid-cols-3">
              {summaryCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="glass-card rounded-2xl border border-slate-200 p-4"
                  >
                    <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${cardIconBg[card.tone] ?? 'bg-slate-50 text-slate-500'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-black text-slate-900">{card.value}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{card.label}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Per-page accordion ── */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Extracted Text — Page by Page
                </h3>
                <span className="text-[10px] text-slate-500">Click a page to expand</span>
              </div>

              {pages.map((page, i) => {
                const isExpanded = expandedPage === page.pageNumber;
                const isLowPage  = lowConfidencePages.includes(page.pageNumber);
                const linesVisible = showLines[page.pageNumber];

                return (
                  <motion.div
                    key={page.pageNumber}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={[
                      'overflow-hidden rounded-2xl border transition-colors',
                      isLowPage
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200 bg-white',
                    ].join(' ')}
                  >
                    {/* Page header — always visible */}
                    <button
                      type="button"
                      onClick={() => togglePage(page.pageNumber)}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 text-xs font-black">
                        {page.pageNumber}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          Page {page.pageNumber}
                          {isLowPage && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                              <AlertTriangle className="h-2.5 w-2.5" /> Low confidence
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400">
                          {page.lines?.length ?? 0} line{page.lines?.length !== 1 ? 's' : ''} ·{' '}
                          {page.text
                            ? page.text.slice(0, 80) + (page.text.length > 80 ? '…' : '')
                            : '(no text extracted)'}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="hidden w-20 sm:block">
                          <ProgressBar
                            value={page.confidence}
                            tone={confBar(page.confidence)}
                            showValue={false}
                            height="h-1"
                          />
                        </div>
                        <span className={`text-sm font-black ${confText(page.confidence)}`}>
                          {page.confidence}%
                        </span>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-slate-400" />
                          : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </button>

                    {/* Expanded content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">

                            {/* Page full text */}
                            {page.text ? (
                              <pre className="whitespace-pre-wrap rounded-xl bg-slate-900 p-4 text-xs leading-6 text-slate-100 font-mono overflow-x-auto">
                                {page.text}
                              </pre>
                            ) : (
                              <p className="text-xs italic text-slate-400">
                                No text was extracted from this page.
                              </p>
                            )}

                            {/* Per-line confidence breakdown (stretch feature) */}
                            {page.lines && page.lines.length > 0 && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => toggleLines(page.pageNumber)}
                                  className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                  <List className="h-3 w-3" />
                                  {linesVisible ? 'Hide' : 'Show'} per-line confidence
                                  ({page.lines.length} lines)
                                </button>

                                <AnimatePresence>
                                  {linesVisible && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden mt-2 space-y-1.5"
                                    >
                                      {page.lines.map((line) => (
                                        <div
                                          key={line.lineNumber}
                                          className={`flex items-start gap-3 rounded-xl px-3 py-2 text-xs ${
                                            line.confidence < 70
                                              ? 'bg-amber-50 border border-amber-200'
                                              : 'bg-slate-50'
                                          }`}
                                        >
                                          <span className="shrink-0 w-5 text-center text-[9px] font-bold text-slate-400 mt-px">
                                            {line.lineNumber}
                                          </span>
                                          <span className="flex-1 text-slate-700 leading-5 break-words">
                                            {line.text || <em className="text-slate-400">(empty)</em>}
                                          </span>
                                          <span className={`shrink-0 font-black text-sm ${confText(line.confidence)}`}>
                                            {line.confidence}%
                                          </span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Full extracted text + copy ── */}
            <Card className="mt-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                    Full Extraction
                  </p>
                  <h3 className="mt-0.5 text-sm font-bold text-slate-900">
                    Complete Extracted Text
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {copied ? (
                    <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Copied!</>
                  ) : (
                    <><ClipboardCopy className="h-3.5 w-3.5" /> Copy All</>
                  )}
                </button>
              </div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={12}
                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 font-mono text-xs leading-6 text-slate-100 focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[10px] text-slate-400">
                  Correct the text so each answer sits under Q1, Q2, … then save before scoring.
                  {ocrData.fileUrl && (
                    <>
                      {' '}
                      <a href={ocrData.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold">
                        Open original file
                      </a>
                    </>
                  )}
                </p>
                <Button type="button" onClick={handleSaveText} loading={savingText}>
                  Save OCR text
                </Button>
              </div>
              {saveMsg && <p className="mt-2 text-[11px] text-slate-600">{saveMsg}</p>}
            </Card>

            {/* ── Actions ── */}
            <div className="mt-5 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => navigate('/module2/upload')}
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                Back
              </Button>
              <Button
                to="/module2/mapping"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Continue to Mapping
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
