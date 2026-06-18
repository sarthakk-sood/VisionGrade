import { motion } from 'framer-motion';

export default function Input({ label, helperText, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>}
      <motion.input
        whileFocus={{ scale: 1.005 }}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        {...props}
      />
      {helperText && <span className="mt-2 block text-xs text-slate-500">{helperText}</span>}
    </label>
  );
}
