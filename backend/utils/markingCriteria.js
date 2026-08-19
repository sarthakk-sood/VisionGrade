/**
 * Structured marking criteria used at paper generation and at scoring.
 *
 * Stored per question as:
 *   markingCriteria: [{ point: "Definition of polymorphism", marks: 1 }, ...]
 * Legacy papers only have a markingScheme string; those are parsed into the
 * same shape before they are sent to the LLM.
 */

const POINT_LINE_RE = /^(?:[-•*]|\d+[.)])?\s*(\d+(?:\.\d+)?)\s*marks?\s*(?:for|:|-)?\s*(.*)$/i;

const toItem = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const point = String(raw.point || raw.text || raw.criterion || '').trim();
  const marks = Number(raw.marks ?? raw.mark);
  if (!point || !Number.isFinite(marks) || marks <= 0) return null;
  return { point, marks };
};

const parseSchemeString = (markingScheme, maxMarks) => {
  const lines = String(markingScheme || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items = [];
  for (const line of lines) {
    const match = line.match(POINT_LINE_RE);
    if (match) {
      items.push({ point: match[2].trim(), marks: Number(match[1]) });
    }
  }
  if (items.length) return items;
  const fallback = String(markingScheme || '').trim();
  if (!fallback) return [];
  return [{ point: fallback, marks: Number(maxMarks) || 0 }].filter((i) => i.marks > 0 && i.point);
};

const normalizeCriteria = (raw, maxMarks) => {
  if (Array.isArray(raw)) {
    return raw.map(toItem).filter(Boolean);
  }
  if (raw && typeof raw === 'object' && Array.isArray(raw.criteria)) {
    return raw.criteria.map(toItem).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return parseSchemeString(raw, maxMarks);
  }
  return [];
};

const criteriaToSchemeString = (criteria) =>
  (criteria || [])
    .map((c) => `${c.marks} mark${Number(c.marks) === 1 ? '' : 's'}: ${c.point}`)
    .join('\n');

const resolveCriteria = (question) => {
  const maxMarks = Number(question?.marks) || 0;
  const fromField = normalizeCriteria(question?.markingCriteria, maxMarks);
  if (fromField.length) return fromField;
  return normalizeCriteria(question?.markingScheme, maxMarks);
};

/**
 * Payload sent to the scoring LLM with the answer-sheet image/PDF.
 */
const buildMarkingPayload = (question) => ({
  question: question.questionText || '',
  max_marks: Number(question.marks) || 0,
  criteria: resolveCriteria(question),
});

module.exports = {
  normalizeCriteria,
  criteriaToSchemeString,
  resolveCriteria,
  buildMarkingPayload,
};
