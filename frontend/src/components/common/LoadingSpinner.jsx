import { motion } from 'framer-motion';

export default function LoadingSpinner({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-300">
      <motion.div
        className="h-10 w-10 rounded-full border-2 border-white/10 border-t-blue-400"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
      />
      <p className="text-sm">{label}</p>
    </div>
  );
}
