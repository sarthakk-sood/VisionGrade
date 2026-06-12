/**
 * Shared utilities for LLM provider interaction.
 * Used by both llmService.js and questionGenerationService.js.
 */

/**
 * Returns true for HTTP 429 / 413 quota-exceeded errors from Groq or Gemini.
 */
const isQuotaError = (err) => {
  const msg    = (err?.message || '').toLowerCase();
  const status = err?.status || err?.statusCode || 0;
  return (
    status === 429 ||
    status === 413 ||
    msg.includes('429') ||
    msg.includes('413') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
};

/**
 * Extracts "retry in Xs" delay from a Gemini 429 error message.
 * Returns milliseconds, capped at 20s so the full fallback chain
 * stays well within the 120s frontend timeout.
 */
const parseGeminiRetryDelay = (errMsg) => {
  const match = (errMsg || '').match(/retry in\s+([\d.]+)s/i);
  const suggested = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 20_000;
  return Math.min(suggested, 20_000); // hard cap at 20s
};

/** Simple promise-based sleep. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Strips markdown code fences that some LLMs add around JSON responses.
 */
const stripMarkdownFences = (raw) =>
  raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

module.exports = { isQuotaError, parseGeminiRetryDelay, sleep, stripMarkdownFences };
