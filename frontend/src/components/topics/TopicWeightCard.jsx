import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';

export default function TopicWeightCard({ topics = [] }) {
  const total = topics.reduce((sum, topic) => sum + (topic.weight || 0), 0) || 1;

  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">Distribution</p>
      <h3 className="mt-2 text-xl font-bold text-white">Topic weights</h3>
      <div className="mt-5 space-y-4">
        {topics.map((topic) => (
          <div key={topic.id}>
            <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
              <span>{topic.title}</span>
              <span>{topic.weight}%</span>
            </div>
            <ProgressBar value={Math.round((topic.weight / total) * 100)} />
          </div>
        ))}
      </div>
    </Card>
  );
}
