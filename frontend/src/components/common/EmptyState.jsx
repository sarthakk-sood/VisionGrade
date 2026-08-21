import { motion } from 'framer-motion';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center px-6 py-16 text-center"
    >
      {Icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
