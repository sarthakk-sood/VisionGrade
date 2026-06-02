import { motion } from 'framer-motion';

const tones = {
  blue:    { bar: 'from-blue-600 to-blue-400',     glow: 'shadow-[0_0_8px_rgba(59,130,246,0.4)]'  },
  emerald: { bar: 'from-emerald-600 to-emerald-400', glow: 'shadow-[0_0_8px_rgba(52,211,153,0.4)]' },
  amber:   { bar: 'from-amber-600 to-amber-400',   glow: 'shadow-[0_0_8px_rgba(245,158,11,0.4)]'  },
  rose:    { bar: 'from-rose-600 to-rose-400',     glow: 'shadow-[0_0_8px_rgba(244,63,94,0.4)]'   },
  purple:  { bar: 'from-purple-600 to-purple-400', glow: 'shadow-[0_0_8px_rgba(168,85,247,0.4)]'  },
};

export default function ProgressBar({
  label,
  value = 0,
  tone = 'blue',
  showValue = true,
  height = 'h-1.5',
}) {
  const t = tones[tone] ?? tones.blue;
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && <span className="text-xs font-medium text-slate-400">{label}</span>}
          {showValue && <span className="text-xs font-semibold tabular-nums text-slate-300">{pct}%</span>}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-white/[0.07] ${height}`}>
        <motion.div
          className={`${height} rounded-full bg-gradient-to-r ${t.bar} ${t.glow}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.75, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
    </div>
  );
}
