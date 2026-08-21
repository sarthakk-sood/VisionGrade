import Card from '../common/Card';

export default function FeedbackPanel({ feedback = '' }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.3em] text-blue-600">AI Feedback</p>
      <h3 className="mt-2 text-xl font-bold text-slate-900">Narrative remarks</h3>
      <p className="mt-4 text-sm leading-7 text-slate-600">{feedback}</p>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Suggested improvement: clarify section headings and annotate each answer with keyword references for stronger score recovery.
      </div>
    </Card>
  );
}
