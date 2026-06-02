import Card from '../common/Card';

export default function FeedbackPanel({ feedback = '' }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">AI Feedback</p>
      <h3 className="mt-2 text-xl font-bold text-white">Narrative remarks</h3>
      <p className="mt-4 text-sm leading-7 text-slate-300">{feedback}</p>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
        Suggested improvement: clarify section headings and annotate each answer with keyword references for stronger score recovery.
      </div>
    </Card>
  );
}
