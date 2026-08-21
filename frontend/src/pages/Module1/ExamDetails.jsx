import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ClipboardList } from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import { StepGuard } from '../../hooks/useWorkflow';
import { useAppStore } from '../../store/useAppStore';
import { PAGE_BG } from '../../utils/theme';

const M1_STEPS = ['Exam Details', 'Upload PDFs', 'Topics & Weightage', 'Generate Questions', 'Review Questions', 'Export'];

const INPUT_CLS = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-600 backdrop-blur transition focus:border-blue-400/40 focus:outline-none focus:ring-1 focus:ring-blue-200';
const LABEL_CLS = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500';

const SEMESTERS = ['I Semester','II Semester','III Semester','IV Semester','V Semester','VI Semester','VII Semester','VIII Semester'];
const Q_TYPES   = ['MCQ','Theory','Mixed'];
const DIFFS     = ['Easy','Medium','Hard','Mixed'];

function ToggleGroup({ options, value, onChange, colorMap = {} }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt;
        const color  = colorMap[opt] ?? 'border-blue-400/40 bg-blue-100 text-blue-600';
        return (
          <motion.button
            key={opt}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(opt)}
            className={[
              'rounded-xl border px-4 py-2 text-xs font-semibold transition-all duration-150',
              active
                ? color
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white/[0.07] hover:text-slate-600',
            ].join(' ')}
          >
            {opt}
          </motion.button>
        );
      })}
    </div>
  );
}

export default function ExamDetails() {
  const navigate      = useNavigate();
  const completeM1Step = useAppStore((s) => s.completeM1Step);
  const setExamInfo    = useAppStore((s) => s.setExamInfo);

  const [form, setForm] = useState({
    examName: '', subject: '', subjectCode: '',
    academicYear: '2025–26', semester: 'IV Semester',
    session: '', totalMarks: 100,
    questionType: 'Mixed', difficulty: 'Mixed',
  });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const errs = {};
    if (!form.examName.trim())  errs.examName  = 'Exam name is required.';
    if (!form.totalMarks || form.totalMarks < 1) errs.totalMarks = 'Total marks must be > 0.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    // Persist exam info to store so later steps can use it
    setExamInfo({
      examTitle:       form.examName,
      subject:         form.subject,
      totalMarks:      form.totalMarks,
    });
    completeM1Step(1);
    navigate('/module1/upload');
  };

  const diffColor = {
    Easy:   'border-emerald-400/60 bg-emerald-100 text-emerald-800',
    Medium: 'border-amber-400/60  bg-amber-100  text-amber-800',
    Hard:   'border-rose-400/60   bg-rose-100   text-rose-800',
    Mixed:  'border-blue-400/40   bg-blue-100   text-blue-700',
  };

  return (
    <StepGuard step={1}>
      <div className={PAGE_BG}>
        <Navbar />
        <PageContainer subtitle="Module 1 / Step 1" title="Exam Details">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <Stepper steps={M1_STEPS} currentStep={1} />
              <div className="space-y-5">
                {/* ── Basic Info ── */}
                <Card>
                  <div className="mb-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Step 1</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">Basic Exam Information</h3>
                    <p className="mt-1 text-xs text-slate-500">Configure the fundamental details for your exam session.</p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={LABEL_CLS}>Exam Name *</label>
                      <input type="text" placeholder="e.g. DBMS Mid Semester Examination 2026" value={form.examName} onChange={(e) => set('examName', e.target.value)} className={INPUT_CLS} />
                      {errors.examName && <p className="mt-1.5 text-xs text-rose-400">{errors.examName}</p>}
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Subject</label>
                      <input type="text" placeholder="e.g. Database Management Systems" value={form.subject} onChange={(e) => set('subject', e.target.value)} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Subject Code</label>
                      <input type="text" placeholder="e.g. CS401" value={form.subjectCode} onChange={(e) => set('subjectCode', e.target.value)} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Academic Year</label>
                      <input type="text" placeholder="e.g. 2025–26" value={form.academicYear} onChange={(e) => set('academicYear', e.target.value)} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Semester</label>
                      <select
                        value={form.semester}
                        onChange={(e) => set('semester', e.target.value)}
                        className={`${INPUT_CLS} cursor-pointer !bg-white`}
                        style={{ colorScheme: 'light' }}
                      >
                        {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Session</label>
                      <input type="text" placeholder="e.g. Mid Semester 2026" value={form.session} onChange={(e) => set('session', e.target.value)} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Total Marks *</label>
                      <input type="number" min="1" placeholder="e.g. 100" value={form.totalMarks} onChange={(e) => set('totalMarks', Number(e.target.value))} className={INPUT_CLS} />
                      {errors.totalMarks && <p className="mt-1.5 text-xs text-rose-400">{errors.totalMarks}</p>}
                    </div>
                  </div>
                </Card>
                {/* ── Question Config ── */}
                <Card>
                  <div className="mb-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Configuration</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">Question Type & Difficulty</h3>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className={LABEL_CLS}>Question Type</label>
                      <ToggleGroup options={Q_TYPES} value={form.questionType} onChange={(v) => set('questionType', v)} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Difficulty Level</label>
                      <ToggleGroup options={DIFFS} value={form.difficulty} onChange={(v) => set('difficulty', v)} colorMap={diffColor} />
                    </div>
                  </div>
                </Card>
                {/* ── Preview chip ── */}
                {form.examName && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-400/15 bg-blue-500/8 px-4 py-3">
                    <ClipboardList className="h-4 w-4 text-blue-600" />
                    <p className="text-xs font-semibold text-slate-900">{form.examName}</p>
                    {form.totalMarks > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{form.totalMarks} marks</span>}
                    {form.questionType && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-600">{form.questionType}</span>}
                  </motion.div>
                )}
                {/* ── Actions ── */}
                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" onClick={() => navigate('/dashboard')}>Cancel</Button>
                  <Button onClick={handleContinue} icon={<ArrowRight className="h-4 w-4" />}>
                    Continue to Upload PDFs
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </div>
    </StepGuard>
  );
}
