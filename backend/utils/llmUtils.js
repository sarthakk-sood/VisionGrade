/**
 * Shared utilities for LLM provider interaction.
 * Used by both llmService.js and questionGenerationService.js.
 */

/** Groq free tier allows ~6000 tokens/request — keep input well under that. */
const GROQ_TOPIC_INPUT_CHARS = 8_000;
const GROQ_GENERATION_INPUT_CHARS = 10_000;

/**
 * Returns true for rate-limit / size-limit / temporary availability errors.
 */
const isQuotaError = (err) => {
  const msg    = (err?.message || '').toLowerCase();
  const status = err?.status || err?.statusCode || 0;
  return (
    status === 429 ||
    status === 413 ||
    status === 503 ||
    msg.includes('429') ||
    msg.includes('413') ||
    msg.includes('503') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('too large') ||
    msg.includes('high demand') ||
    msg.includes('unavailable')
  );
};

/**
 * Extracts "retry in Xs" delay from a Gemini 429 error message.
 * Returns milliseconds, capped at 20s so the full fallback chain
 * stays well within the 120s frontend timeout.
 */
const parseGeminiRetryDelay = (errMsg, attempt = 0) => {
  const match = (errMsg || '').match(/retry in\s+([\d.]+)s/i);
  if (match) return Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 500, 20_000);
  // 503 high-demand: short exponential backoff
  return Math.min(2_000 * (2 ** attempt), 15_000);
};

/** Simple promise-based sleep. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Strips markdown code fences that some LLMs add around JSON responses.
 */
const stripMarkdownFences = (raw) =>
  raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

/**
 * Truncate a single text: keep start + end so chapter headings and conclusions survive.
 */
const truncateText = (text, maxChars) => {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;

  const marker = '\n\n[... middle section omitted to fit model limits ...]\n\n';
  const budget = maxChars - marker.length;
  const head = Math.floor(budget * 0.65);
  const tail = budget - head;

  return normalized.slice(0, head) + marker + normalized.slice(-tail);
};

/**
 * Truncate multiple document texts to a shared character budget.
 */
const truncateDocuments = (texts, maxTotalChars) => {
  const valid = (texts || []).filter((t) => (t || '').trim().length > 0);
  if (!valid.length) return [];

  const perDoc = Math.max(1_500, Math.floor(maxTotalChars / valid.length));
  return valid.map((t, i) => {
    const truncated = truncateText(t, perDoc);
    if (t.length > perDoc) {
      console.warn(`[llmUtils] Document ${i + 1} truncated: ${t.length} → ${truncated.length} chars`);
    }
    return truncated;
  });
};

module.exports = {
  GROQ_TOPIC_INPUT_CHARS,
  GROQ_GENERATION_INPUT_CHARS,
  isQuotaError,
  parseGeminiRetryDelay,
  sleep,
  stripMarkdownFences,
  truncateText,
  truncateDocuments,
};
