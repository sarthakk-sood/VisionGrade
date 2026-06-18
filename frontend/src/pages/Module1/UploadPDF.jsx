import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, X, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar        from '../../components/layout/Navbar';
import Sidebar       from '../../components/layout/Sidebar';
import PageContainer from '../../components/layout/PageContainer';
import Stepper       from '../../components/common/Stepper';
import Card          from '../../components/common/Card';
import Button        from '../../components/common/Button';
import ProgressBar   from '../../components/common/ProgressBar';
import StatusBadge   from '../../components/common/StatusBadge';
import { useAppStore } from '../../store/useAppStore';
import { StepGuard } from '../../hooks/useWorkflow';
import { PAGE_BG } from '../../utils/theme';

const M1_STEPS = ['Exam Details', 'Upload PDFs', 'Topics & Weightage', 'Generate Questions', 'Review Questions', 'Export'];

export default function UploadPDF() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Store state
  const uploadedFiles           = useAppStore((s) => s.uploadedFiles);
  const removeUploadedFile      = useAppStore((s) => s.removeUploadedFile);
  const uploadPDFsToBackend     = useAppStore((s) => s.uploadPDFsToBackend);
  const detectTopicsFromBackend = useAppStore((s) => s.detectTopicsFromBackend);
  const loadingStates           = useAppStore((s) => s.loadingStates);
  const topicsLoading           = useAppStore((s) => s.topicsLoading);
  const topicsError             = useAppStore((s) => s.topicsError);
  const projectId               = useAppStore((s) => s.projectId);
  const examInfo                = useAppStore((s) => s.examInfo);
  const completeM1Step          = useAppStore((s) => s.completeM1Step);

  // Local state for staged files (before upload)
  const [stagedFiles, setStagedFiles]   = useState([]);
  const [uploadError, setUploadError]   = useState(null);
  const [isDragging, setIsDragging]     = useState(false);

  const isUploading  = loadingStates.uploading;
  const isProcessing = isUploading || topicsLoading;

  // ── File selection ────────────────────────────────────────────────────────
  const handleFiles = (incoming) => {
    const pdfs = Array.from(incoming).filter((f) => f.type === 'application/pdf');
    if (pdfs.length === 0) {
      setUploadError('Only PDF files are supported.');
      return;
    }
    setUploadError(null);
    setStagedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...pdfs.filter((f) => !existing.has(f.name))];
    });
  };

  const removeStagedFile = (name) =>
    setStagedFiles((prev) => prev.filter((f) => f.name !== name));

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── Upload + detect topics ────────────────────────────────────────────────
  const handleContinue = async () => {
    if (stagedFiles.length === 0 && !projectId) {
      setUploadError('Please select at least one PDF to upload.');
      return;
    }

    let pid = projectId;

    if (stagedFiles.length > 0) {
      pid = await uploadPDFsToBackend(
        stagedFiles,
        examInfo?.examTitle || 'Untitled Project',
        examInfo?.subject || ''
      );
      if (!pid) return;
      setStagedFiles([]);
    }

    const detected = await detectTopicsFromBackend(pid);
    if (detected) {
      completeM1Step(2);
      navigate('/module1/topics');
    }
  };

  return (
    <StepGuard step={2}>
    <div className={PAGE_BG}>
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
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">PDF Upload</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">Upload Syllabus Documents</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Upload your syllabus, previous papers, or topic guides. Topics will be extracted automatically using AI.
                    </p>
                  </div>

                  {/* Drop zone */}
                  <motion.div
                    whileHover={{ borderColor: 'rgba(96,165,250,0.4)', backgroundColor: 'rgba(59,130,246,0.06)' }}
                    animate={isDragging ? { borderColor: 'rgba(96,165,250,0.6)', backgroundColor: 'rgba(59,130,246,0.1)' } : {}}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-500/[0.03] p-10 text-center transition-colors duration-200"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <UploadCloud className="mx-auto h-10 w-10 text-blue-600/50" />
                    </motion.div>
                    <p className="mt-4 text-sm font-semibold text-slate-900">Drop PDF files here to upload</p>
                    <p className="mt-1.5 text-xs text-slate-500">or click to browse — PDF only, max 50MB per file</p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100">
                      <FileText className="h-4 w-4" />
                      Browse Files
                    </div>
                  </motion.div>

                  {/* Staged files */}
                  <AnimatePresence>
                    {stagedFiles.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-4 space-y-2"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Ready to upload</p>
                        {stagedFiles.map((f) => (
                          <div key={f.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/[0.03] px-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                              <span className="truncate text-xs text-slate-900">{f.name}</span>
                              <span className="shrink-0 text-[10px] text-slate-500">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeStagedFile(f.name); }}
                              className="ml-2 rounded-lg p-1 text-slate-600 hover:bg-rose-500/15 hover:text-rose-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Format badges */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge tone="success" dot>PDF Supported</StatusBadge>
                    <StatusBadge tone="info" dot>Max 50MB / file</StatusBadge>
                    <StatusBadge tone="neutral">Multi-file Upload</StatusBadge>
                  </div>
                </Card>

                {/* Error banner */}
                <AnimatePresence>
                  {(uploadError || topicsError) && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-50 p-4"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                      <p className="text-xs text-rose-600">{uploadError || topicsError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Processing state */}
                <AnimatePresence>
                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-5"
                    >
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {isUploading ? 'Uploading & parsing PDFs…' : 'Detecting topics with AI…'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {topicsLoading
                              ? 'GPT-4o / Gemini is analysing your documents. This can take up to 60s.'
                              : 'Extracting text from your PDFs…'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Right: Uploaded files queue ── */}
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Uploaded Files</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">Document Queue</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
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
                      className="rounded-2xl border border-slate-200 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900">{file.name}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {file.pages} pages · {file.uploadTime}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeUploadedFile(file.id)}
                          className="shrink-0 rounded-lg p-1 text-slate-600 transition hover:bg-rose-500/15 hover:text-rose-600"
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

                  {uploadedFiles.length === 0 && stagedFiles.length === 0 && (
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
              <Button
                onClick={handleContinue}
                disabled={isProcessing || (stagedFiles.length === 0 && !projectId)}
                icon={isProcessing
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ArrowRight className="h-4 w-4" />
                }
              >
                {isUploading ? 'Uploading…' : topicsLoading ? 'Detecting Topics…' : 'Upload & Detect Topics'}
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
    </StepGuard>
  );
}
