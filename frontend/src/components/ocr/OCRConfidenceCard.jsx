import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';

export default function OCRConfidenceCard({ label, value, tone }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className="text-2xl font-bold text-slate-900">{value}%</span>
      </div>
      <ProgressBar value={value} />
      <div className={`rounded-2xl border px-4 py-3 text-sm ${tone === 'high' ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : tone === 'medium' ? 'border-amber-400/20 bg-amber-500/10 text-amber-200' : 'border-rose-400/20 bg-rose-50 text-rose-200'}`}>
        OCR confidence distribution for this review cluster.
      </div>
    </Card>
  );
}
