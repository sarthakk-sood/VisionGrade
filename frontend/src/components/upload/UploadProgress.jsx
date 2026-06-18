import ProgressBar from '../common/ProgressBar';

export default function UploadProgress({ files = [] }) {
  return (
    <div className="space-y-4">
      {files.map((file) => (
        <div key={file.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="font-semibold text-slate-900">{file.name}</p>
              <p className="text-slate-500">{file.meta}</p>
            </div>
            <span className="text-blue-600">{file.progress}%</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={file.progress} />
          </div>
        </div>
      ))}
    </div>
  );
}
