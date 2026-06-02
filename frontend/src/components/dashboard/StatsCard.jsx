import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Card from '../common/Card';

function AnimatedNumber({ target }) {
  const [display, setDisplay] = useState('0');
  const isNumeric = !isNaN(parseFloat(String(target).replace(/[^0-9.]/g, '')));

  useEffect(() => {
    if (!isNumeric) { setDisplay(target); return; }
    const raw = parseFloat(String(target).replace(/[^0-9.]/g, ''));
    const suffix = String(target).replace(/[0-9.,]/g, '');
    let start = 0;
    const step = raw / 40;
    const timer = setInterval(() => {
      start = Math.min(start + step, raw);
      const formatted = Number.isInteger(raw)
        ? Math.round(start).toLocaleString()
        : start.toFixed(1);
      setDisplay(`${formatted}${suffix}`);
      if (start >= raw) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [target]);

  return <>{display}</>;
}

export default function StatsCard({ label, value, delta, icon: Icon, index = 0 }) {
  const isNegative = delta?.toLowerCase().includes('need') || delta?.toLowerCase().startsWith('-');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="relative overflow-hidden" variant="default">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-br from-blue-500/[0.08] via-transparent to-cyan-400/[0.06]" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight text-white">
              <AnimatedNumber target={value} />
            </h3>
            <p className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${isNegative ? 'text-amber-300' : 'text-emerald-300'}`}>
              {isNegative
                ? <ArrowDownRight className="h-3.5 w-3.5" />
                : <ArrowUpRight   className="h-3.5 w-3.5" />}
              {delta}
            </p>
          </div>

          {Icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
