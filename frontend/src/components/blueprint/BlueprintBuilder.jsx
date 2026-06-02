import { motion } from 'framer-motion';
import Card from '../common/Card';
import Button from '../common/Button';
import MarksDistribution from './MarksDistribution';
import SectionConfigurator from './SectionConfigurator';

export default function BlueprintBuilder({ blueprint, onSectionChange }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
      <Card>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">Blueprint Setup</p>
            <h3 className="mt-2 text-2xl font-bold text-white">Configure exam blueprint</h3>
          </div>
          <Button>Validate marks</Button>
        </div>
        <SectionConfigurator sections={blueprint.sections} onChange={onSectionChange} />
      </Card>

      <div className="space-y-6">
        <MarksDistribution blueprint={blueprint} />
        <motion.div className="glass-card rounded-[28px] border border-white/10 p-5" whileHover={{ y: -3 }}>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">Live Preview</p>
          <div className="mt-4 space-y-3 rounded-3xl border border-white/10 bg-slate-950/60 p-4">
            {blueprint.sections.map((section) => (
              <div key={section.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm">
                <span className="font-medium text-white">{section.name}</span>
                <span className="text-slate-300">{section.questions} Q · {section.marks} marks</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
