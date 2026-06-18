import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function Stepper({ steps = [], currentStep = 1 }) {
  return (
    <div className="mb-8 w-full pb-6">
      <div className="flex items-center">
        {steps.map((label, index) => {
          const num        = index + 1;
          const completed  = num < currentStep;
          const active     = num === currentStep;
          const upcoming   = num > currentStep;

          return (
            <div key={label} className="flex flex-1 items-center">
              <div className="relative flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0.75, opacity: 0 }}
                  animate={{ scale: 1,    opacity: 1 }}
                  transition={{ delay: index * 0.06, duration: 0.3 }}
                  className={[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                    completed ? 'bg-blue-600 text-white shadow-sm' : '',
                    active    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200 ring-offset-2 ring-offset-white' : '',
                    upcoming  ? 'border border-slate-300 bg-white text-slate-500' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {completed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : num}
                </motion.div>

                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 + 0.12 }}
                  className={[
                    'absolute top-10 hidden whitespace-nowrap text-[10px] font-medium md:block',
                    active    ? 'text-blue-600'   : '',
                    completed ? 'text-slate-500'  : '',
                    upcoming  ? 'text-slate-500'  : '',
                  ].filter(Boolean).join(' ')}
                >
                  {label}
                </motion.span>
              </div>

              {index < steps.length - 1 && (
                <div className="relative mx-1 flex-1 overflow-hidden rounded-full">
                  <div className="h-px bg-slate-200" />
                  {completed && (
                    <motion.div
                      className="absolute inset-y-0 left-0 h-px bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.35, delay: index * 0.06 }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
