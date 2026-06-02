import Card from '../common/Card';
import Button from '../common/Button';
import { FileDown, FileText, Package } from 'lucide-react';

export default function ExportPanel() {
  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">Exports</p>
      <h3 className="mt-2 text-xl font-bold text-white">Download outputs</h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <Button variant="secondary" icon={<FileText className="h-4 w-4" />}>DOCX</Button>
        <Button variant="secondary" icon={<FileDown className="h-4 w-4" />}>PDF</Button>
        <Button variant="secondary" icon={<Package className="h-4 w-4" />}>ZIP</Button>
      </div>
    </Card>
  );
}
