import { motion } from 'framer-motion';
import { ArrowRight, BrainCircuit, FileText, LineChart, Play, ScanFace, Sparkles, Users } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

const features = [
  { icon: BrainCircuit, title: 'AI Question Generation', description: 'Generate aligned question papers from source PDFs, syllabus weights, and cognitive levels.' },
  { icon: ScanFace, title: 'OCR Handwriting Recognition', description: 'Extract handwritten text with confidence scoring and low-confidence review tools.' },
  { icon: LineChart, title: 'Automated Evaluation', description: 'Score answer sheets with transparent feedback, strengths, and weaknesses per student.' },
  { icon: FileText, title: 'Question Paper Export', description: 'Export polished question sets and answer keys as DOCX or PDF for faculty workflow.' },
  { icon: Users, title: 'Analytics Dashboard', description: 'Track sessions, review accuracy, and monitor batch progress from one view.' },
  { icon: Sparkles, title: 'Faculty Review Workflow', description: 'Keep human approval in the loop with draft, approve, regenerate, and export states.' },
];

const module1Steps = ['Exam Details', 'Upload PDFs', 'Topics & Weightage', 'Generate Questions', 'Review Questions', 'Export Paper'];
const module2Steps = ['Select Exam', 'Upload Sheets', 'OCR Processing', 'Review Flags', 'Evaluation Results'];

const plans = [
  { name: 'Academic Starter', price: 'Free', features: ['1 course workspace', 'Topic detection', 'Manual review'], highlight: false },
  { name: 'Institution Pro', price: '$49', features: ['Unlimited sessions', 'OCR review', 'Exports and analytics'], highlight: true },
  { name: 'Enterprise', price: 'Custom', features: ['SSO', 'API access', 'Dedicated deployment'], highlight: false },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100" />
      <motion.div className="absolute left-12 top-24 h-64 w-64 rounded-full bg-blue-100 blur-3xl" animate={{ y: [0, 16, 0] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="absolute right-10 top-36 h-80 w-80 rounded-full bg-blue-50 blur-3xl" animate={{ y: [0, -20, 0] }} transition={{ duration: 10, repeat: Infinity }} />
      <Navbar />

      <main className="relative">
        <section className="mx-auto grid w-full max-w-7xl gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr,0.9fr] lg:px-8 lg:pt-20">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="pt-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 shadow-sm">
              <span className="rounded-full bg-blue-400 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.35em] text-slate-950">NEW</span>
              <span>AI Academic Evaluation System</span>
            </div>
            <h1 className="mt-8 max-w-2xl text-5xl font-black leading-[0.94] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              AI-Powered Academic Evaluation
              <span className="block text-gradient">Fast.</span>
              <span className="block text-gradient">Accurate.</span>
              <span className="block text-gradient">Automated.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Generate question papers and evaluate handwritten answer sheets using AI. VisionGrade gives faculty a premium, enterprise-grade workflow for high-volume academic assessment.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button to="/dashboard" size="lg">Get Started</Button>
              <Button href="#demo" variant="secondary" size="lg" icon={<Play className="h-4 w-4" />}>Watch Demo</Button>
            </div>
            <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
              {[
                ['147 sheets evaluated', 'Live throughput for current batch'],
                ['92% OCR Accuracy', 'Confidence-aware handwritten review'],
                ['3000+ Questions Generated', 'Blueprint-driven faculty workflow'],
              ].map(([title, description]) => (
                <Card key={title} className="p-4">
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                </Card>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative flex items-center justify-center">
            <Card className="relative w-full max-w-[560px] overflow-hidden p-5">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-transparent" />
              <div className="relative rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span>visiongrade.ai / exam / phy-prelim-2026</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">EVALUATING</span>
                </div>
                <div className="mt-5 grid grid-cols-[170px,1fr] gap-4">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Workspace</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                      {['Dashboard', 'Exams', 'Analytics', 'Settings'].map((item, index) => (
                        <div key={item} className={[
                          'rounded-2xl border px-3 py-2 transition',
                          index === 1 ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50',
                        ].join(' ')}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        ['Submitted', '187', '+24 today'],
                        ['Evaluated', '147', '79% done'],
                        ['Avg Score', '72%', '+4 vs prev'],
                      ].map(([label, value, note]) => (
                        <div key={label} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
                          <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
                          <p className="mt-2 text-xs text-emerald-700">{note}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-[1fr,0.8fr] gap-4">
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Live Evaluation</p>
                        <div className="mt-4 rounded-[18px] border border-slate-200 bg-white/90 p-4 text-sm text-slate-600">
                          Q1. Newton&apos;s second law states that F = ma. The candidate explains force and acceleration with a neat diagram.
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
                          <span className="rounded-full bg-emerald-50 px-2 py-1">AI MARKING</span>
                          <span>+1 partial credit</span>
                        </div>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Score Distribution</p>
                        <div className="mt-4 flex h-32 items-end gap-2">
                          {[32, 54, 70, 82, 74, 58, 42].map((height, index) => (
                            <div key={index} className="flex-1 rounded-t-full bg-gradient-to-t from-blue-700 via-blue-500 to-cyan-400" style={{ height: `${height}%` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <motion.div className="absolute -left-4 top-8 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-glow" animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity }}>
                <p className="text-slate-600">147 sheets evaluated</p>
              </motion.div>
              <motion.div className="absolute -right-3 top-24 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-glow" animate={{ y: [0, 10, 0] }} transition={{ duration: 5.5, repeat: Infinity }}>
                <p className="text-slate-600">92% OCR Accuracy</p>
              </motion.div>
              <motion.div className="absolute bottom-8 left-14 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-glow" animate={{ y: [0, -10, 0] }} transition={{ duration: 6.5, repeat: Infinity }}>
                <p className="text-slate-600">3000+ Questions Generated</p>
              </motion.div>
            </Card>
          </motion.div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-blue-600">Features</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Everything faculty teams need in one platform.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
                  <Card className="h-full">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-xl font-bold text-slate-900">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-500">{feature.description}</p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-blue-600">How it works</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">A complete workflow in two intuitive modules.</h2>
          </div>
          
          <div className="space-y-12">
            {/* Module 1 */}
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-600">Module 1</span>
                <h3 className="text-xl font-bold text-slate-900">Question Paper Generation</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                {module1Steps.map((step, index) => (
                  <Card key={step} className="relative min-h-[140px] p-4 border-blue-400/10 hover:border-blue-300">
                    <div className="text-sm font-bold text-blue-600">0{index + 1}</div>
                    <div className="mt-6 text-sm font-semibold text-slate-900">{step}</div>
                    {index < module1Steps.length - 1 && (
                      <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-slate-500" />
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* Module 2 */}
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-purple-700">Module 2</span>
                <h3 className="text-xl font-bold text-slate-900">Answer Sheet Evaluation</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                {module2Steps.map((step, index) => (
                  <Card key={step} className="relative min-h-[140px] p-4 border-purple-400/10 hover:border-purple-400/30">
                    <div className="text-sm font-bold text-purple-700">0{index + 1}</div>
                    <div className="mt-6 text-sm font-semibold text-slate-900">{step}</div>
                    {index < module2Steps.length - 1 && (
                      <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-slate-500" />
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-blue-600">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Plans that scale from one department to an institution.</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.name} className={plan.highlight ? 'border-blue-300 bg-blue-500/8' : ''}>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{plan.name}</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-5xl font-black text-slate-900">{plan.price}</span>
                  {plan.price !== 'Free' && <span className="pb-1 text-slate-500">/month</span>}
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-600">
                  {plan.features.map((item) => <li key={item}>• {item}</li>)}
                </ul>
                <div className="mt-8">
                  <Button to="/login" variant={plan.highlight ? 'primary' : 'secondary'} className="w-full">Choose Plan</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section id="demo" className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Card className="flex flex-col items-start justify-between gap-6 overflow-hidden bg-gradient-to-r from-blue-500/10 via-white/5 to-cyan-400/10 md:flex-row md:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-600">Ready to deploy</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">Run the full VISIONGRADE workflow from one dashboard.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">This frontend is designed to feel production-ready from the first render, with routing, realistic mock data, and responsive layouts for every module.</p>
            </div>
            <Button to="/dashboard" icon={<ArrowRight className="h-4 w-4" />}>Open Dashboard</Button>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
