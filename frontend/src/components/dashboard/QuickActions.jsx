import { motion } from 'framer-motion';
import { FileText, ScanLine, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const cards = [
  {
    icon: FileText,
    title: 'Generate Question Paper',
    description:
      'Create a new exam session, upload syllabus PDFs, configure topic weightages, and generate an AI-powered question paper with full faculty control.',
    to: '/module1/exam-details',
    gradient: 'from-blue-500/[0.10] to-cyan-400/[0.05]',
    border: 'border-blue-400/15',
    badge: 'Module 1',
    badgeTone: 'bg-blue-500/20 text-blue-300',
  },
  {
    icon: ScanLine,
    title: 'Evaluate Answer Sheets',
    description:
      'Select an existing exam session, upload student answer sheets for OCR processing, review flagged responses, and generate detailed evaluation reports.',
    to: '/module2/upload',
    gradient: 'from-purple-500/[0.08] to-blue-400/[0.05]',
    border: 'border-purple-400/15',
    badge: 'Module 2',
    badgeTone: 'bg-purple-500/20 text-purple-300',
  },
];

export default function QuickActions() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4 }}
            whileHover={{ y: -3, boxShadow: '0 0 28px rgba(59,130,246,0.14), 0 8px 28px rgba(0,0,0,0.35)' }}
            className={`glass-card relative overflow-hidden rounded-[24px] border ${card.border} p-6 cursor-pointer`}
          >
            {/* Background gradient */}
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.gradient}`} />

            <div className="relative">
              {/* Badge + Icon row */}
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.25em] ${card.badgeTone}`}>
                  {card.badge}
                </span>
              </div>

              {/* Title + Description */}
              <h3 className="mt-4 text-lg font-bold text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{card.description}</p>

              {/* CTA */}
              <Link
                to={card.to}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/[0.06] border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
