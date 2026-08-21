import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, UploadCloud,
  PieChart, BrainCircuit, FileEdit, Download, Home, FileText,
  ScanLine, AlertTriangle, BarChart3, FileBarChart2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import StatusBadge from '../common/StatusBadge';

const STATUS_TONE = {
  Generated: 'info',
  Exported: 'success',
  Evaluated: 'success',
  Evaluating: 'warning',
  Draft: 'neutral',
};

const sections = [
  {
    heading: 'Overview',
    items: [
      { label: 'Home',           to: '/dashboard',            icon: Home },
      { label: 'Dashboard',      to: '/dashboard',            icon: LayoutDashboard },
      { label: 'Sessions',       to: '/sessions',             icon: FileText },
    ],
  },
  {
    heading: 'Module 1 — Generate',
    items: [
      { label: 'Exam Details',        to: '/module1/exam-details', icon: ClipboardList  },
      { label: 'Upload PDFs',          to: '/module1/upload',       icon: UploadCloud    },
      { label: 'Topics & Weightage',   to: '/module1/topics',       icon: PieChart       },
      { label: 'Generate Questions',   to: '/module1/generate',     icon: BrainCircuit   },
      { label: 'Review Questions',     to: '/module1/review',       icon: FileEdit       },
      { label: 'Export',               to: '/module1/blueprint',    icon: Download       },
    ],
  },
  {
    heading: 'Module 2 — Evaluate',
    items: [
      { label: 'Upload Sheets',   to: '/module2/upload',   icon: ScanLine      },
      { label: 'Review',          to: '/module2/mapping',  icon: AlertTriangle },
      { label: 'Results',         to: '/module2/evaluate', icon: BarChart3     },
      { label: 'Final Report',    to: '/module2/report',   icon: FileBarChart2 },
    ],
  },
];

export default function Sidebar() {
  const examSessions = useAppStore((s) => s.examSessions);
  const activeSession = examSessions[0];

  return (
    <motion.aside
      className="glass-card hidden h-full min-h-[calc(100vh-5rem)] w-60 shrink-0 rounded-[24px] p-3 lg:block"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x:   0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {activeSession && (
        <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-blue-600">Active Session</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-900">{activeSession.examName}</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">{activeSession.subject}</p>
          <div className="mt-2">
            <StatusBadge tone={STATUS_TONE[activeSession.status] ?? 'neutral'} dot pulse={activeSession.status === 'Evaluating'}>
              {activeSession.status}
            </StatusBadge>
          </div>
        </div>
      )}

      <nav className="space-y-4">
        {sections.map((section) => (
          <div key={section.heading}>
            <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">
              {section.heading}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200',
                        isActive
                          ? 'bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.2)]'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      ].join(' ')
                    }
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </motion.aside>
  );
}
