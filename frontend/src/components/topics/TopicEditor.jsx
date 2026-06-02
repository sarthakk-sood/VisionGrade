import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import TopicChip from './TopicChip';

export default function TopicEditor({ topics = [], onAdd, onEdit, onRemove }) {
  return (
    <Card>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">AI Topics</p>
          <h3 className="mt-2 text-2xl font-bold text-white">Detected topics</h3>
        </div>
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />}>Add topic</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr,220px]">
        <Input label="Add or edit topic" placeholder="e.g. Transaction Recovery" />
        <Input label="Weight" type="number" placeholder="12" />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {topics.map((topic) => (
          <motion.div key={topic.id} layout>
            <TopicChip topic={topic.title || topic} onRemove={() => onRemove?.(topic.id)} onEdit={() => onEdit?.(topic.id)} />
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
