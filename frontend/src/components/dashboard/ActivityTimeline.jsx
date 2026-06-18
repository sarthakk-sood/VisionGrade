import { motion } from 'framer-motion';
import { CheckCircle2, Download, ScanFace, Plus, BookOpen, Clock3, Inbox } from 'lucide-react';
import Card from '../common/Card';

const typeIcon = {
  evaluation: { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  export:     { icon: Download,     color: 'text-blue-600',    bg: 'bg-blue-50'    },
  ocr:        { icon: ScanFace,     color: 'text-purple-700',  bg: 'bg-purple-500/15'  },
  session:    { icon: Plus,         color: 'text-blue-600',    bg: 'bg-blue-50'    },
  blueprint:  { icon: BookOpen,     color: 'text-amber-700',   bg: 'bg-amber-50'   },
};

export default function ActivityTimeline({ items = [] }) {
  return (
    <Card className="h-full">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">Recent Activity</p>
          <h3 className="mt-1 text-base font-bold text-slate-900">Timeline</h3>
        </div>
        <Clock3 className="h-4 w-4 text-slate-500" />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Inbox className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-700">No activity yet</p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">
            Finalize an exam session to see your paper generation history here.
          </p>
        </div>
      ) : (
        <div className="relative space-y-5">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-100" />
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
                <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-xs font-semibold text-slate-900">{item.title}</h4>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{item.time}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.detail}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
