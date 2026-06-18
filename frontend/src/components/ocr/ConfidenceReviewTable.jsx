import StatusBadge from '../common/StatusBadge';
import Card from '../common/Card';
import LowConfidenceFlag from './LowConfidenceFlag';

export default function ConfidenceReviewTable({ results = [] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.3em] text-blue-600">Confidence Review</p>
        <h3 className="mt-2 text-xl font-bold text-slate-900">Editable OCR output</h3>
      </div>
      <div className="divide-y divide-white/10">
        {results.map((result) => (
          <div key={result.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[140px,120px,1fr,auto] lg:items-center">
            <div>
              <p className="font-semibold text-slate-900">{result.question}</p>
              <LowConfidenceFlag confidence={result.confidence} />
            </div>
            <StatusBadge tone={result.status === 'High' ? 'success' : result.status === 'Medium' ? 'warning' : 'danger'}>{result.status}</StatusBadge>
            <textarea defaultValue={result.text} rows={3} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none" />
            <button className="justify-self-start rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">Save</button>
          </div>
        ))}
      </div>
    </Card>
  );
}
