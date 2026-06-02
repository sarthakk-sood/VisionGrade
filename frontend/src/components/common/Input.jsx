import { motion } from 'framer-motion';

export default function Input({ label, helperText, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>}
      <motion.input
        whileFocus={{ scale: 1.01 }}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400/50 focus:bg-white/8"
        {...props}
      />
      {helperText && <span className="mt-2 block text-xs text-slate-400">{helperText}</span>}
    </label>
  );
}
