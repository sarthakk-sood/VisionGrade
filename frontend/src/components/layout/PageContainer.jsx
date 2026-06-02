import { motion } from 'framer-motion';

export default function PageContainer({ title, subtitle, actions, children, className = '' }) {
  return (
    <motion.section
      className={`mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 ${className}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      {(title || subtitle || actions) && (
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            {subtitle && <p className="text-sm uppercase tracking-[0.3em] text-blue-300/80">{subtitle}</p>}
            {title && <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{title}</h1>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      )}
      {children}
    </motion.section>
  );
}
