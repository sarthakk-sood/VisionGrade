/**
 * Shared utilities for LLM provider interaction.
 * Used by both llmService.js and questionGenerationService.js.
 */

/** Groq free tier allows ~6000 tokens/request — keep input well under that. */
const GROQ_TOPIC_INPUT_CHARS = 8_000;
const GROQ_GENERATION_INPUT_CHARS = 10_000;

/**
 * Evidence budget for a single generation/answer batch.
 *
 * Generation and answering now send retrieved passages rather than a blind
 * slice of the whole PDF, and they send them a few questions at a time, so this
 * budget is spent entirely on text that is relevant to the batch at hand.
 */
const EVIDENCE_CHARS_PER_BATCH = Number(process.env.LLM_EVIDENCE_CHARS) || 9_000;

/** Smallest per-topic share worth sending — below this an excerpt lacks context. */
const MIN_EVIDENCE_CHARS_PER_TOPIC = 1_800;

/**
 * Gemini models tried in order on Groq failure. Override with comma-separated
 * GEMINI_MODELS in .env — e.g. gemini-3.5-flash-lite,gemini-2.5-flash
 */
const GEMINI_MODELS = (process.env.GEMINI_MODELS || 'gemini-2.5-flash')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Pause between generation batches to stay under Groq TPM on free tier. */
const LLM_BATCH_PAUSE_MS = Number(process.env.LLM_BATCH_PAUSE_MS) || 1_200;

/**
 * Groq model used across topic detection, question generation, and answers.
 *
 * Llama 3.x models were retired on many Groq accounts (Aug 2026). List models
 * available to your key with: node scripts/list-groq-models.js
 *
 * Override in .env — e.g. openai/gpt-oss-120b for higher quality.
 */
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

/** openai/gpt-oss-* on Groq spends completion tokens on internal reasoning before visible output. */
const isReasoningGroqModel = (model = GROQ_MODEL) => /gpt-oss|qwen/i.test(model || '');

/**
 * Completion token budget for Groq chat calls.
 * Reasoning models need headroom above the JSON output size or content comes back empty.
 */
const estimateGroqMaxTokens = (itemCount, { perItem = 900, floor = 4096, ceiling = 16384 } = {}) => {
  const outputBudget = perItem * Math.max(itemCount, 1) + 800;
  const reasoningHeadroom = isReasoningGroqModel() ? 3500 : 0;
  return Math.min(ceiling, Math.max(floor, outputBudget + reasoningHeadroom));
};

/**
 * Groq sometimes rejects response_format on larger JSON payloads (400
 * "Failed to validate JSON"). Treat that like a transient provider error.
 */
const isJsonValidationError = (err) => {
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status || err?.statusCode || 0;
  return (
    status === 400 &&
    (msg.includes('failed to validate json') ||
      msg.includes('failed to generate json') ||
      msg.includes('json_validate_failed') ||
      msg.includes('invalid json'))
  );
};

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

/** Groq returned 200 but the body was not usable JSON (common without strict json_object mode). */
const isLlmParseError = (err) => {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('not valid json') ||
    msg.includes('missing "questions"') ||
    msg.includes('missing "answers"') ||
    msg.includes('missing "topics"') ||
    msg.includes('returned an empty response')
  );
};

/** Errors where falling back to another provider makes sense. */
const isGroqFallbackError = (err) =>
  isQuotaError(err) || isJsonValidationError(err) || isLlmParseError(err);

/**
 * Groq chat completion expecting JSON output.
 * Tries strict json_object mode first; on validation failure retries once
 * without response_format so callers can parse the raw text.
 */
const groqChatJsonCompletion = async (groq, { model, temperature, max_tokens, messages }) => {
  const base = { model, temperature, max_tokens, messages };
  const create = (extra = {}) => groq.chat.completions.create({ ...base, ...extra });

  for (let pass = 0; pass < 2; pass++) {
    try {
      const response = await create(pass === 0 ? { response_format: { type: 'json_object' } } : {});
      const { content } = extractChatContent(response);
      if (content) return response;
      if (pass === 0) {
        console.warn('[llmUtils] Groq strict JSON mode returned empty content — retrying without response_format…');
        continue;
      }
    } catch (err) {
      if (pass === 0 && isJsonValidationError(err)) {
        console.warn('[llmUtils] Groq strict JSON mode failed — retrying without response_format…');
        continue;
      }
      throw err;
    }
  }

  throw new Error('Groq returned an empty response after retries');
};

/** Pull visible assistant text from a Groq/OpenAI-compatible chat response. */
const extractChatContent = (response) => {
  const choice = response?.choices?.[0];
  const msg = choice?.message || {};
  let content = String(msg.content || '').trim();

  if (!content) {
    const reasoning = String(msg.reasoning || msg.reasoning_content || '').trim();
    if (reasoning) {
      const start = reasoning.indexOf('{');
      const end = reasoning.lastIndexOf('}');
      if (start !== -1 && end > start) {
        content = reasoning.slice(start, end + 1);
      }
    }
  }

  return {
    content,
    finishReason: choice?.finish_reason || 'unknown',
    reasoningTokens: response?.usage?.completion_tokens_details?.reasoning_tokens || 0,
  };
};

/** Model unavailable, retired, or denied for this API key — try the next one. */
const isModelAccessError = (err) => {
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status || err?.statusCode || 0;
  return (
    status === 404 ||
    status === 403 ||
    msg.includes('not found') ||
    msg.includes('no longer available') ||
    msg.includes('permission_denied') ||
    msg.includes('denied access')
  );
};

/** @deprecated use isModelAccessError */
const isModelNotFoundError = isModelAccessError;

/**
 * Extract retry delay from Groq/Gemini rate-limit messages.
 * Handles "try again in 644ms" and "try again in 2.5s".
 */
const parseProviderRetryDelay = (errMsg, attempt = 0) => {
  const msMatch = (errMsg || '').match(/try again in\s+([\d.]+)\s*ms/i);
  if (msMatch) return Math.min(Math.ceil(parseFloat(msMatch[1])) + 300, 20_000);

  const secMatch = (errMsg || '').match(/try again in\s+([\d.]+)\s*s/i);
  if (secMatch) return Math.min(Math.ceil(parseFloat(secMatch[1]) * 1000) + 500, 20_000);

  return Math.min(2_000 * (2 ** attempt), 15_000);
};

/** @deprecated use parseProviderRetryDelay */
const parseGeminiRetryDelay = parseProviderRetryDelay;

/** Simple promise-based sleep. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Strips markdown code fences that some LLMs add around JSON responses.
 */
const stripMarkdownFences = (raw) =>
  raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

/**
 * Parse JSON from an LLM reply. Tolerates markdown fences and leading/trailing prose.
 */
const parseJsonFromLlm = (raw) => {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    throw new Error('LLM returned an empty response');
  }

  const cleaned = stripMarkdownFences(raw.trim());

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
  }

  throw new Error(`LLM response was not valid JSON: ${cleaned.slice(0, 300)}`);
};

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
  EVIDENCE_CHARS_PER_BATCH,
  MIN_EVIDENCE_CHARS_PER_TOPIC,
  GROQ_MODEL,
  GEMINI_MODELS,
  LLM_BATCH_PAUSE_MS,
  isReasoningGroqModel,
  estimateGroqMaxTokens,
  extractChatContent,
  isQuotaError,
  isJsonValidationError,
  isLlmParseError,
  isModelAccessError,
  isModelNotFoundError,
  isGroqFallbackError,
  groqChatJsonCompletion,
  parseProviderRetryDelay,
  parseGeminiRetryDelay,
  sleep,
  stripMarkdownFences,
  parseJsonFromLlm,
  truncateText,
  truncateDocuments,
};
