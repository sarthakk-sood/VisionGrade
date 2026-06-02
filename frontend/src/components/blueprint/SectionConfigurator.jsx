import Input from '../common/Input';

export default function SectionConfigurator({ sections = [] }) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Input label="Section" defaultValue={section.name} />
            <Input label="Questions" type="number" defaultValue={section.questions} />
            <Input label="Marks" type="number" defaultValue={section.marks} />
            <Input label="Difficulty" defaultValue={section.difficulty} />
          </div>
        </div>
      ))}
    </div>
  );
}
