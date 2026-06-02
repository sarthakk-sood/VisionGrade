import { motion } from 'framer-motion';
import { CheckCircle2, Download, ScanFace, Plus, BookOpen, Clock3 } from 'lucide-react';
import Card from '../common/Card';

const typeIcon = {
  evaluation: { icon: CheckCircle2, color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
  export:     { icon: Download,     color: 'text-blue-300',    bg: 'bg-blue-500/15'    },
  ocr:        { icon: ScanFace,     color: 'text-purple-300',  bg: 'bg-purple-500/15'  },
  session:    { icon: Plus,         color: 'text-blue-300',    bg: 'bg-blue-500/15'    },
  blueprint:  { icon: BookOpen,     color: 'text-amber-300',   bg: 'bg-amber-500/15'   },
};

export default function ActivityTimeline({ items = [] }) {
  return (
    <Card className="h-full">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-400/70">Recent Activity</p>
          <h3 className="mt-1 text-base font-bold text-white">Timeline</h3>
        </div>
        <Clock3 className="h-4 w-4 text-slate-500" />
      </div>

      <div className="relative space-y-5">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-white/[0.06]" />

        {items.map((item, index) => {
          const { icon: Icon, color, bg } = typeIcon[item.type] ?? typeIcon.session;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06 }}
              className="relative flex gap-3 pl-1"
            >
              {/* Icon dot */}
              <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>

              {/* Content */}
              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-white truncate">{item.title}</h4>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-500">{item.time}</span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.detail}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
