import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';

const QUESTION_TYPES = [
  { value: 'MCQ', label: 'MCQ' },
  { value: 'ShortAnswer', label: 'Short Answer' },
  { value: 'MediumAnswer', label: 'Medium Answer' },
  { value: 'LongAnswer', label: 'Long Answer' },
  { value: 'FillInTheBlanks', label: 'Fill in the Blanks' },
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const EMPTY_FORM = {
  questionText: '',
  type: 'ShortAnswer',
  difficulty: 'Medium',
  marks: 2,
  topicName: '',
  options: '',
  correctAnswer: '',
  explanation: '',
};

export function questionToForm(q, topics = []) {
  if (!q) {
    return {
      ...EMPTY_FORM,
      topicName: topics.find((t) => t.isSelected !== false)?.name || topics[0]?.name || 'General',
    };
  }
  return {
    questionText: q.text || q.questionText || '',
    type: q.type || 'ShortAnswer',
    difficulty: q.difficulty || 'Medium',
    marks: q.marks ?? 2,
    topicName: q.topic || q.topicName || '',
    options: Array.isArray(q.options) ? q.options.join('\n') : '',
    correctAnswer: q.answer || q.correctAnswer || '',
    explanation: q.explanation || '',
  };
}

export function formToPayload(form) {
  const payload = {
    questionText: form.questionText.trim(),
    type: form.type,
    difficulty: form.difficulty,
    marks: Number(form.marks),
    topicName: form.topicName.trim(),
    correctAnswer: form.correctAnswer.trim(),
    explanation: form.explanation.trim(),
  };
  if (form.type === 'MCQ') {
    payload.options = form.options
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return payload;
}

export default function QuestionFormModal({
  open,
  title,
  initialQuestion,
  topics = [],
  saving = false,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) setForm(questionToForm(initialQuestion, topics));
  }, [open, initialQuestion, topics]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formToPayload(form));
  };

  const topicOptions = topics.filter((t) => t.isSelected !== false);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Question text</span>
              <textarea
                required
                rows={4}
                value={form.questionText}
                onChange={(e) => set('questionText', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400/50"
                placeholder="Enter the question..."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Type</span>
                <select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                  style={{ colorScheme: 'light' }}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Difficulty</span>
                <select
                  value={form.difficulty}
                  onChange={(e) => set('difficulty', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                  style={{ colorScheme: 'light' }}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Marks"
                type="number"
                min={1}
                value={form.marks}
                onChange={(e) => set('marks', e.target.value)}
              />

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Topic</span>
                {topicOptions.length > 0 ? (
                  <select
                    value={form.topicName}
                    onChange={(e) => set('topicName', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                    style={{ colorScheme: 'light' }}
                  >
                    {topicOptions.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.topicName}
                    onChange={(e) => set('topicName', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
                    placeholder="Topic name"
                  />
                )}
              </label>
            </div>

            {form.type === 'MCQ' && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Options (one per line)</span>
                <textarea
                  rows={4}
                  value={form.options}
                  onChange={(e) => set('options', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
                  placeholder={'A. Option one\nB. Option two\nC. Option three\nD. Option four'}
                />
              </label>
            )}

            <Input
              label="Correct answer"
              value={form.correctAnswer}
              onChange={(e) => set('correctAnswer', e.target.value)}
              placeholder={form.type === 'MCQ' ? 'A' : 'Expected answer'}
            />

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Explanation (optional)</span>
              <textarea
                rows={2}
                value={form.explanation}
                onChange={(e) => set('explanation', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
              />
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} icon={<Save className="h-4 w-4" />}>
                {saving ? 'Saving…' : 'Save Question'}
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
