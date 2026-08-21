/**
 * Retrieval over uploaded PDF text.
 *
 * Question generation used to receive a blind head+tail slice of each PDF, so
 * anything in the middle of a document was invisible to the LLM and it filled
 * the gaps with generic textbook knowledge. This module instead splits the
 * documents into small passages, ranks them against a topic or question with
 * BM25, and hands the LLM only the passages that actually discuss it.
 *
 * It also verifies, after the fact, that a quote the LLM claims to have used
 * really exists in the uploaded text — which is what makes "PDF specific"
 * enforceable rather than merely requested.
 */

const CHUNK_CHARS = 900;
const CHUNK_OVERLAP = 150;

// BM25 parameters — standard defaults.
const K1 = 1.5;
const B = 0.75;

/** Shingle width (in words) used when checking a quote against the corpus. */
const SHINGLE_WORDS = 8;

/** Fraction of a quote's shingles that must be found for it to count as grounded. */
const GROUNDING_THRESHOLD = 0.6;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our',
  'out', 'his', 'has', 'had', 'they', 'this', 'that', 'with', 'from', 'have', 'been', 'were',
  'what', 'when', 'where', 'which', 'while', 'their', 'there', 'these', 'those', 'them', 'then',
  'than', 'into', 'onto', 'upon', 'over', 'under', 'such', 'some', 'each', 'other', 'about',
  'also', 'more', 'most', 'much', 'many', 'very', 'only', 'both', 'because', 'however',
  'therefore', 'thus', 'hence', 'shall', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'does', 'did', 'done', 'being', 'its', 'itself', 'who', 'whom', 'whose', 'how',
  'why', 'any', 'per', 'via', 'etc', 'eg', 'ie', 'let', 'use', 'used', 'using', 'given',
  'above', 'below', 'between', 'following', 'follows', 'example', 'examples', 'chapter',
  'section', 'page', 'figure', 'table', 'note', 'notes',
]);

const normalizeWhitespace = (text) => (text || '').replace(/\s+/g, ' ').trim();

/** Lowercase, strip punctuation — used for quote matching, not for scoring. */
const normalizeForMatch = (text) =>
  (text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const tokenize = (text) =>
  normalizeForMatch(text)
    .split(' ')
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));

// ─────────────────────────────────────────────────────────────────────────────
// Chunking
// ─────────────────────────────────────────────────────────────────────────────

/** Split on sentence-ish boundaries. Extracted PDF text is one long line. */
const splitIntoSentences = (text) => text.split(/(?<=[.!?;])\s+/).filter(Boolean);

/** Trim a leading partial word so overlapped chunks still read cleanly. */
const trimToWordStart = (text) => {
  const spaceIdx = text.indexOf(' ');
  return spaceIdx > 0 && spaceIdx < 25 ? text.slice(spaceIdx + 1) : text;
};

const chunkText = (rawText, meta) => {
  const clean = normalizeWhitespace(rawText);
  if (!clean) return [];

  const chunks = [];
  const push = (text) => {
    const trimmed = text.trim();
    if (trimmed.length >= 60) chunks.push({ ...meta, text: trimmed });
  };

  let buffer = '';

  for (const rawSentence of splitIntoSentences(clean)) {
    let sentence = rawSentence;

    // Tables / heading runs can arrive with no punctuation at all — hard split.
    while (sentence.length > CHUNK_CHARS) {
      if (buffer) {
        push(buffer);
        buffer = '';
      }
      push(sentence.slice(0, CHUNK_CHARS));
      sentence = trimToWordStart(sentence.slice(CHUNK_CHARS - CHUNK_OVERLAP));
    }

    if (buffer && `${buffer} ${sentence}`.length > CHUNK_CHARS) {
      push(buffer);
      buffer = `${trimToWordStart(buffer.slice(-CHUNK_OVERLAP))} ${sentence}`.trim();
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    }
  }

  push(buffer);
  return chunks;
};

// ─────────────────────────────────────────────────────────────────────────────
// Corpus construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a searchable corpus from uploaded documents.
 *
 * @param {Array<{filename?: string, pages?: Array<{num: number, text: string}>, extractedText?: string}>} documents
 */
const buildCorpus = (documents = []) => {
  const chunks = [];

  documents.forEach((doc, docIndex) => {
    const filename = doc.filename || `Document ${docIndex + 1}`;
    const pages = Array.isArray(doc.pages) && doc.pages.length ? doc.pages : null;

    if (pages) {
      pages.forEach((p) => {
        chunks.push(...chunkText(p.text, { docIndex, filename, page: p.num ?? null }));
      });
    } else {
      chunks.push(...chunkText(doc.extractedText, { docIndex, filename, page: null }));
    }
  });

  const df = new Map();

  chunks.forEach((chunk, i) => {
    chunk.id = i + 1;
    const tokens = tokenize(chunk.text);
    chunk.length = tokens.length;
    chunk.tf = new Map();
    tokens.forEach((t) => chunk.tf.set(t, (chunk.tf.get(t) || 0) + 1));
    chunk.norm = normalizeForMatch(chunk.text);
    chunk.tf.forEach((_, term) => df.set(term, (df.get(term) || 0) + 1));
  });

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);

  return {
    chunks,
    df,
    size: chunks.length,
    avgLen: chunks.length ? totalLength / chunks.length : 1,
    // Single normalized haystack for quote verification.
    normFull: chunks.map((c) => c.norm).join(' \u0000 '),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Scoring / retrieval
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Array<{text: string, weight?: number}>} parts
 * @returns {Map<string, number>} term → accumulated query weight
 */
const buildQueryTokens = (parts = []) => {
  const weights = new Map();
  parts.forEach(({ text, weight = 1 }) => {
    tokenize(text).forEach((term) => {
      weights.set(term, (weights.get(term) || 0) + weight);
    });
  });
  return weights;
};

const scoreChunk = (corpus, chunk, queryTokens) => {
  let score = 0;
  for (const [term, qWeight] of queryTokens) {
    const f = chunk.tf.get(term);
    if (!f) continue;
    const n = corpus.df.get(term) || 0;
    const idf = Math.log(1 + (corpus.size - n + 0.5) / (n + 0.5));
    const denom = f + K1 * (1 - B + B * (chunk.length / (corpus.avgLen || 1)));
    score += qWeight * idf * ((f * (K1 + 1)) / denom);
  }
  return score;
};

const toEvidence = (chunk, score) => ({
  id: chunk.id,
  docIndex: chunk.docIndex,
  filename: chunk.filename,
  page: chunk.page,
  text: chunk.text,
  score: Number(score.toFixed(3)),
});

/**
 * Rank passages against a weighted query and return the best ones that fit
 * inside a character budget.
 *
 * @param {object} corpus       result of buildCorpus
 * @param {Array}  queryParts   [{ text, weight }]
 * @param {object} options      { maxChars, maxChunks, excludeIds }
 */
const retrieve = (corpus, queryParts, { maxChars = 4000, maxChunks = 6, excludeIds } = {}) => {
  if (!corpus?.chunks?.length) return [];

  const skip = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || []);
  const queryTokens = buildQueryTokens(queryParts);
  const available = corpus.chunks.filter((c) => !skip.has(c.id));

  // A query with no distinctive terms (or an unusual corpus) still deserves
  // real source text rather than nothing at all.
  const ranked = queryTokens.size
    ? available
        .map((chunk) => ({ chunk, score: scoreChunk(corpus, chunk, queryTokens) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
    : available.map((chunk) => ({ chunk, score: 0 }));

  const pool = ranked.length ? ranked : available.map((chunk) => ({ chunk, score: 0 }));

  const picked = [];
  let chars = 0;

  for (const { chunk, score } of pool) {
    if (picked.length >= maxChunks) break;
    if (picked.length && chars + chunk.text.length > maxChars) continue;
    picked.push(toEvidence(chunk, score));
    chars += chunk.text.length;
  }

  return picked;
};

// ─────────────────────────────────────────────────────────────────────────────
// Grounding verification
// ─────────────────────────────────────────────────────────────────────────────

const shingles = (words, width) => {
  if (words.length <= width) return [words.join(' ')];
  const out = [];
  for (let i = 0; i + width <= words.length; i++) out.push(words.slice(i, i + width).join(' '));
  return out;
};

/**
 * Check whether a quote the LLM attributed to the source really appears there.
 *
 * Compares word shingles rather than the raw string so that harmless
 * reformatting (whitespace, punctuation, an ellipsis) does not read as a
 * fabrication, while invented sentences still fail.
 *
 * @returns {{grounded: boolean, coverage: number, chunk: object|null}}
 */
const verifyQuote = (corpus, quote) => {
  const words = normalizeForMatch(quote).split(' ').filter(Boolean);
  if (!corpus?.normFull || words.length < 4) {
    return { grounded: false, coverage: 0, chunk: null };
  }

  const probes = shingles(words, SHINGLE_WORDS);
  let hits = 0;
  let firstHit = null;

  for (const probe of probes) {
    if (corpus.normFull.includes(probe)) {
      hits += 1;
      if (!firstHit) firstHit = probe;
    }
  }

  const coverage = probes.length ? hits / probes.length : 0;
  const grounded = coverage >= GROUNDING_THRESHOLD;

  const chunk = firstHit
    ? corpus.chunks.find((c) => c.norm.includes(firstHit)) || null
    : null;

  return { grounded, coverage: Number(coverage.toFixed(2)), chunk };
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt formatting
// ─────────────────────────────────────────────────────────────────────────────

const evidenceLabel = (evidence) =>
  evidence.page ? `${evidence.filename}, page ${evidence.page}` : evidence.filename;

/** Render retrieved passages as labelled excerpts for a prompt. */
const formatEvidenceBlock = (evidenceList, prefix = 'E') =>
  evidenceList
    .map((e, i) => `[${prefix}${i + 1} — ${evidenceLabel(e)}]\n${e.text}`)
    .join('\n\n');

/**
 * Accept either document objects or bare extracted-text strings, so callers
 * that predate per-page storage keep working.
 */
const normalizeDocuments = (input = []) =>
  (input || [])
    .map((doc) => (typeof doc === 'string' ? { extractedText: doc } : doc || {}))
    .filter((doc) => (doc.extractedText || '').trim().length || doc.pages?.length);

module.exports = {
  buildCorpus,
  retrieve,
  verifyQuote,
  formatEvidenceBlock,
  evidenceLabel,
  normalizeDocuments,
  normalizeForMatch,
  tokenize,
};
