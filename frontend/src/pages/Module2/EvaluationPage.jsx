import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Download, X, ArrowRight, ArrowLeft, BarChart3,
} from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import StatusBadge   from '../../components/common/StatusBadge';
import { useAppStore } from '../../store/useAppStore';

const BG = 'bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]';
const M2_STEPS = ['Select Exam', 'Upload Sheets', 'Processing', 'Review Flags', 'Results'];

export default function EvaluationPage() {
  const getStudentsForSession = useAppStore((s) => s.getStudentsForSession);
  const students = getStudentsForSession('ES-2026-001');

  const [selectedStudent, setSelectedStudent] = useState(null);

  const avgScore  = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.percentage, 0) / students.length * 10) / 10
    : 0;
  const topStudent = students.reduce((top, s) => (!top || s.percentage > top.percentage ? s : top), null);
  const flagged    = students.filter((s) => s.flagCount > 0).length;

  const scoreColor = (p) =>
    p >= 80 ? 'text-emerald-300' : p >= 60 ? 'text-amber-300' : 'text-rose-300';

  return (
    <div className={`min-h-screen ${BG}`}>
      <Navbar />
      <PageContainer subtitle="Module 2 / Step 5" title="Evaluation Results">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M2_STEPS} currentStep={5} />

            {/* ── Summary stat chips ── */}
            <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Average Score',   value: `${avgScore}%`,         color: 'text-blue-300',    border: 'border-blue-400/20',    bg: 'bg-blue-500/[0.07]'    },
                { label: 'Top Performer',   value: topStudent?.studentName?.split(' ')[0] ?? '—', color: 'text-emerald-300', border: 'border-emerald-400/20', bg: 'bg-emerald-500/[0.07]' },
                { label: 'Flagged Students', value: flagged,               color: 'text-amber-300',   border: 'border-amber-400/20',   bg: 'bg-amber-500/[0.07]'   },
                { label: 'Evaluated',       value: `${students.length}/${students.length}`, color: 'text-white', border: 'border-white/[0.07]', bg: 'bg-white/[0.04]' },
              ].map((s) => (
                <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-4`}>
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            <div className={`flex gap-5 transition-all duration-300`}>

              {/* ── Table ── */}
              <Card p="p-0" hover={false} className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Results</p>
                    <h3 className="mt-0.5 text-sm font-bold text-white">Student Evaluation Report</h3>
                  </div>
                  <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />}>
                    Export CSV
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Student</th>
                        <th className="px-4 py-3 font-semibold">Roll No</th>
                        <th className="px-4 py-3 font-semibold">Marks</th>
                        <th className="px-4 py-3 font-semibold">Score</th>
                        <th className="px-4 py-3 font-semibold">Flags</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">View</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, i) => (
                        <motion.tr
                          key={student.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => setSelectedStudent(s => s?.id === student.id ? null : student)}
                          className={`cursor-pointer border-t border-white/[0.05] transition hover:bg-white/[0.04] ${selectedStudent?.id === student.id ? 'bg-blue-500/[0.07]' : ''}`}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-[10px] font-black text-blue-300">
                                {student.studentName[0]}
                              </div>
                              <span className="font-semibold text-white">{student.studentName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-[10px] text-slate-500">{student.rollNo}</td>
                          <td className="px-4 py-4 font-bold text-white">{student.marksObtained}/{student.totalMarks}</td>
                          <td className={`px-4 py-4 text-sm font-black ${scoreColor(student.percentage)}`}>
                            {student.percentage}%
                          </td>
                          <td className="px-4 py-4">
                            {student.flagCount > 0 ? (
                              <span className="flex items-center gap-1 text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                {student.flagCount}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge tone={student.status === 'Evaluated' ? 'success' : 'warning'} dot>
                              {student.status}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-4">
                            <button className="text-xs text-blue-400 transition hover:text-blue-300">View →</button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* ── Side panel ── */}
              <AnimatePresence>
                {selectedStudent && (
                  <motion.div
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    className="w-72 shrink-0"
                  >
                    <Card className="sticky top-24">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-white">{selectedStudent.studentName}</p>
                          <p className="text-[10px] text-slate-500">{selectedStudent.rollNo}</p>
                        </div>
                        <button
                          onClick={() => setSelectedStudent(null)}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Score */}
                      <div className={`mb-4 text-center rounded-xl py-3 ${
                        selectedStudent.percentage >= 80 ? 'bg-emerald-500/10 border border-emerald-400/20'
                        : selectedStudent.percentage >= 60 ? 'bg-amber-500/10 border border-amber-400/20'
                        : 'bg-rose-500/10 border border-rose-400/20'
                      }`}>
                        <p className={`text-3xl font-black ${scoreColor(selectedStudent.percentage)}`}>
                          {selectedStudent.percentage}%
                        </p>
                        <p className="text-xs text-slate-500">{selectedStudent.marksObtained}/{selectedStudent.totalMarks} marks</p>
                      </div>

                      {/* Question-wise marks */}
                      <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-600">Question-wise Marks</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedStudent.questionWiseMarks.map((q) => (
                          <div
                            key={q.qNo}
                            className={`rounded-xl border p-2.5 ${q.flagged ? 'border-amber-400/20 bg-amber-500/[0.05]' : 'border-white/[0.06] bg-white/[0.03]'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-white">{q.qNo}</span>
                              <span className="text-[10px] font-bold text-white">{q.obtained}/{q.maxMarks}</span>
                            </div>
                            <p className="mt-0.5 text-[9px] text-slate-500 line-clamp-1">{q.question}</p>
                            {q.flagged && <span className="mt-0.5 inline-block text-[9px] text-amber-400">⚠ Flagged</span>}
                          </div>
                        ))}
                      </div>

                      {/* Feedback */}
                      <p className="mb-2 mt-4 text-[9px] font-bold uppercase tracking-wider text-slate-600">AI Feedback</p>
                      <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-[10px] leading-5 text-slate-300">
                        {selectedStudent.feedback}
                      </p>

                      {/* Strengths/Weaknesses */}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] p-2.5">
                          <p className="text-[9px] uppercase text-emerald-400 mb-1">Strengths</p>
                          {selectedStudent.strengths.map((s) => (
                            <p key={s} className="text-[9px] text-slate-400 leading-4">· {s}</p>
                          ))}
                        </div>
                        <div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.05] p-2.5">
                          <p className="text-[9px] uppercase text-rose-400 mb-1">Weaknesses</p>
                          {selectedStudent.weaknesses.map((w) => (
                            <p key={w} className="text-[9px] text-slate-400 leading-4">· {w}</p>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Actions ── */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module2/mapping" icon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button to="/module2/report" icon={<BarChart3 className="h-4 w-4" />}>
                Generate Report
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
