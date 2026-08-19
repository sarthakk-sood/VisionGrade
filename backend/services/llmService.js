const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const {
  GROQ_TOPIC_INPUT_CHARS,
  GROQ_MODEL,
  GEMINI_MODELS,
  OPENROUTER_MODEL,
  getOpenRouter,
  hasOpenRouter,
  groqChatJsonCompletion,
  extractChatContent,
  isModelAccessError,
  isQuotaError,
  parseProviderRetryDelay,
  sleep,
  truncateDocuments,
} = require('../utils/llmUtils');

// ─────────────────────────────────────────────────────────────────────────────
// Lazy clients — only instantiated on first use so a missing key only throws
// at call-time, not at server startup.
// ─────────────────────────────────────────────────────────────────────────────
let _groq = null;
const getGroq = () => {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _groq;
};

let _geminiClient = null;
const getGemini = () => {
  if (!_geminiClient) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === '...') {
      throw new Error('GEMINI_API_KEY is not set — cannot fall back to Gemini');
    }
    _geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _geminiClient;
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PROMPT TEMPLATE
// Used by both Groq and Gemini so behaviour is identical regardless of which
// LLM handles the request.
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_DETECTION_SYSTEM_PROMPT = `You are an expert educational content analyst specializing in curriculum design and academic assessment.

Your task is to analyze the provided text extracted from one or more academic PDF documents (textbooks, lecture notes, study materials, etc.) and extract a structured list of distinct, teachable topics that a teacher could use to build a question paper.

## Rules for Topic Extraction

1. **Educational relevance**: Only extract topics that represent concrete, examinable concepts — NOT structural elements like "Introduction", "Summary", "References", "Table of Contents", or page numbers.

2. **Granularity**: Aim for topics at the chapter-section level. Each topic should be broad enough to generate at least 2–3 exam questions, but specific enough to be meaningful (e.g., "Normalization in Relational Databases" is good; "Databases" alone is too vague).

3. **Deduplication**: If the same concept appears multiple times across documents, list it only once with the most descriptive name.

4. **Limit**: Return between 5 and 30 topics. Never exceed 30.

5. **No filtering by subject**: You MUST extract all valid, teachable topics present in the text, even if they seem unrelated to the provided subject hint. Do not skip topics just because they do not match the expected subject.

6. **No hallucination**: Only extract topics actually present in the provided text.

7. **Topic name**: Short, clear, title-case phrase (3–8 words ideal).

8. **Description**: 1–2 sentence plain-English description of what the topic covers, written for a teacher reviewing their syllabus.

## Output Format

Return ONLY a valid JSON object — no markdown fences, no explanation:

{
  "subject": "<inferred subject/course name, or null if unclear>",
  "totalTopicsFound": <integer>,
  "topics": [
    {
      "id": <integer starting from 1>,
      "name": "<Topic Name>",
      "description": "<1-2 sentence description>",
      "keywords": ["<keyword1>", "<keyword2>", "<keyword3>"]
    }
  ]
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Build the user-facing prompt (shared by both providers)
// ─────────────────────────────────────────────────────────────────────────────
const buildUserPrompt = (extractedTexts, subject) => {
  const subjectHint = subject
    ? `Hint: The user described this as: "${subject}". However, extract ALL teachable topics you find in the text, regardless of this hint.`
    : 'The subject of the document(s) is unknown — infer it from the content.';

  const truncatedTexts = truncateDocuments(extractedTexts, GROQ_TOPIC_INPUT_CHARS);
  const combinedText = truncatedTexts
    .map((t, i) => `=== DOCUMENT ${i + 1} ===\n${t}`)
    .join('\n\n');

  return `${subjectHint}\n\nPlease analyse the following extracted PDF text and return the topic list as specified:\n\n${combinedText}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Normalise the raw JSON string returned by either LLM into a clean object
// ─────────────────────────────────────────────────────────────────────────────
const parseTopicsResponse = (raw) => {
  // Strip markdown code fences if present (Gemini sometimes adds them)
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM response was not valid JSON: ${cleaned.slice(0, 300)}`);
  }

  if (!Array.isArray(parsed.topics)) {
    throw new Error('LLM response is missing "topics" array');
  }

  return {
    subject: parsed.subject || null,
    totalTopicsFound: parsed.totalTopicsFound || parsed.topics.length,
    topics: parsed.topics.map((t, idx) => ({
      id: t.id ?? idx + 1,
      name: t.name ?? `Topic ${idx + 1}`,
      description: t.description ?? '',
      keywords: Array.isArray(t.keywords) ? t.keywords : [],
    })),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Returns true for rate-limit / size-limit / temporary availability errors
// ─────────────────────────────────────────────────────────────────────────────

const detectTopicsWithGroq = async (extractedTexts, subject) => {
  const groq = getGroq();
  const userPrompt = buildUserPrompt(extractedTexts, subject);

  // Up to 30 topics can come back (see prompt rules) — 1536 tokens was cutting
  // the JSON off mid-array on documents that yield many topics.
  const response = await groqChatJsonCompletion(groq, {
    model: GROQ_MODEL,
    temperature: 0.2,
    max_tokens: 3072,
    messages: [
      { role: 'system', content: TOPIC_DETECTION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const { content: raw, finishReason } = extractChatContent(response);
  if (!raw) throw new Error('Groq returned an empty response');
  if (finishReason === 'length') {
    // Response was cut off before the JSON closed — retrying the same
    // request won't help much, so surface this as a fallback-worthy error
    // instead of a confusing "invalid JSON" message.
    throw new Error('Groq response truncated before completing (finish_reason: length) — too many topics for the token budget');
  }

  const result = parseTopicsResponse(raw);
  return {
    ...result,
    provider: `groq-${GROQ_MODEL}`,
    usage: {
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Gemini call — accepts any model name so we can try multiple
// Uses the new @google/genai SDK (same one that works in test.js)
// ─────────────────────────────────────────────────────────────────────────────
const callGeminiModel = async (modelName, extractedTexts, subject) => {
  const ai = getGemini();
  const userPrompt = buildUserPrompt(extractedTexts, subject);
  const fullPrompt = `${TOPIC_DETECTION_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;

  const result = await ai.models.generateContent({
    model: modelName,
    contents: fullPrompt,
  });

  const raw = result.text;
  if (!raw) throw new Error(`Gemini (${modelName}) returned an empty response`);

  const parsed = parseTopicsResponse(raw);
  return { ...parsed, provider: modelName, usage: null };
};

// ─────────────────────────────────────────────────────────────────────────────
// Gemini fallback — tries models in order, with auto-retry on 429
//
// Strategy:
// Gemini fallback — tries models in order, with auto-retry on 429.
// Default: gemini-2.5-flash (override via GEMINI_MODELS in .env).
// ─────────────────────────────────────────────────────────────────────────────
const detectTopicsWithGemini = async (extractedTexts, subject) => {
  let lastErr;

  for (const modelName of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[llmService] Trying Gemini model: ${modelName} (attempt ${attempt + 1})…`);
        const result = await callGeminiModel(modelName, extractedTexts, subject);
        return result;
      } catch (err) {
        lastErr = err;
        if (isModelAccessError(err)) {
          console.warn(`[llmService] ${modelName} unavailable, trying next model…`);
          break;
        }
        if (!isQuotaError(err)) {
          throw err;
        }

        const retryMs = parseProviderRetryDelay(err.message, attempt);
        console.warn(`[llmService] ${modelName} unavailable/rate-limited. Waiting ${Math.round(retryMs / 1000)}s…`);
        await sleep(retryMs);
      }
    }
    console.warn(`[llmService] ${modelName} exhausted — trying next model`);
  }

  throw lastErr;
};

// ─────────────────────────────────────────────────────────────────────────────
// OpenRouter fallback — third tier, used when both Groq and Gemini are
// rate-limited/unavailable. OpenAI-compatible chat.completions API.
// ─────────────────────────────────────────────────────────────────────────────
const detectTopicsWithOpenRouter = async (extractedTexts, subject) => {
  const openrouter = getOpenRouter();
  const userPrompt = buildUserPrompt(extractedTexts, subject);

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await openrouter.chat.completions.create({
        model: OPENROUTER_MODEL,
        temperature: 0.2,
        max_tokens: 3072,
        messages: [
          { role: 'system', content: TOPIC_DETECTION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
      const { content, finishReason } = extractChatContent(response);
      if (!content) throw new Error('OpenRouter returned an empty response');
      if (finishReason === 'length') {
        throw new Error('OpenRouter response truncated before completing (finish_reason: length)');
      }
      const result = parseTopicsResponse(content);
      return { ...result, provider: `openrouter-${OPENROUTER_MODEL}`, usage: null };
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err) || attempt === 2) throw err;
      await sleep(parseProviderRetryDelay(err.message, attempt));
    }
  }
  throw lastErr;
};

// ─────────────────────────────────────────────────────────────────────────────
// detectTopics  —  PUBLIC API
//
// Tries Groq first. On a 429 quota error it automatically falls back to
// Gemini, then to OpenRouter if that also fails. Any other error is re-thrown.
//
//   extractedTexts : string[]  — one entry per source document
//   subject        : string    — optional hint (e.g. "Data Structures")
//   Returns        : { subject, totalTopicsFound, topics, provider, usage }
// ─────────────────────────────────────────────────────────────────────────────
const detectTopics = async (extractedTexts, subject = '') => {
  try {
    console.log('[llmService] Attempting topic detection with Groq…');
    const result = await detectTopicsWithGroq(extractedTexts, subject);
    console.log(`[llmService] Groq succeeded — ${result.topics.length} topics found`);
    return result;

  } catch (groqErr) {
    const truncated = (groqErr.message || '').includes('truncated');
    if (!isQuotaError(groqErr) && !truncated) throw groqErr;

    console.warn(`[llmService] Groq ${truncated ? 'response truncated' : 'quota exceeded (429)'}. Falling back to Gemini…`);
    try {
      const result = await detectTopicsWithGemini(extractedTexts, subject);
      console.log(`[llmService] Gemini fallback succeeded — ${result.topics.length} topics found`);
      return result;
    } catch (geminiErr) {
      if (!hasOpenRouter()) {
        throw new Error(
          `Both LLM providers failed.\n• Groq: ${groqErr.message}\n• Gemini: ${geminiErr.message}`
        );
      }
      console.warn('[llmService] Gemini fallback also failed. Trying OpenRouter…', geminiErr.message);
      try {
        const result = await detectTopicsWithOpenRouter(extractedTexts, subject);
        console.log(`[llmService] OpenRouter fallback succeeded — ${result.topics.length} topics found`);
        return result;
      } catch (openrouterErr) {
        throw new Error(
          `All LLM providers failed.\n• Groq: ${groqErr.message}\n• Gemini: ${geminiErr.message}\n• OpenRouter: ${openrouterErr.message}`
        );
      }
    }
  }
};

module.exports = { detectTopics };
