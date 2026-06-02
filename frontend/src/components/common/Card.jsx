import { motion } from 'framer-motion';

const variants = {
  default:  'glass-card rounded-[28px] border border-white/8 bg-white/[0.035]',
  elevated: 'glass-card rounded-[28px] border border-white/10 bg-white/[0.05] shadow-glow-sm',
  accent:   'glass-card rounded-[28px] border border-blue-400/25 bg-blue-500/[0.07]',
  danger:   'glass-card rounded-[28px] border border-rose-400/20 bg-rose-500/[0.06]',
  success:  'glass-card rounded-[28px] border border-emerald-400/20 bg-emerald-500/[0.06]',
};

export default function Card({ children, className = '', hover = true, variant = 'default', p = 'p-5' }) {
  const base = variants[variant] || variants.default;
  return (
    <motion.div
      className={`${base} ${p} ${className}`}
      whileHover={hover ? { y: -2, boxShadow: '0 0 28px rgba(59,130,246,0.14), 0 8px 28px rgba(0,0,0,0.35)' } : undefined}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
