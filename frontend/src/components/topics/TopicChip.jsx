import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function TopicChip({ topic, onRemove, onEdit }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100 transition hover:bg-blue-500/15"
    >
      <button type="button" onClick={onEdit} className="text-left">
        {topic}
      </button>
      <button type="button" onClick={onRemove} className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/15">
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}
