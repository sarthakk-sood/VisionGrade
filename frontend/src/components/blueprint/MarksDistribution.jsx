import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';

export default function MarksDistribution({ blueprint }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">Marks</p>
      <h3 className="mt-2 text-xl font-bold text-white">Distribution overview</h3>
      <div className="mt-5 space-y-5">
        <ProgressBar label="Easy" value={blueprint.difficultySplit?.easy || 0} />
        <ProgressBar label="Medium" value={blueprint.difficultySplit?.medium || 0} />
        <ProgressBar label="Hard" value={blueprint.difficultySplit?.hard || 0} />
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        Total marks: <span className="font-semibold text-white">{blueprint.totalMarks}</span>
      </div>
    </Card>
  );
}
