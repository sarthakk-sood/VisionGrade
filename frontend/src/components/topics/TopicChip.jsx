import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function TopicChip({ topic, onRemove, onEdit }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
    >
      <button type="button" onClick={onEdit} className="text-left">
        {topic}
      </button>
      <button type="button" onClick={onRemove} className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-slate-900/70 transition hover:bg-white/15">
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}
