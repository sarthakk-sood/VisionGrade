import { motion } from 'framer-motion';

const variants = {
  default:  'glass-card rounded-2xl',
  elevated: 'glass-card rounded-2xl shadow-md',
  accent:   'rounded-2xl border border-blue-200 bg-blue-50/50 shadow-sm',
  danger:   'rounded-2xl border border-rose-200 bg-rose-50/50 shadow-sm',
  success:  'rounded-2xl border border-emerald-200 bg-emerald-50/50 shadow-sm',
};

export default function Card({ children, className = '', hover = true, variant = 'default', p = 'p-5' }) {
  const base = variants[variant] || variants.default;
  return (
    <motion.div
      className={`${base} ${p} ${className}`}
      whileHover={hover ? { y: -1, boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)' } : undefined}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
