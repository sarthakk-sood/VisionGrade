import { motion } from 'framer-motion';
import { FileUp, ShieldCheck, UploadCloud } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import ProgressBar from '../common/ProgressBar';
import StatusBadge from '../common/StatusBadge';

export default function PDFUploadZone({ title = 'Upload PDF', progress = 0, status = 'Ready', error = '', success = '' }) {
  return (
    <Card className="overflow-hidden">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">Document Input</p>
          <h3 className="mt-2 text-2xl font-bold text-white">{title}</h3>
        </div>
        <StatusBadge tone={error ? 'danger' : success ? 'success' : 'info'}>{error ? 'Error' : success ? 'Completed' : status}</StatusBadge>
      </div>

      <motion.div
        className="rounded-[24px] border border-dashed border-blue-400/30 bg-blue-500/8 p-8 text-center"
        whileHover={{ scale: 1.01 }}
      >
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20">
          <UploadCloud className="h-7 w-7" />
        </div>
        <h4 className="mt-4 text-xl font-semibold text-white">Drag and drop your PDF here</h4>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          PDF only, up to 10MB. VISIONGRADE validates structure, extracts topics, and prepares the next stage automatically.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button icon={<FileUp className="h-4 w-4" />}>Browse file</Button>
          <Button variant="secondary" icon={<ShieldCheck className="h-4 w-4" />}>Run validation</Button>
        </div>
      </motion.div>

      <div className="mt-6 space-y-4">
        <ProgressBar label="Upload Progress" value={progress} />
        {error && <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
        {success && <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</p>}
      </div>
    </Card>
  );
}
