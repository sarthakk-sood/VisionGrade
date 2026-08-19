/**
 * Deterministic Module 2 marking: map OCR lines to question numbers, then
 * award marks from the answer key + marking-scheme keywords.
 */

const { resolveCriteria } = require('../utils/markingCriteria');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'for', 'in', 'on', 'at', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'this', 'that', 'with', 'from', 'by', 'as',
  'it', 'its', 'if', 'then', 'than', 'into', 'over', 'under', 'not', 'no', 'yes',
  'mark', 'marks', 'point', 'points', 'award', 'awarded', 'stating', 'naming',
  'explaining', 'explain', 'noting', 'describe', 'describing', 'including',
  'include', 'answer', 'student', 'provided', 'function', 'functions', 'due',
  'how', 'why', 'when', 'which', 'what', 'their', 'them', 'each', 'also', 'using',
  'used', 'use', 'role', 'purpose', 'given', 'following', 'would', 'could',
  'should', 'must', 'may', 'can', 'will', 'does', 'did', 'has', 'have', 'had',
]);

const MCQ_LETTER = /^[a-d]$/i;

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[–—]/g, '-')
  .replace(/o\s*\(\s*1\s*\)/g, ' o1 ')
  .replace(/-\s*1\b/g, ' minus1 ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenize = (value) => normalize(value)
  .split(' ')
  .filter((w) => w && (w.length > 2 || /^(o1|minus1)$/.test(w)) && !STOPWORDS.has(w));

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

const splitOcrByQuestion = (ocrText, questionNumbers) => {
  const text = String(ocrText || '');
  const allowed = new Set(questionNumbers.map(Number));
  const byQuestion = new Map(questionNumbers.map((n) => [Number(n), '']));
  // Multiline ^ so we do not swallow the newline after "Q4" and skip "Q5".
  const re = /^[ \t]*(?:q(?:uestion)?[ \t]*[.\-]?[ \t]*)(\d{1,2})\b[ \t]*[).:\-]*/gim;
  const matches = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    const n = Number(match[1]);
    if (!allowed.has(n)) continue;
    matches.push({ n, index: match.index, end: match.index + match[0].length });
  }

  const foundNumbers = new Set(matches.map((m) => m.n));
  if (!matches.length) {
    return { byQuestion, leftover: text.trim(), foundNumbers };
  }

  matches.sort((a, b) => a.index - b.index);
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end;
    const stop = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const chunk = text.slice(start, stop).trim();
    const prev = byQuestion.get(matches[i].n);
    byQuestion.set(matches[i].n, [prev, chunk].filter(Boolean).join('\n'));
  }

  return {
    byQuestion,
    leftover: text.slice(0, matches[0].index).trim(),
    foundNumbers,
  };
};

const isShortType = (type) => {
  const t = String(type || '').toLowerCase();
  return t.includes('mcq') || t.includes('fill');
};

const rebalanceSlices = (byQuestion, questions) => {
  const nums = questions.map((q) => Number(q.questionNumber)).sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    const q = questions.find((x) => Number(x.questionNumber) === nums[i]);
    if (!q || !isShortType(q.type)) continue;
    const text = byQuestion.get(nums[i]) || '';
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) continue;
    const nextEmpty = nums.slice(i + 1).find((n) => !(byQuestion.get(n) || '').trim());
    if (nextEmpty == null) continue;
    byQuestion.set(nums[i], lines[0]);
    byQuestion.set(nextEmpty, lines.slice(1).join('\n'));
  }
  return byQuestion;
};

const extractMcqLetter = (value) => {
  const raw = String(value || '').trim();
  const lead = raw.match(/^\s*(?:\(?\s*)([a-d])(?:\s*[).:]|\s|$)/i);
  if (lead) return lead[1].toLowerCase();
  const any = raw.match(/\b([a-d])\b/i);
  const normalized = normalize(raw);
  if (normalized.length === 1 && MCQ_LETTER.test(normalized)) return normalized;
  return any && normalize(raw).length <= 8 ? any[1].toLowerCase() : '';
};

const firstLine = (text) => String(text || '').split(/\n/).map((l) => l.trim()).filter(Boolean)[0] || '';

const scoreMcq = (question, studentText) => {
  const maxMarks = Number(question.marks) || 0;
  const keyLetter = extractMcqLetter(question.correctAnswer);
  const studentLetter = extractMcqLetter(firstLine(studentText) || studentText);
  const hay = normalize(studentText);
  const keyText = normalize(question.correctAnswer);

  if (keyLetter && studentLetter && keyLetter === studentLetter) {
    return { marks: maxMarks, coverage: 1, matchedKeywords: [keyLetter.toUpperCase()] };
  }
  if (keyText && hay.includes(keyText) && keyText.length > 2) {
    return { marks: maxMarks, coverage: 1, matchedKeywords: [keyText] };
  }
  const options = Array.isArray(question.options) ? question.options : [];
  if (keyLetter && options.length) {
    const idx = keyLetter.charCodeAt(0) - 97;
    const opt = options[idx] ? normalize(options[idx]) : '';
    if (opt && hay.includes(opt)) {
      return { marks: maxMarks, coverage: 1, matchedKeywords: [opt] };
    }
  }
  return { marks: 0, coverage: 0, matchedKeywords: [] };
};

const scoreFillIn = (question, studentText) => {
  const maxMarks = Number(question.marks) || 0;
  const keys = unique([
    ...tokenize(question.correctAnswer),
    ...tokenize(question.modelAnswer),
  ]);
  const hay = normalize(firstLine(studentText) || studentText);
  const hits = keys.filter((k) => fuzzyHas(hay, k));
  if (!keys.length) return { marks: 0, coverage: 0, matchedKeywords: [] };
  const coverage = hits.length / keys.length;
  const marks = coverage >= 0.5 || hits.length >= 1 && keys.length <= 2
    ? maxMarks
    : 0;
  return { marks, coverage, matchedKeywords: hits };
};

const scoreByScheme = (question, studentText) => {
  const maxMarks = Number(question.marks) || 0;
  const hay = normalize(studentText);
  const points = resolveCriteria(question).map((c) => ({ marks: c.marks, text: c.point }));
  const modelKeywords = unique([
    ...tokenize(question.correctAnswer),
    ...tokenize(question.modelAnswer),
  ]);

  let awarded = 0;
  const matchedKeywords = [];
  let hitCount = 0;
  let totalKw = 0;

  for (const point of points) {
    const pointKws = unique(tokenize(point.text));
    const kws = pointKws.length ? pointKws : modelKeywords;
    if (!kws.length) continue;
    totalKw += kws.length;
    const hits = kws.filter((k) => fuzzyHas(hay, k));
    hitCount += hits.length;
    matchedKeywords.push(...hits);
    const cov = hits.length / kws.length;
    if (cov >= 0.35 || hits.length >= Math.min(2, kws.length)) {
      awarded += Number(point.marks) || 0;
    } else if (hits.length >= 1) {
      awarded += (Number(point.marks) || 0) * 0.5;
    }
  }

  const allKws = unique([...modelKeywords, ...tokenize(question.markingScheme)]);
  const allHits = allKws.filter((k) => fuzzyHas(hay, k));
  const overall = allKws.length ? allHits.length / allKws.length : 0;
  const proportional = Math.round(overall * maxMarks * 2) / 2;
  awarded = Math.max(awarded, proportional);
  awarded = Math.max(0, Math.min(maxMarks, Math.round(awarded * 2) / 2));

  return {
    marks: awarded,
    coverage: Number(overall.toFixed(2)),
    matchedKeywords: unique([...matchedKeywords, ...allHits]),
    hitCount,
    totalKw,
  };
};

const pickStudentAnswer = (question, byQuestion, leftover, fullText, foundNumbers) => {
  const n = Number(question.questionNumber);
  const slice = (byQuestion.get(n) || '').trim();
  if (slice) return slice;
  // A blank "Q4" on the sheet is a non-attempt — do not score the rest of the page.
  if (foundNumbers && foundNumbers.size > 0) return '';

  const type = String(question.type || '').toLowerCase();
  if (type.includes('mcq')) {
    const lines = String(fullText || '').split(/\n/).map((l) => l.trim()).filter(Boolean);
    const lone = lines.find((l) => /^[a-d][).:]?\s*$/i.test(l));
    return lone || '';
  }
  if (type.includes('fill')) {
    return '';
  }
  return leftover || fullText || '';
};

const describeFeedback = (question, result, studentAnswer) => {
  if (!String(studentAnswer || '').trim()) {
    return 'No answer found for this question number on the sheet.';
  }
  if (result.marks <= 0) {
    return 'Answer located, but it does not match the answer key or marking-scheme keywords.';
  }
  const kws = (result.matchedKeywords || []).slice(0, 8).join(', ');
  const scheme = question.markingScheme
    ? ' Marked from the scheme/answer key.'
    : '';
  return kws
    ? `Awarded ${result.marks}/${question.marks} from keyword overlap (${kws}).${scheme}`
    : `Awarded ${result.marks}/${question.marks} against the answer key.${scheme}`;
};

const formatMappedOcr = (rows) => rows
  .map((r) => `Q${r.questionNumber}: ${r.studentAnswer || '(blank)'}`)
  .join('\n');

/**
 * @param {Array} questions session.questions
 * @param {string} ocrText
 */
const gradeByKeywords = (questions, ocrText) => {
  const nums = questions.map((q) => Number(q.questionNumber));
  const { byQuestion, leftover, foundNumbers } = splitOcrByQuestion(ocrText, nums);
  rebalanceSlices(byQuestion, questions);
  const fullText = String(ocrText || '');

  const evaluations = questions.map((q) => {
    const studentAnswer = pickStudentAnswer(q, byQuestion, leftover, fullText, foundNumbers);
    const type = String(q.type || '').toLowerCase();
    let scored;
    if (type.includes('mcq')) {
      scored = scoreMcq(q, studentAnswer);
    } else if (type.includes('fill')) {
      scored = scoreFillIn(q, studentAnswer);
    } else {
      scored = scoreByScheme(q, studentAnswer);
    }

    const attempted = Boolean(String(studentAnswer || '').trim());
    const marksAwarded = attempted ? scored.marks : 0;

    return {
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      modelAnswer: q.modelAnswer || '',
      studentAnswer,
      maxMarks: Number(q.marks) || 0,
      marksAwarded,
      keywordCoverage: attempted ? scored.coverage : 0,
      semanticScore: attempted ? scored.coverage : 0,
      matchedKeywords: scored.matchedKeywords || [],
      strengths: (scored.matchedKeywords || []).slice(0, 6),
      weaknesses: marksAwarded < (Number(q.marks) || 0)
        ? ['Missing marking-scheme points']
        : [],
      feedback: describeFeedback(q, { ...scored, marks: marksAwarded }, studentAnswer),
    };
  });

  return {
    evaluations,
    mappedOcr: formatMappedOcr(evaluations),
  };
};

module.exports = {
  gradeByKeywords,
  splitOcrByQuestion,
  parseSchemePoints,
  normalize,
};
