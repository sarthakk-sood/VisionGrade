import Card from '../common/Card';
import StatusBadge from '../common/StatusBadge';

export default function StudentCard({ student }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">Student</p>
          <h3 className="mt-2 text-2xl font-bold text-white">{student.student}</h3>
          <p className="mt-1 text-sm text-slate-400">{student.rollNo}</p>
        </div>
        <StatusBadge tone={student.status === 'Completed' ? 'success' : 'warning'}>{student.status}</StatusBadge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Score</p>
          <p className="mt-2 text-3xl font-bold text-white">{student.score}%</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Status</p>
          <p className="mt-2 text-lg font-semibold text-blue-200">AI Evaluated</p>
        </div>
      </div>
    </Card>
  );
}
