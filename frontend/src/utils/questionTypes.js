/** Map backend question type enums to short display labels. */
export const TYPE_DISPLAY = {
  MCQ:             'MCQ',
  ShortAnswer:     'Short',
  MediumAnswer:    'Medium',
  LongAnswer:      'Long',
  FillInTheBlanks: 'Fill-in',
  Short:           'Short',
  Long:            'Long',
};

export const TYPE_STYLE = {
  MCQ:             'bg-purple-500/20 text-purple-300',
  ShortAnswer:     'bg-blue-500/20 text-blue-300',
  MediumAnswer:    'bg-cyan-500/20 text-cyan-300',
  LongAnswer:      'bg-orange-500/20 text-orange-300',
  FillInTheBlanks: 'bg-slate-500/20 text-slate-300',
  Short:           'bg-blue-500/20 text-blue-300',
  Long:            'bg-orange-500/20 text-orange-300',
};

export function displayType(type) {
  return TYPE_DISPLAY[type] || type || 'Question';
}

export function countByType(questions) {
  const mcq = questions.filter((q) => q.type === 'MCQ').length;
  const short = questions.filter((q) =>
    ['Short', 'ShortAnswer', 'MediumAnswer', 'FillInTheBlanks'].includes(q.type)
  ).length;
  const long = questions.filter((q) =>
    ['Long', 'LongAnswer'].includes(q.type)
  ).length;
  return { mcq, short, long };
}
