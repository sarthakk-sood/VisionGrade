import { motion } from 'framer-motion';
import { CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import Card from '../common/Card';
import StatusBadge from '../common/StatusBadge';
import Button from '../common/Button';

export default function QuestionCard({ question, onApprove, onRegenerate, onDelete, onChange }) {
  return (
    <motion.div layout>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge tone={question.approved ? 'success' : 'warning'}>{question.type}</StatusBadge>
            <span className="text-sm text-slate-500">{question.marks} marks</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={() => onRegenerate?.(question.id)}>
              Regenerate
            </Button>
            <Button variant="secondary" size="sm" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => onApprove?.(question.id)}>
              Approve
            </Button>
            <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => onDelete?.(question.id)}>
              Delete
            </Button>
          </div>
        </div>
        <textarea
          value={question.text}
          onChange={(event) => onChange?.(question.id, event.target.value)}
          rows={4}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-400/50"
        />
      </Card>
    </motion.div>
  );
}
