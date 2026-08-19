/**
 * Deterministic step-marking safety net for Module 2.
 *
 * The vision LLM already returns a per-criterion match level (full / partial /
 * none) for each marking-scheme point. This module re-checks that judgement
 * against the transcribed student answer using fuzzy keyword overlap, so a
 * criterion is never scored lower than what plain keyword matching would give
 * it (e.g. "if some keywords are matching, award half marks").
 */

const { resolveCriteria } = require('./markingCriteria');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'for', 'in', 'on', 'at', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'this', 'that', 'with', 'from', 'by', 'as',
  'it', 'its', 'if', 'then', 'than', 'into', 'over', 'under', 'not', 'no', 'yes',
  'mark', 'marks', 'point', 'points', 'award', 'awarded', 'stating', 'naming',
  'explaining', 'explain', 'noting', 'describe', 'describing', 'including',
  'include', 'answer', 'student', 'provided', 'due', 'how', 'why', 'when',
  'which', 'what', 'their', 'them', 'each', 'also', 'using', 'used', 'use',
  'role', 'purpose', 'given', 'following', 'would', 'could', 'should', 'must',
  'may', 'can', 'will', 'does', 'did', 'has', 'have', 'had',
]);

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[–—]/g, '-')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenize = (value) => normalize(value)
  .split(' ')
  .filter((w) => w && w.length > 2 && !STOPWORDS.has(w));

const unique = (arr) => [...new Set(arr)];

const editDistance = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
};

const fuzzyHas = (haystack, needle) => {
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  if (needle.length < 4) return false;
  const words = haystack.split(' ');
  const maxDist = needle.length >= 8 ? 2 : 1;
  return words.some((w) => {
    if (Math.abs(w.length - needle.length) > 2) return false;
    return editDistance(w, needle) <= maxDist;
  });
};

/** Round to the nearest half mark. */
const roundHalf = (n) => Math.round(n * 2) / 2;

/**
 * Score one marking-scheme point against the student's (transcribed) answer.
 * full match (coverage >= 0.7 or exact phrase hit)  -> full marks
 * partial match (some keywords present)             -> half marks
 * no match                                           -> zero
 */
const scoreCriterionByKeywords = (point, studentAnswerText) => {
  const maxMarks = Number(point.marks) || 0;
  const hay = normalize(studentAnswerText);
  const keywords = unique(tokenize(point.point));

  if (!hay || !keywords.length) {
    return { matchLevel: 'none', marksAwarded: 0, matchedKeywords: [] };
  }

  const hits = keywords.filter((k) => fuzzyHas(hay, k));
  const coverage = hits.length / keywords.length;

  let matchLevel = 'none';
  let marksAwarded = 0;
  if (coverage >= 0.7 || (keywords.length <= 2 && hits.length === keywords.length)) {
    matchLevel = 'full';
    marksAwarded = maxMarks;
  } else if (hits.length >= 1) {
    matchLevel = 'partial';
    marksAwarded = roundHalf(maxMarks / 2);
  }

  return { matchLevel, marksAwarded, matchedKeywords: hits };
};

/**
 * Deterministic keyword pass over every criterion for a question, used as a
 * floor under the LLM's own per-criterion judgement.
 *
 * @returns {{ breakdown: Array<{point,maxMarks,matchLevel,marksAwarded,matchedKeywords}>, total: number }}
 */
const stepMarkByKeywords = (question, studentAnswerText) => {
  const points = resolveCriteria(question);
  if (!points.length) {
    return { breakdown: [], total: 0 };
  }
  const breakdown = points.map((point) => ({
    point: point.point,
    maxMarks: Number(point.marks) || 0,
    ...scoreCriterionByKeywords(point, studentAnswerText),
  }));
  const total = breakdown.reduce((sum, row) => sum + row.marksAwarded, 0);
  return { breakdown, total };
};

module.exports = {
  normalize,
  tokenize,
  fuzzyHas,
  roundHalf,
  scoreCriterionByKeywords,
  stepMarkByKeywords,
};
