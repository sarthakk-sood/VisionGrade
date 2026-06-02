import StatusBadge from '../common/StatusBadge';
import Card from '../common/Card';
import LowConfidenceFlag from './LowConfidenceFlag';

export default function ConfidenceReviewTable({ results = [] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">Confidence Review</p>
        <h3 className="mt-2 text-xl font-bold text-white">Editable OCR output</h3>
      </div>
      <div className="divide-y divide-white/10">
        {results.map((result) => (
          <div key={result.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[140px,120px,1fr,auto] lg:items-center">
            <div>
              <p className="font-semibold text-white">{result.question}</p>
              <LowConfidenceFlag confidence={result.confidence} />
            </div>
            <StatusBadge tone={result.status === 'High' ? 'success' : result.status === 'Medium' ? 'warning' : 'danger'}>{result.status}</StatusBadge>
            <textarea defaultValue={result.text} rows={3} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
            <button className="justify-self-start rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/15">Save</button>
          </div>
        ))}
      </div>
    </Card>
  );
}
