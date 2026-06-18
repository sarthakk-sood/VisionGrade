import Card from '../common/Card';
import Button from '../common/Button';
import StatusBadge from '../common/StatusBadge';

export default function QuestionReviewPanel({ questions = [] }) {
  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-600">Review Panel</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">Question quality</h3>
        </div>
        <StatusBadge tone="info">{questions.filter((item) => item.approved).length} approved</StatusBadge>
      </div>
      <div className="space-y-3">
        {questions.map((question) => (
          <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{question.type} · {question.marks} marks</p>
                <p className="mt-1 text-sm text-slate-500">{question.text}</p>
              </div>
              <StatusBadge tone={question.approved ? 'success' : 'warning'}>{question.approved ? 'Approved' : 'Pending'}</StatusBadge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm">Edit</Button>
              <Button variant="ghost" size="sm">Regenerate</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
