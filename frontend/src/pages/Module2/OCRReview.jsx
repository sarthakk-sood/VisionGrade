import { motion } from 'framer-motion';
import { ScanFace, GitMerge, BrainCircuit, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import ProgressBar   from '../../components/common/ProgressBar';
import StatusBadge   from '../../components/common/StatusBadge';
import { useAppStore } from '../../store/useAppStore';
import { PAGE_BG } from '../../utils/theme';

const M2_STEPS = ['Select Exam', 'Upload Sheets', 'Processing', 'Review Flags', 'Results'];

const stages = [
  { label: 'OCR Completed',        value: '32 / 32',    pct: 100, icon: ScanFace,       tone: 'success' },
  { label: 'Questions Mapped',     value: '544 / 544',  pct: 100, icon: GitMerge,       tone: 'success' },
  { label: 'Evaluation Progress',  value: '28 / 32',    pct: 87,  icon: BrainCircuit,   tone: 'info'    },
  { label: 'Flagged Responses',    value: '7 responses', pct: null, icon: AlertTriangle, tone: 'warning' },
];

const confidenceTone = { High: 'success', Medium: 'warning', Low: 'danger' };

export default function OCRReview() {
  const ocrResults = useAppStore((s) => s.ocrResults);

  const lowConf = ocrResults.filter((r) => r.confidence < 80);

  const confColor = (c) =>
    c >= 90 ? 'text-emerald-700' : c >= 70 ? 'text-amber-700' : 'text-rose-600';

  const confBadge = (s) =>
    s === 'High' ? 'bg-emerald-50 text-emerald-700' : s === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-rose-500/15 text-rose-600';

  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="Module 2 / Step 3" title="Processing Dashboard">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M2_STEPS} currentStep={3} />

            {/* ── Processing Stage Cards ── */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stages.map((stage, i) => {
                const Icon = stage.icon;
                const iconBg = {
                  success: 'bg-emerald-50 text-emerald-700',
                  info:    'bg-blue-50    text-blue-600',
                  warning: 'bg-amber-50   text-amber-700',
                }[stage.tone] ?? 'bg-white/[0.07] text-slate-600';

                return (
                  <motion.div
                    key={stage.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="glass-card rounded-2xl border border-slate-200 p-4"
                  >
                    <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xl font-black text-slate-900">{stage.value}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{stage.label}</p>
                    {stage.pct !== null && (
                      <div className="mt-3">
                        <ProgressBar value={stage.pct} tone={stage.tone === 'success' ? 'emerald' : stage.tone === 'info' ? 'blue' : 'amber'} showValue={false} height="h-1" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* ── Low confidence flags ── */}
            {lowConf.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <p className="text-sm font-semibold text-slate-900">Low Confidence Regions ({lowConf.length})</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {lowConf.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">{r.question}</span>
                        <span className={`text-sm font-black ${confColor(r.confidence)}`}>{r.confidence}%</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">{r.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Full OCR Results Table ── */}
            <Card p="p-0" hover={false} className="mt-5">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">OCR Results</p>
                <h3 className="mt-0.5 text-sm font-bold text-slate-900">All Extracted Answers</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Question</th>
                      <th className="px-4 py-3 font-semibold">Confidence</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Extracted Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocrResults.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 transition hover:bg-slate-50">
                        <td className="px-5 py-4 font-bold text-slate-900">{r.question}</td>
                        <td className={`px-4 py-4 text-lg font-black ${confColor(r.confidence)}`}>{r.confidence}%</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${confBadge(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 max-w-xs text-slate-500 leading-5">{r.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Actions ── */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module2/upload" icon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button to="/module2/mapping" icon={<ArrowRight className="h-4 w-4" />}>
                Review Flags
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
