import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';

export default function EvaluationSummary({ average = 0, strengths = [], weaknesses = [] }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">Evaluation Summary</p>
      <h3 className="mt-2 text-xl font-bold text-white">Marks and feedback</h3>
      <div className="mt-5 space-y-5">
        <div>
          <ProgressBar label="Overall accuracy" value={average} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-200">Strengths</p>
            <ul className="mt-3 space-y-2 text-sm text-emerald-100/90">
              {strengths.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-200">Weaknesses</p>
            <ul className="mt-3 space-y-2 text-sm text-amber-100/90">
              {weaknesses.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
