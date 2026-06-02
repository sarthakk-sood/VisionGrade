import Card from '../common/Card';
import StatusBadge from '../common/StatusBadge';

export default function ReportCard({ report }) {
  return (
    <Card className="flex items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">{report.title}</h3>
          <StatusBadge tone="info">{report.format}</StatusBadge>
        </div>
        <p className="mt-2 text-sm text-slate-400">{report.size}</p>
      </div>
      <button className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/15">{report.downloadLabel}</button>
    </Card>
  );
}
