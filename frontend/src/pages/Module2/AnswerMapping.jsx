import { motion } from 'framer-motion';
import { User, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import StatusBadge   from '../../components/common/StatusBadge';
import ProgressBar   from '../../components/common/ProgressBar';
import { useAppStore } from '../../store/useAppStore';
import { PAGE_BG } from '../../utils/theme';

const M2_STEPS = ['Select Exam', 'Upload Sheets', 'Processing', 'Review Flags', 'Results'];

const CONFIDENCE_CLS = {
  High:   'bg-emerald-500/20 text-emerald-700',
  Medium: 'bg-amber-500/20  text-amber-700',
  Low:    'bg-rose-500/20   text-rose-600',
};

const REASON_COUNTS = [
  { reason: 'Bad Handwriting',           count: 3 },
  { reason: 'OCR Confidence Low',        count: 2 },
  { reason: 'Answer Partially Visible',  count: 1 },
  { reason: 'Question Mapping Uncertain', count: 2 },
];

const STUDENT_DATA = {
  'CS2026-021': { totalMarks: 100, score: 73 },
  'CS2026-052': { totalMarks: 100, score: 65 },
  'CS2026-014': { totalMarks: 100, score: 86 },
};

export default function AnswerMapping() {
  const getFlagsForSession = useAppStore((s) => s.getFlagsForSession);
  const flags = getFlagsForSession('ES-2026-001');

  // Group by student
  const groupedByStudent = flags.reduce((acc, flag) => {
    const key = flag.rollNo;
    if (!acc[key]) acc[key] = { studentName: flag.studentName, rollNo: flag.rollNo, flags: [] };
    acc[key].flags.push(flag);
    return acc;
  }, {});

  const studentGroups = Object.values(groupedByStudent);
  const totalFlags    = flags.length;
  const lowCount      = flags.filter((f) => f.confidence === 'Low').length;
  const studentsAffected = studentGroups.length;

  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="Module 2 / Step 4" title="Review Flagged Responses">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M2_STEPS} currentStep={4} />

            {/* ── Summary bar ── */}
            <div className="mb-5 grid grid-cols-3 gap-4">
              {[
                { label: 'Total Flags',       value: totalFlags,       border: 'border-rose-400/20',   bg: 'bg-rose-500/[0.08]'  },
                { label: 'Low Confidence',    value: lowCount,         border: 'border-amber-400/20',  bg: 'bg-amber-500/[0.08]' },
                { label: 'Students Affected', value: studentsAffected, border: 'border-blue-200',   bg: 'bg-blue-500/[0.08]'  },
              ].map((stat) => (
                <div key={stat.label} className={`rounded-2xl border ${stat.border} ${stat.bg} p-4 text-center`}>
                  <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">

              {/* ── Left: Flags grouped by student ── */}
              <div className="space-y-5">
                {studentGroups.map((group, gi) => {
                  const sd = STUDENT_DATA[group.rollNo] ?? { totalMarks: 100, score: 0 };
                  return (
                    <motion.div
                      key={group.rollNo}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: gi * 0.07 }}
                    >
                      <Card>
                        {/* Student header */}
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-sm font-black">
                            {group.studentName[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{group.studentName}</p>
                            <p className="text-xs text-slate-500">
                              {group.rollNo} · Score: {sd.score}/{sd.totalMarks}
                            </p>
                          </div>
                          <StatusBadge tone="warning" className="ml-auto shrink-0">Flagged</StatusBadge>
                        </div>

                        {/* Flag cards */}
                        <div className="space-y-3">
                          {group.flags.map((flag) => (
                            <div key={flag.id} className="rounded-2xl border border-slate-100 bg-white/[0.03] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900">{flag.questionNo}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CONFIDENCE_CLS[flag.confidence] ?? ''}`}>
                                      {flag.confidence}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs font-medium text-slate-600">{flag.reason}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-2xl font-black text-slate-900">{flag.confidenceScore}%</p>
                                  <p className="text-[9px] text-slate-600">confidence</p>
                                </div>
                              </div>
                              <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
                                {flag.ocrText}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-white/[0.10]">
                                  View Original
                                </button>
                                <button className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-50">
                                  Accept OCR
                                </button>
                                <button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-600 transition hover:bg-blue-50">
                                  Override Score
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* ── Right: Reason breakdown ── */}
              <div className="space-y-5">
                <Card className="sticky top-24">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Analysis</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">Flag Reason Breakdown</h3>

                  <div className="mt-5 space-y-4">
                    {REASON_COUNTS.map((item, i) => {
                      const pct = Math.round((item.count / totalFlags) * 100);
                      const tones = ['rose', 'amber', 'blue', 'purple'];
                      return (
                        <div key={item.reason}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-slate-500">{item.reason}</span>
                            <span className="font-bold text-slate-900">{item.count}</span>
                          </div>
                          <ProgressBar value={pct} showValue={false} tone={tones[i % tones.length]} height="h-1" />
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Total flags reviewed</span>
                      <span className="font-bold text-slate-900">0 / {totalFlags}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Accepted OCR</span>
                      <span className="font-bold text-slate-900">0</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Overridden</span>
                      <span className="font-bold text-slate-900">0</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module2/ocr" icon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button to="/module2/evaluate" icon={<ArrowRight className="h-4 w-4" />}>
                Proceed to Results
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
