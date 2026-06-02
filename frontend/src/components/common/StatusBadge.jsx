import { motion } from 'framer-motion';

const styles = {
  success: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25',
  warning: 'bg-amber-500/15  text-amber-300  ring-1 ring-amber-400/25',
  danger:  'bg-rose-500/15   text-rose-300   ring-1 ring-rose-400/25',
  info:    'bg-blue-500/15   text-blue-300   ring-1 ring-blue-400/25',
  neutral: 'bg-white/[0.08]  text-slate-300  ring-1 ring-white/10',
  purple:  'bg-purple-500/15 text-purple-300 ring-1 ring-purple-400/25',
};

const dotStyles = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger:  'bg-rose-400',
  info:    'bg-blue-400',
  neutral: 'bg-slate-400',
  purple:  'bg-purple-400',
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
