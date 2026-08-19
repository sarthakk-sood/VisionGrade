const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const {
  EVIDENCE_CHARS_PER_BATCH,
  MIN_EVIDENCE_CHARS_PER_TOPIC,
  GROQ_MODEL,
  GEMINI_MODELS,
  OPENROUTER_MODEL,
  getOpenRouter,
  hasOpenRouter,
  isSizeLimitError,
  LLM_BATCH_PAUSE_MS,
  groqChatJsonCompletion,
  isJsonValidationError,
  isLlmParseError,
  isModelAccessError,
  isQuotaError,
  estimateGroqMaxTokens,
  extractChatContent,
  parseJsonFromLlm,
  parseProviderRetryDelay,
  sleep,
} = require('../utils/llmUtils');
const { buildQuestionPlan, batchPlan, typeRank } = require('../utils/questionPlan');
const {
  buildCorpus,
  retrieve,
  verifyQuote,
  formatEvidenceBlock,
  normalizeDocuments,
} = require('./retrievalService');

/** Total extra LLM calls allowed for re-grounding, across one whole run. */
const MAX_REGROUND_CALLS = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Lazy clients
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
      throw new Error('GEMINI_API_KEY is not set');
    }
    _geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _geminiClient;
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — Question Generation
//
// The model receives a fixed plan (type/marks/difficulty already decided) plus
// verbatim excerpts retrieved for the topic, so the only task left is writing a
// question about those excerpts. Everything here exists to stop it answering
// from general subject knowledge instead.
// ─────────────────────────────────────────────────────────────────────────────
const QUESTION_GENERATION_SYSTEM_PROMPT = `You are a senior university examiner setting a formal end-semester examination paper for undergraduate students. Questions must match the rigour, depth and wording style of a real university exam — not a school quiz, not a textbook exercise, and not a generic AI summary.

For each topic you receive VERBATIM EXCERPTS from the teacher's uploaded course documents and an exact PLAN (type, marks, difficulty per question). Turn those excerpts into exam-ready questions that a subject expert would approve.

## Absolute rules (grounding)

1. GROUNDING. Every question must be answerable using ONLY the excerpts for its topic. Use the documents' definitions, notation, symbols, numbers, named examples, algorithms, theorems and worked cases exactly as written.

2. NO OUTSIDE KNOWLEDGE. Never introduce facts, figures, formulas or terms absent from the excerpts. If material is thin, test the most technical detail that IS present — never pad with textbook generalities.

3. EVIDENCE. Set "sourceEvidence" to 15-40 consecutive words copied EXACTLY from one excerpt — the span the question tests. Never paraphrase or stitch spans. This is verified against the original PDF.

4. SELF-CONTAINED. Write as for a printed exam paper. Never say "the document", "the excerpt", "according to the passage", or cite page numbers. Embed any needed context inside the question.

5. DISTINCT COVERAGE. Each question tests a different concept and draws from a different part of the excerpts.

6. FOLLOW THE PLAN. Return exactly one question per plan entry, matched by "planIndex". Do not change type, marks or difficulty.

## University-level quality (mandatory)

Write questions that require genuine understanding of THIS course material, at the cognitive level implied by the marks:

- 1 mark: precise identification, classification, or a single-step consequence — never vague "define and explain".
- 2-3 marks: explain a mechanism, apply a stated rule to a concrete case from the excerpts, or interpret a given expression/structure.
- 4-5+ marks: multi-part reasoning — compare two approaches, derive steps, analyse trade-offs, or solve a structured problem using notation and examples from the text.

Use formal command words where appropriate: "State", "Derive", "Justify", "Compare", "Analyse", "Calculate", "Prove", "Discuss the limitation of", "Which of the following is the MOST accurate".

### REJECT these weak patterns (automatic failure)
- "What is X?" / "Define X" / "Explain the importance of X" with no concrete anchor from the excerpts
- MCQs where three options are obviously wrong filler
- Questions answerable from general knowledge without reading the course notes
- True/false disguised as MCQ ("X is true/false")
- Copying a sentence from the excerpt and blanking one word unless it is a genuine FillInTheBlanks

### ACCEPT patterns (aim for these)
- Scenario stem using names, values, relations or architectures FROM the excerpts, then ask for the consequence, correction or best choice
- "Given [specific setup from text], determine / explain / compare …"
- MCQ where all four options use terminology from the same topic and the correct answer requires understanding, not recognition of a definition heading
- Multi-part LongAnswer: "(a) … (b) … (c) …" each part tied to a distinct detail in the excerpts

Example — REJECTED: "What is self-attention?"
Example — ACCEPTED: "In the encoder stack described, queries, keys and values all originate from the output of the previous layer. What property of self-attention does this arrangement enable compared with a fixed convolutional filter?"

## Type requirements

- MCQ: exactly 4 options "A." … "D.". Exactly one correct. All distractors must be plausible to a student who skimmed the topic — use related terms, common confusions, or partial truths from the excerpts. Prefer applied or "best answer" stems over bare recall. correctAnswer is the single letter.

- FillInTheBlanks: one "______" in a sentence built from excerpt context; test a technical term, symbol, constant or relationship. correctAnswer is the exact missing word or short phrase.

- ShortAnswer (typically 2-3 marks): requires 2-4 substantive sentences — a definition PLUS a consequence, OR an application to a case in the excerpts. correctAnswer lists the key points an examiner would expect.

- MediumAnswer (typically 3-4 marks): one structured response (~80-120 words) — explain a process, derive a result, or compare two items using excerpt-specific details. correctAnswer is an outline of expected paragraphs/points.

- LongAnswer (typically 5+ marks): explicitly multi-part "(a) (b) (c)" when marks ≥ 5. May require derivation, step-by-step algorithm, diagram description, or critical comparison — all grounded in the excerpts. correctAnswer outlines the full expected structure with partial-credit sub-points.

## Difficulty calibration

- Easy: targeted recall of a specific stated fact, symbol or named example — still anchored to excerpt details, not generic.
- Medium: apply or explain a mechanism, interpret a formula/example, or discriminate between closely related concepts in the text.
- Hard: synthesise across multiple points in the excerpts — compare, analyse limitations, multi-step reasoning, or edge cases explicitly discussed in the material.

## Output

Return ONLY valid JSON — no markdown fences, no commentary:

{
  "questions": [
    {
      "planIndex": <integer>,
      "questionText": "<exam question>",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."] or null,
      "correctAnswer": "<letter for MCQ, else model answer>",
      "explanation": "<1-2 sentences for the teacher>",
      "sourceEvidence": "<15-40 verbatim words from an excerpt>"
    }
  ]
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Prompt building
// ─────────────────────────────────────────────────────────────────────────────

const describeTopic = (topic) => {
  const bits = [];
  if (topic.description) bits.push(`Scope: ${topic.description}`);
  if (topic.keywords?.length) bits.push(`Key terms: ${topic.keywords.join(', ')}`);
  return bits.length ? `\n${bits.join('\n')}` : '';
};

/** Per-entry quality directive so marks and type drive university-level depth. */
const qualityHint = (type, marks, difficulty) => {
  const m = Number(marks) || 1;
  const parts = [];

  if (type === 'MCQ') {
    if (m >= 2 || difficulty === 'Hard') {
      parts.push('Stem: mini-scenario or "best/most accurate" wording using concrete details from the excerpts');
      parts.push('Distractors: four plausible options — near-misses, partial truths, or confusable terms from the same topic');
    } else {
      parts.push('Avoid bare "What is …?" — test application of a specific fact, constraint or relationship from the text');
      parts.push('All four options must be technically plausible');
    }
  } else if (type === 'FillInTheBlanks') {
    parts.push('Blank a technical term, symbol, constant or relationship embedded in a sentence from the material');
  } else if (type === 'ShortAnswer') {
    parts.push(`~${Math.max(2, m)} marks: 2-4 sentences — state AND apply/explain, not definition-only`);
  } else if (type === 'MediumAnswer') {
    parts.push(`${m} marks: structured paragraph (~80-120 words) — mechanism, derivation or comparison using excerpt-specific notation/examples`);
  } else if (type === 'LongAnswer') {
    parts.push(`${m} marks: multi-part (a)(b)(c) — derivation, algorithm steps, or critical analysis grounded in the excerpts`);
  }

  if (difficulty === 'Hard') {
    parts.push('Require synthesis or comparison across multiple points in the excerpts');
  } else if (difficulty === 'Medium') {
    parts.push('Require explanation or application, not single-word recall');
  }

  return parts.join('; ');
};

const formatExamContext = (examInfo) => {
  const lines = [
    `Exam: ${examInfo.examTitle || 'End-Semester Examination'}`,
    `Subject: ${examInfo.subject || 'General'}`,
    `Total marks: ${examInfo.totalMarks || '—'}`,
  ];
  if (examInfo.durationMinutes) {
    lines.push(`Duration: ${examInfo.durationMinutes} minutes (questions must be completable in this time)`);
  }
  if (examInfo.instructions?.length) {
    lines.push(`Instructions: ${examInfo.instructions.join('; ')}`);
  }
  return lines.join('\n');
};

/**
 * Render one batch: per topic, the plan entries followed by that topic's
 * retrieved excerpts.
 */
const buildBatchPrompt = (batch, examInfo, planOffset) => {
  let planIndex = planOffset;

  const topicBlocks = batch.map((entry, t) => {
    const lines = entry.questions.map((q) => {
      planIndex += 1;
      const hint = qualityHint(q.type, q.marks, q.difficulty);
      return `  - planIndex ${planIndex}: ${q.type}, ${q.marks} mark(s), ${q.difficulty}${hint ? `\n    Examiner note: ${hint}` : ''}`;
    });

    const excerpts = entry.evidence.length
      ? formatEvidenceBlock(entry.evidence, `T${t + 1}-E`)
      : '(No excerpt could be retrieved for this topic. Use only the topic scope and key terms below, and keep the question as concrete as they allow.)';

    return `### TOPIC ${t + 1}: ${entry.topic.topicName}${describeTopic(entry.topic)}

QUESTIONS TO WRITE FOR THIS TOPIC:
${lines.join('\n')}

VERBATIM EXCERPTS FROM THE UPLOADED DOCUMENTS FOR THIS TOPIC:
${excerpts}`;
  });

  const totalInBatch = batch.reduce((sum, e) => sum + e.questions.length, 0);

  return `${formatExamContext(examInfo)}

Write exactly ${totalInBatch} university-level question(s) for the plan entries below (planIndex ${planOffset + 1} through ${planOffset + totalInBatch}).

Each question must be rigorous enough for a formal degree examination: proportional to its marks, calibrated to its difficulty, and grounded in the excerpts under its topic. Do not write school-level or textbook-summary questions.

${topicBlocks.join('\n\n')}

Return the JSON object now.`;
};

const REGROUND_NOTE = `IMPORTANT — RETRY.

The "sourceEvidence" spans in your previous answer could not be found in the uploaded documents.

Rewrite at full university exam standard. This time:
- Pick a sentence you can see in an excerpt below and build a rigorous, marks-appropriate question around what it states.
- Copy "sourceEvidence" word for word from that sentence.
- Keep each question self-contained with no reference to any document or excerpt.
- Do not downgrade to generic definition questions.`;

// ─────────────────────────────────────────────────────────────────────────────
// Response parsing
// ─────────────────────────────────────────────────────────────────────────────

const parseBatchResponse = (raw) => {
  const parsed = parseJsonFromLlm(raw);
  if (!Array.isArray(parsed.questions)) {
    throw new Error('LLM response missing "questions" array');
  }
  return parsed.questions;
};

const normalizeOptions = (options, type) => {
  if (type !== 'MCQ') return null;
  if (!Array.isArray(options)) return null;
  const cleaned = options.map((o) => String(o).trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────

const JSON_RETRY_NOTE =
  'Your previous reply was not valid JSON. Return ONLY a single JSON object matching the schema — no markdown fences, no commentary before or after.';

const callGroq = async (systemPrompt, userPrompt, questionCount) => {
  const groq = getGroq();
  const baseMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let lastErr;
  let jsonRetried = false;
  let maxTokens = estimateGroqMaxTokens(questionCount);
  const maxAttempts = 6;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const messages = jsonRetried
        ? [...baseMessages, { role: 'user', content: JSON_RETRY_NOTE }]
        : baseMessages;

      const response = await groqChatJsonCompletion(groq, {
        model: GROQ_MODEL,
        temperature: jsonRetried ? 0.15 : 0.35,
        max_tokens: maxTokens,
        messages,
      });

      const { content, finishReason, reasoningTokens } = extractChatContent(response);
      if (!content) {
        if (finishReason === 'length' || reasoningTokens > 0) {
          maxTokens = Math.min(16384, maxTokens + 2048);
          throw new Error(
            `Groq reasoning consumed the token budget (finish_reason: ${finishReason}, reasoning_tokens: ${reasoningTokens}, max_tokens: ${maxTokens - 2048})`
          );
        }
        throw new Error('Groq returned an empty response');
      }

      return {
        questions: parseBatchResponse(content),
        provider: `groq-${GROQ_MODEL}`,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
      };
    } catch (err) {
      lastErr = err;

      // 413 "too large" is deterministic — retrying the same request wastes
      // time. Bail immediately so the caller can fall back to Gemini/OpenRouter.
      if (isSizeLimitError(err)) {
        console.warn('[questionGenerationService] Groq batch too large for TPM limit, falling back…');
        break;
      }

      if (isQuotaError(err) && attempt < maxAttempts - 1) {
        const delayMs = parseProviderRetryDelay(err.message, attempt);
        console.warn(
          `[questionGenerationService] Groq rate-limited, waiting ${Math.round(delayMs / 1000)}s…`
        );
        await sleep(delayMs);
        continue;
      }

      const emptyOrLength =
        isLlmParseError(err) ||
        (err.message || '').includes('token budget') ||
        (err.message || '').includes('empty response');

      if (emptyOrLength && attempt < maxAttempts - 1) {
        if (!jsonRetried && (isJsonValidationError(err) || isLlmParseError(err))) {
          jsonRetried = true;
        }
        console.warn('[questionGenerationService] Groq batch failed, retrying…', err.message);
        await sleep(800 * (attempt + 1));
        continue;
      }

      if (!jsonRetried && isJsonValidationError(err)) {
        jsonRetried = true;
        console.warn('[questionGenerationService] Groq batch failed, retrying once…', err.message);
        continue;
      }

      break;
    }
  }

  throw lastErr;
};

const callGemini = async (systemPrompt, userPrompt) => {
  const ai = getGemini();
  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  let lastErr;
  for (const modelName of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[questionGenerationService] Trying Gemini ${modelName} (attempt ${attempt + 1})…`);
        const result = await ai.models.generateContent({ model: modelName, contents: fullPrompt });
        const raw = result.text;
        if (!raw) throw new Error(`Gemini (${modelName}) returned empty response`);
        return { questions: parseBatchResponse(raw), provider: modelName, usage: null };
      } catch (err) {
        lastErr = err;
        if (isModelAccessError(err)) {
          console.warn(`[questionGenerationService] ${modelName} unavailable, trying next model…`);
          break;
        }
        if (!isQuotaError(err)) throw err;
        const delayMs = parseProviderRetryDelay(err.message, attempt);
        console.warn(
          `[questionGenerationService] ${modelName} rate-limited, waiting ${Math.round(delayMs / 1000)}s…`
        );
        await sleep(delayMs);
      }
    }
    console.warn(`[questionGenerationService] ${modelName} exhausted, trying next model…`);
  }
  throw lastErr;
};

const hasGemini = () =>
  Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== '...');

/** Third-tier fallback when both Groq and Gemini are rate-limited/unavailable. */
const callOpenRouter = async (systemPrompt, userPrompt) => {
  const openrouter = getOpenRouter();
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await openrouter.chat.completions.create({
        model: OPENROUTER_MODEL,
        temperature: 0.3,
        max_tokens: 8192,
        messages,
      });
      const { content } = extractChatContent(response);
      if (!content) throw new Error('OpenRouter returned an empty response');
      return { questions: parseBatchResponse(content), provider: `openrouter-${OPENROUTER_MODEL}`, usage: null };
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err) || attempt === 2) throw err;
      console.warn(
        `[questionGenerationService] OpenRouter rate-limited, waiting…`
      );
      await sleep(parseProviderRetryDelay(err.message, attempt));
    }
  }
  throw lastErr;
};

const callWithFallback = async (systemPrompt, userPrompt, questionCount) => {
  try {
    return await callGroq(systemPrompt, userPrompt, questionCount);
  } catch (groqErr) {
    const status = groqErr?.status || groqErr?.statusCode || 0;
    if (status === 401) throw groqErr;

    if (!hasGemini()) {
      if (hasOpenRouter()) {
        console.warn('[questionGenerationService] Groq failed, falling back to OpenRouter…', groqErr.message);
        return await callOpenRouter(systemPrompt, userPrompt);
      }
      throw groqErr;
    }

    console.warn('[questionGenerationService] Groq failed, falling back to Gemini…', groqErr.message);
    try {
      return await callGemini(systemPrompt, userPrompt);
    } catch (geminiErr) {
      if (!hasOpenRouter()) {
        if (isModelAccessError(geminiErr)) {
          throw new Error(
            `Question generation failed.\n• Groq: ${groqErr.message}\n• Gemini: API access denied — check GEMINI_API_KEY at https://aistudio.google.com/app/apikey and set GEMINI_MODELS=gemini-2.5-flash in .env`
          );
        }
        throw new Error(
          `All LLM providers failed.\n• Groq: ${groqErr.message}\n• Gemini: ${geminiErr.message}`
        );
      }

      console.warn('[questionGenerationService] Gemini failed, falling back to OpenRouter…', geminiErr.message);
      try {
        return await callOpenRouter(systemPrompt, userPrompt);
      } catch (openrouterErr) {
        throw new Error(
          `All LLM providers failed.\n• Groq: ${groqErr.message}\n• Gemini: ${geminiErr.message}\n• OpenRouter: ${openrouterErr.message}`
        );
      }
    }
  }
};

const estimateMaxTokens = (questionCount) => estimateGroqMaxTokens(questionCount);

// ─────────────────────────────────────────────────────────────────────────────
// Evidence selection
// ─────────────────────────────────────────────────────────────────────────────

const topicQuery = (topic) => [
  { text: topic.topicName, weight: 3 },
  { text: (topic.keywords || []).join(' '), weight: 2 },
  { text: topic.description || '', weight: 1 },
];

/**
 * Attach retrieved excerpts to each topic in a batch, splitting the batch's
 * character budget between its topics.
 *
 * `usedChunkIds` spreads a topic's questions across different parts of the
 * document when that topic spans several batches.
 */
const attachEvidence = (batch, corpus, usedChunkIds) => {
  const perTopicChars = Math.max(
    MIN_EVIDENCE_CHARS_PER_TOPIC,
    Math.floor(EVIDENCE_CHARS_PER_BATCH / batch.length)
  );

  return batch.map((entry) => {
    const query = topicQuery(entry.topic);
    const maxChunks = entry.questions.length + 3;
    const seen = usedChunkIds.get(entry.topic.topicName) || new Set();

    let evidence = retrieve(corpus, query, {
      maxChars: perTopicChars,
      maxChunks,
      excludeIds: seen,
    });

    // Excluding already-used passages must not starve the topic entirely.
    if (evidence.length < 2) {
      evidence = retrieve(corpus, query, { maxChars: perTopicChars, maxChunks });
    }

    evidence.forEach((e) => seen.add(e.id));
    usedChunkIds.set(entry.topic.topicName, seen);

    return { ...entry, evidence };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Grounding
// ─────────────────────────────────────────────────────────────────────────────

/** Merge an LLM answer into its plan entry and record how well it is grounded. */
const materialize = (planEntry, topic, llm, corpus) => {
  const evidenceQuote = String(llm?.sourceEvidence || '').trim();
  const check = evidenceQuote ? verifyQuote(corpus, evidenceQuote) : { grounded: false, coverage: 0, chunk: null };

  return {
    topicName: topic.topicName,
    type: planEntry.type,
    difficulty: planEntry.difficulty,
    marks: planEntry.marks,
    questionText: String(llm?.questionText || '').trim(),
    options: normalizeOptions(llm?.options, planEntry.type),
    correctAnswer: String(llm?.correctAnswer || '').trim(),
    explanation: String(llm?.explanation || '').trim(),
    sourceEvidence: evidenceQuote,
    sourceFile: check.chunk?.filename || '',
    sourcePage: check.chunk?.page ?? null,
    grounded: check.grounded,
    groundingScore: check.coverage,
    approved: false,
  };
};

/**
 * Pair a batch's plan entries with the LLM's questions.
 * Prefers planIndex; falls back to position when the model ignores it.
 */
const mergeBatch = (batch, llmQuestions, planOffset, corpus) => {
  const byPlanIndex = new Map(
    llmQuestions
      .filter((q) => Number.isFinite(Number(q?.planIndex)))
      .map((q) => [Number(q.planIndex), q])
  );

  const results = [];
  let cursor = planOffset;

  batch.forEach((entry) => {
    entry.questions.forEach((planEntry) => {
      cursor += 1;
      const llm = byPlanIndex.get(cursor) || llmQuestions[cursor - planOffset - 1] || {};
      results.push({
        planIndex: cursor,
        planEntry,
        topic: entry.topic,
        question: materialize(planEntry, entry.topic, llm, corpus),
      });
    });
  });

  return results;
};

/** Retry prompt: same evidence, but only the questions that need rewriting. */
const buildRetryPrompt = (retryBatch, examInfo) => {
  const topicBlocks = retryBatch.map((entry, t) => {
    const lines = entry.questions.map(
      (q) => `  - planIndex ${q.planIndex}: ${q.type}, ${q.marks} mark(s), difficulty ${q.difficulty}`
    );
    const excerpts = entry.evidence.length
      ? formatEvidenceBlock(entry.evidence, `T${t + 1}-E`)
      : '(No excerpt available for this topic.)';

    return `### TOPIC ${t + 1}: ${entry.topic.topicName}${describeTopic(entry.topic)}

QUESTIONS TO REWRITE:
${lines.join('\n')}

VERBATIM EXCERPTS FROM THE UPLOADED DOCUMENTS FOR THIS TOPIC:
${excerpts}`;
  });

  return `Exam: ${examInfo.examTitle || 'Examination'}
Subject: ${examInfo.subject || 'General'}

Rewrite only the plan entries listed below, keeping their planIndex values.

${topicBlocks.join('\n\n')}

Return the JSON object now.`;
};

/**
 * Re-ask for the questions whose evidence span was not found in the documents,
 * and keep a replacement only when it verifies better than what it replaces.
 */
const regroundBatch = async (batch, examInfo, corpus, merged) => {
  const failed = merged.filter((m) => !m.question.grounded);
  if (!failed.length) return { merged, usedCall: false };

  // Re-ask per topic, so each rewrite is shown the same excerpts as before.
  const retryBatch = batch
    .map((entry) => ({
      ...entry,
      questions: failed
        .filter((m) => m.topic.topicName === entry.topic.topicName)
        .map((m) => ({ ...m.planEntry, planIndex: m.planIndex })),
    }))
    .filter((entry) => entry.questions.length);

  if (!retryBatch.length) return { merged, usedCall: false };

  console.log(
    `[questionGenerationService] Re-grounding ${failed.length} question(s) whose evidence was not found in the source`
  );

  const userPrompt = `${REGROUND_NOTE}\n\n---\n\n${buildRetryPrompt(retryBatch, examInfo)}`;

  let retryQuestions;
  try {
    const result = await callWithFallback(
      QUESTION_GENERATION_SYSTEM_PROMPT,
      userPrompt,
      failed.length
    );
    retryQuestions = result.questions;
  } catch (err) {
    console.warn('[questionGenerationService] Re-grounding call failed, keeping first attempt:', err.message);
    return { merged, usedCall: true };
  }

  const byPlanIndex = new Map(
    retryQuestions
      .filter((q) => Number.isFinite(Number(q?.planIndex)))
      .map((q) => [Number(q.planIndex), q])
  );

  const improved = merged.map((item) => {
    if (item.question.grounded) return item;
    const llm = byPlanIndex.get(item.planIndex);
    if (!llm) return item;

    const candidate = materialize(item.planEntry, item.topic, llm, corpus);
    if (!candidate.questionText) return item;
    if (candidate.groundingScore <= item.question.groundingScore) return item;

    return { ...item, question: candidate };
  });

  return { merged: improved, usedCall: true };
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
//
//   config    : { examInfo, topics[] }
//   documents : [{ filename, pages, extractedText }] — or string[] of raw text
// ─────────────────────────────────────────────────────────────────────────────
const generateQuestions = async (config, documents, options = {}) => {
  const { examInfo, topics } = config;

  const docs = normalizeDocuments(documents);
  const corpus = buildCorpus(docs);
  console.log(
    `[questionGenerationService] Indexed ${corpus.size} passage(s) from ${docs.length} document(s)`
  );

  const plan = buildQuestionPlan(examInfo, topics);
  plan.warnings.forEach((w) => console.warn(`[questionGenerationService] ${w}`));

  if (!plan.totalQuestions) {
    throw new Error(
      'No questions could be planned. Check that question counts are set and that topics have allocated marks.'
    );
  }

  const batches = batchPlan(plan.assignments);
  console.log(
    `[questionGenerationService] Planned ${plan.totalQuestions} question(s) across ${batches.length} batch(es)`
  );

  // Passages to steer away from. Regenerating a single question passes the
  // evidence it was built on, so the replacement draws on different material
  // instead of paraphrasing the same sentence.
  const usedChunkIds = new Map();
  (options.avoidEvidence || []).filter(Boolean).forEach((quote) => {
    const { chunk } = verifyQuote(corpus, quote);
    if (!chunk) return;
    topics.forEach((topic) => {
      const seen = usedChunkIds.get(topic.topicName) || new Set();
      seen.add(chunk.id);
      usedChunkIds.set(topic.topicName, seen);
    });
  });

  const collected = [];
  let provider = null;
  let regroundCalls = 0;
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  let planOffset = 0;

  const callBatchWithRetry = async (systemPrompt, userPrompt, questionCount, batchNum) => {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callWithFallback(systemPrompt, userPrompt, questionCount);
      } catch (err) {
        lastErr = err;
        if (attempt === 0) {
          console.warn(
            `[questionGenerationService] Batch ${batchNum}/${batches.length} failed, retrying…`,
            err.message
          );
          await sleep(2000);
        }
      }
    }
    throw lastErr;
  };

  for (let b = 0; b < batches.length; b++) {
    if (b > 0 && LLM_BATCH_PAUSE_MS > 0) {
      await sleep(LLM_BATCH_PAUSE_MS);
    }

    const batch = attachEvidence(batches[b], corpus, usedChunkIds);
    const batchCount = batch.reduce((sum, e) => sum + e.questions.length, 0);

    const result = await callBatchWithRetry(
      QUESTION_GENERATION_SYSTEM_PROMPT,
      buildBatchPrompt(batch, examInfo, planOffset),
      batchCount,
      b + 1
    );

    provider = provider && provider !== result.provider ? `${provider}+${result.provider}` : result.provider;
    if (result.usage) {
      usage.promptTokens += result.usage.promptTokens || 0;
      usage.completionTokens += result.usage.completionTokens || 0;
      usage.totalTokens += result.usage.totalTokens || 0;
    }

    let merged = mergeBatch(batch, result.questions, planOffset, corpus);

    if (regroundCalls < MAX_REGROUND_CALLS) {
      const retry = await regroundBatch(batch, examInfo, corpus, merged);
      merged = retry.merged;
      if (retry.usedCall) regroundCalls += 1;
    }

    collected.push(...merged);
    planOffset += batchCount;

    const groundedCount = merged.filter((m) => m.question.grounded).length;
    console.log(
      `[questionGenerationService] Batch ${b + 1}/${batches.length}: ${batchCount} question(s), ${groundedCount} verified against source`
    );
  }

  // Group the paper by question type, the way a printed paper reads.
  const questions = collected
    .map((item) => item.question)
    .filter((q) => q.questionText)
    .sort((a, b) => typeRank(a.type) - typeRank(b.type) || b.marks - a.marks)
    .map((q, i) => ({ ...q, id: i + 1 }));

  const groundedCount = questions.filter((q) => q.grounded).length;
  console.log(
    `[questionGenerationService] Done — ${questions.length} question(s), ${groundedCount} with evidence verified in the uploaded PDFs`
  );

  return {
    examTitle: examInfo.examTitle || '',
    subject: examInfo.subject || '',
    totalMarks: questions.reduce((sum, q) => sum + (q.marks || 0), 0),
    totalQuestions: questions.length,
    questions,
    groundedCount,
    warnings: plan.warnings,
    provider: provider || 'unknown',
    usage: usage.totalTokens ? usage : null,
  };
};

module.exports = { generateQuestions };
