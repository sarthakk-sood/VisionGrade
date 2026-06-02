import { motion } from 'framer-motion';
import { UploadCloud, FileText, X, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import ProgressBar   from '../../components/common/ProgressBar';
import StatusBadge   from '../../components/common/StatusBadge';
import { useAppStore } from '../../store/useAppStore';

const BG = 'bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]';
const M1_STEPS = ['Exam Details', 'Upload PDFs', 'Topics & Weightage', 'Generate Questions', 'Review Questions', 'Export'];

export default function UploadPDF() {
  const uploadedFiles     = useAppStore((s) => s.uploadedFiles);
  const removeUploadedFile = useAppStore((s) => s.removeUploadedFile);

  return (
    <div className={`min-h-screen ${BG}`}>
      <Navbar />
      <PageContainer subtitle="Module 1 / Step 2" title="Upload PDFs">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0">
            <Stepper steps={M1_STEPS} currentStep={2} />

            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">

              {/* ── Left: Upload zone ── */}
              <div className="space-y-5">
                <Card>
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">PDF Upload</p>
                    <h3 className="mt-1 text-lg font-bold text-white">Upload Syllabus Documents</h3>
                    <p className="mt-1 text-xs text-slate-500">Upload your syllabus, previous papers, or topic guides for AI topic detection.</p>
                  </div>

                  {/* Drop zone */}
                  <motion.div
                    whileHover={{ borderColor: 'rgba(96,165,250,0.4)', backgroundColor: 'rgba(59,130,246,0.06)' }}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-400/20 bg-blue-500/[0.03] p-10 text-center transition-colors duration-200"
                  >
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <UploadCloud className="mx-auto h-10 w-10 text-blue-400/50" />
                    </motion.div>
                    <p className="mt-4 text-sm font-semibold text-white">Drop PDF files here to upload</p>
                    <p className="mt-1.5 text-xs text-slate-500">or click to browse — PDF only, max 10MB per file</p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]">
                      <FileText className="h-4 w-4" />
                      Browse Files
                    </div>
                  </motion.div>

                  {/* Format badges */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge tone="success" dot>PDF Supported</StatusBadge>
                    <StatusBadge tone="info" dot>Max 10MB / file</StatusBadge>
                    <StatusBadge tone="neutral">Multi-file Upload</StatusBadge>
                  </div>
                </Card>

                {/* Validation quality checks */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">PDF Quality Checks</p>
                  <h3 className="mt-1 text-base font-bold text-white">Document Validation</h3>
                  <div className="mt-4 space-y-4">
                    <ProgressBar label="File integrity"      value={100} />
                    <ProgressBar label="Text detection"      value={94}  />
                    <ProgressBar label="Image extraction"    value={89}  />
                    <ProgressBar label="Layout recognition"  value={97}  />
                  </div>
                </Card>
              </div>

              {/* ── Right: Uploaded files ── */}
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Uploaded Files</p>
                    <h3 className="mt-1 text-base font-bold text-white">Document Queue</h3>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                    {uploadedFiles.length} files
                  </span>
                </div>

                <div className="space-y-3">
                  {uploadedFiles.map((file, i) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white">{file.name}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {file.size} · {file.pages} pages · {file.uploadTime}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeUploadedFile(file.id)}
                          className="shrink-0 rounded-lg p-1 text-slate-600 transition hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-3">
                        <ProgressBar value={file.progress} showValue={false} height="h-1" />
                      </div>

                      {file.progress === 100 && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Upload complete — ready for topic detection
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {uploadedFiles.length === 0 && (
                    <div className="flex flex-col items-center py-8 text-center">
                      <FileText className="h-8 w-8 text-slate-700" />
                      <p className="mt-3 text-xs text-slate-600">No files uploaded yet</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* ── Actions ── */}
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" to="/module1/exam-details" icon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button to="/module1/topics" icon={<ArrowRight className="h-4 w-4" />}>
                Continue to Topics
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
