import { motion } from 'framer-motion';

const styles = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  warning: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  danger:  'bg-rose-50   text-rose-700   ring-1 ring-rose-200',
  info:    'bg-blue-50   text-blue-700   ring-1 ring-blue-200',
  neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  purple:  'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
};

const dotStyles = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-rose-500',
  info:    'bg-blue-500',
  neutral: 'bg-slate-400',
  purple:  'bg-purple-500',
};

export default function StatusBadge({ children, tone = 'neutral', dot = false, pulse = false, className = '' }) {
  const s = styles[tone] ?? styles.neutral;
  const d = dotStyles[tone] ?? dotStyles.neutral;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-semibold ${s} ${className}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${d} ${pulse ? 'pulse-dot' : ''}`} />
      )}
      {children}
    </motion.span>
  );
}
