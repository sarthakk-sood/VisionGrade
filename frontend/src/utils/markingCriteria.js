/**
 * Mirrors the backend's all-or-nothing rule (backend/utils/markingCriteria.js)
 * so MCQ/FillInTheBlanks never render a decomposed "step marking" list in the
 * UI, even for sessions generated before that rule existed.
 */
const ALL_OR_NOTHING_TYPES = new Set(['MCQ', 'FillInTheBlanks']);

/** Human-readable marking-scheme lines for a question, ignoring bad legacy data for MCQ/FillInTheBlanks. */
export const markingCriteriaLines = (q) => {
  const marks = Number(q?.marks) || 0;
  const markLabel = `${marks} mark${marks === 1 ? '' : 's'}`;

  if (ALL_OR_NOTHING_TYPES.has(q?.type)) {
    return [`${markLabel} — all or nothing. Correct answer: ${q?.correctAnswer || '—'}`];
  }

  if (q?.markingCriteria?.length) {
    return q.markingCriteria.map(
      (c) => `${c.marks} mark${Number(c.marks) === 1 ? '' : 's'}: ${c.point}`
    );
  }
  if (q?.markingScheme) return [q.markingScheme];
  return [];
};
