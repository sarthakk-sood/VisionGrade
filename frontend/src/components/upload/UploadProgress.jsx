import ProgressBar from '../common/ProgressBar';

export default function UploadProgress({ files = [] }) {
  return (
    <div className="space-y-4">
      {files.map((file) => (
        <div key={file.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="font-semibold text-white">{file.name}</p>
              <p className="text-slate-400">{file.meta}</p>
            </div>
            <span className="text-blue-300">{file.progress}%</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={file.progress} />
          </div>
        </div>
      ))}
    </div>
  );
}
