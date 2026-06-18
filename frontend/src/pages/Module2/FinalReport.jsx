import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Download, FileText, FileBarChart2, Package,
  ArrowLeft, Plus, BarChart3,
} from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import StatusBadge   from '../../components/common/StatusBadge';
import ProgressBar   from '../../components/common/ProgressBar';
import { useAppStore } from '../../store/useAppStore';
import { PAGE_BG } from '../../utils/theme';


const FORMAT_ICON = { DOCX: FileText, PDF: FileBarChart2, ZIP: Package };
const FORMAT_COLOR = {
  DOCX: 'bg-blue-50 text-blue-600',
  PDF:  'bg-rose-500/15 text-rose-600',
  ZIP:  'bg-emerald-50 text-emerald-700',
};

function ExportButton({ icon: Icon, title, subtitle, to, primary = false }) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.18 }}
      className={[
        'flex cursor-pointer flex-col items-center rounded-2xl border p-5 text-center transition',
        primary
          ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
          : 'border-slate-200 bg-slate-50 hover:bg-white/[0.07]',
      ].join(' ')}
    >
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${primary ? 'bg-blue-500/25' : 'bg-white/[0.07]'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      {to && (
        <Link to={to} className="mt-3 text-xs text-blue-600 transition hover:text-blue-600">
          Proceed →
        </Link>
      )}
    </motion.div>
  );
}

export default function FinalReport() {
  const reports    = useAppStore((s) => s.reports);
  const evaluations = useAppStore((s) => s.evaluations);

  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length * 10) / 10
    : 0;
  const topPerformer = evaluations.reduce((top, e) => (!top || e.score > top.score ? e : top), null);

  const scoreColor = (s) =>
    s >= 80 ? 'text-emerald-700' : s >= 60 ? 'text-amber-700' : 'text-rose-600';

  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="Module 2 / Export" title="Final Report">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">

            {/* ── Success banner ── */}
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] px-5 py-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">Evaluation complete — reports ready for download</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {evaluations.length} students evaluated · DBMS Mid Semester Examination
                </p>
              </div>
              <StatusBadge tone="success" dot pulse className="ml-auto shrink-0">
                Export Ready
              </StatusBadge>
            </div>

            {/* ── Summary row ── */}
            <div className="mb-5 grid grid-cols-3 gap-4">
              {[
                { label: 'Average Score',  value: `${avgScore}%`,                      color: 'text-blue-600'    },
                { label: 'Top Performer',  value: topPerformer?.student ?? '—',         color: 'text-emerald-700' },
                { label: 'Total Evaluated', value: `${evaluations.length} students`,   color: 'text-slate-900'       },
              ].map((s) => (
                <div key={s.label} className="glass-card rounded-2xl border border-slate-200 p-4">
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-2">

              {/* Left — Batch Results */}
              <Card>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Results</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">Batch Score Overview</h3>

                <div className="mt-5 space-y-3">
                  {evaluations.map((ev) => (
                    <div key={ev.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-slate-900">{ev.student}</span>
                          <span className="ml-2 text-[10px] text-slate-600">{ev.rollNo}</span>
                        </div>
                        <span className={`font-black ${scoreColor(ev.score)}`}>{ev.score}%</span>
                      </div>
                      <ProgressBar
                        value={ev.score}
                        showValue={false}
                        height="h-1.5"
                        tone={ev.score >= 80 ? 'emerald' : ev.score >= 60 ? 'amber' : 'rose'}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Right — Download files */}
              <Card>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Downloads</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">Export Files</h3>

                <div className="mt-5 space-y-3">
                  {reports.map((report) => {
                    const Icon = FORMAT_ICON[report.format] ?? FileText;
                    const badgeCls = FORMAT_COLOR[report.format] ?? 'bg-slate-100 text-slate-600';
                    return (
                      <div key={report.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${badgeCls}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">{report.title}</p>
                          <p className="text-[10px] text-slate-500">{report.format} · {report.size}</p>
                        </div>
                        <button className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-white/[0.10]">
                          <Download className="h-3.5 w-3.5" />
                          {report.downloadLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* ── Export action buttons ── */}
            <Card variant="accent" className="mt-5">
              <h3 className="text-sm font-bold text-slate-900">Final Export Options</h3>
              <p className="mt-1 text-xs text-slate-500">Download the complete evaluation package for this exam session.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <ExportButton icon={FileText}      title="Marksheet DOCX"     subtitle="Student-wise report"   />
                <ExportButton icon={FileBarChart2} title="Summary PDF"        subtitle="Batch analysis"        />
                <ExportButton icon={Plus}          title="New Exam Session"   subtitle="Start fresh session" to="/module1/exam-details" primary />
              </div>
            </Card>

            {/* ── Nav ── */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module2/evaluate" icon={<ArrowLeft className="h-4 w-4" />}>
                Back to Results
              </Button>
              <Button to="/dashboard" variant="secondary">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
