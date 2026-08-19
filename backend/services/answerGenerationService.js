const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const {
  EVIDENCE_CHARS_PER_BATCH,
  GROQ_MODEL,
  GEMINI_MODELS,
  LLM_BATCH_PAUSE_MS,
  groqChatJsonCompletion,
  estimateGroqMaxTokens,
  extractChatContent,
  isModelAccessError,
  isQuotaError,
  parseJsonFromLlm,
  parseProviderRetryDelay,
  sleep,
} = require('../utils/llmUtils');
const {
  normalizeCriteria,
  criteriaToSchemeString,
} = require('../utils/markingCriteria');
const {
  buildCorpus,
  retrieve,
  formatEvidenceBlock,
  normalizeDocuments,
} = require('./retrievalService');

const BATCH_SIZE = 4;

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

// Each question now arrives with the excerpts it was written from, so the model
// marks against the course material rather than against general knowledge.
const SYSTEM_PROMPT = `You are a senior university examiner writing the official answer key and marking scheme for a formal degree examination, using the course documents the paper was set from.

Each question comes with VERBATIM EXCERPTS from those documents. The excerpts are the sole authority for the answer.

## Absolute rules

1. ANSWER FROM THE EXCERPTS ONLY. Use their definitions, notation, symbols, figures, named examples and step orderings.

2. NO OUTSIDE MATERIAL. Do not fill gaps from general knowledge.

3. MARKS-PROPORTIONAL DEPTH. Scale model answers to the question's marks — concise for 1-2 marks, structured multi-point for 5+ marks.

4. UNIVERSITY STANDARD. Model answers should read like a strong student's exam script or an examiner's reference — precise terminology, logical structure, partial-credit sub-points for longer answers.

5. SELF-CONTAINED. Never mention "the document", "excerpt" or page numbers.

## Per question type

- MCQ: correctAnswer is A/B/C/D. modelAnswer states the full correct option and why the strongest distractor fails.
- FillInTheBlanks: exact missing phrase; modelAnswer completes the sentence with brief justification.
- ShortAnswer: 2-4 sentences covering every point needed for full marks.
- MediumAnswer: one structured paragraph (~80-120 words) with clear logical flow.
- LongAnswer: numbered sub-parts matching the question; include derivations/steps where the question asks for them.

For every question return:
- markingCriteria: array of { point, marks }. Points must sum to exactly the question's marks.
- markingScheme: the same breakdown as a short bullet string (for the printed answer key).
- explanation: 1-2 sentences for the teacher citing the source content.

Return ONLY valid JSON:
{
  "answers": [
    {
      "questionNumber": <integer matching input>,
      "correctAnswer": "<string>",
      "modelAnswer": "<string>",
      "markingCriteria": [
        { "point": "<what the student must write>", "marks": 1 }
      ],
      "markingScheme": "<string, e.g. '1 mark: definition\\n2 marks: example'>",
      "explanation": "<string>"
    }
  ]
}`;

const estimateMaxTokens = (questions) =>
  estimateGroqMaxTokens(questions.length, { perItem: 700, floor: 4096 });

/**
 * Passages for one question. The evidence span recorded at generation time is
 * the strongest signal available, so it leads the query and usually pulls back
 * the exact passage the question was written from.
 */
const questionQuery = (q) => [
  { text: q.sourceEvidence || '', weight: 4 },
  { text: q.questionText || '', weight: 2 },
  { text: (q.options || []).join(' '), weight: 1 },
  { text: q.topicName || '', weight: 1 },
];

const buildUserPrompt = (batchQuestions, corpus, examInfo, startIndex = 0) => {
  const perQuestionChars = Math.max(
    1_200,
    Math.floor(EVIDENCE_CHARS_PER_BATCH / Math.max(batchQuestions.length, 1))
  );

  const questionsBlock = batchQuestions.map((q, i) => {
    const globalNum = startIndex + i + 1;
    const evidence = retrieve(corpus, questionQuery(q), {
      maxChars: perQuestionChars,
      maxChunks: 3,
    });

    const opts = q.options?.length ? `\n  Options: ${q.options.join(' | ')}` : '';
    const excerpts = evidence.length
      ? formatEvidenceBlock(evidence, `Q${globalNum}-E`)
      : '(No excerpt could be retrieved for this question. Answer only as far as the question itself supports.)';

    return `Q${globalNum} [${q.type}, ${q.difficulty}, ${q.marks} marks, Topic: ${q.topicName}]
  Text: ${q.questionText}${opts}
  Existing answer hint: ${q.correctAnswer || '(none)'}

  SOURCE EXCERPTS FOR Q${globalNum}:
${excerpts}`;
  }).join('\n\n---\n\n');

  return `Exam: ${examInfo.examTitle || 'Exam'}
Subject: ${examInfo.subject || 'General'}
Total marks: ${examInfo.totalMarks || 100}

Write the answer key for the ${batchQuestions.length} question(s) below, numbered ${startIndex + 1} through ${startIndex + batchQuestions.length}. Answer each one from the excerpts printed beneath it.

${questionsBlock}`;
};

const parseAnswerResponse = (raw, batchQuestions, startIndex) => {
  const parsed = parseJsonFromLlm(raw);

  if (!Array.isArray(parsed.answers)) {
    throw new Error('LLM response missing "answers" array');
  }

  // Build two lookup maps:
  //  1. byGlobalNum – keyed by the global question number the LLM was asked to use
  //  2. byLocalNum  – keyed by the local (1-based) position within this batch,
  //                   as a fallback for when the LLM ignores the startIndex offset
  //                   and returns answers numbered 1..N regardless.
  const byGlobalNum = new Map(
    parsed.answers.map((a) => [Number(a.questionNumber), a])
  );
  const byLocalNum = new Map(
    parsed.answers.map((a, idx) => [idx + 1, a])
  );

  const merged = [];
  for (let i = 0; i < batchQuestions.length; i++) {
    const globalNum = startIndex + i + 1;
    const localNum  = i + 1;
    // Prefer an exact global-number match; fall back to local position
    const llm = byGlobalNum.get(globalNum) || byLocalNum.get(localNum) || {};
    const maxMarks = Number(batchQuestions[i].marks) || 0;
    const markingCriteria = normalizeCriteria(
      llm.markingCriteria?.length ? llm.markingCriteria : llm.markingScheme,
      maxMarks
    );
    merged.push({
      questionNumber: globalNum,
      correctAnswer:  llm.correctAnswer  || '',
      modelAnswer:    llm.modelAnswer    || '',
      markingCriteria,
      markingScheme:  llm.markingScheme || criteriaToSchemeString(markingCriteria) || '',
      explanation:    llm.explanation    || '',
    });
  }

  return merged;
};

const callGroq = async (batchQuestions, corpus, examInfo, startIndex) => {
  const groq = getGroq();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(batchQuestions, corpus, examInfo, startIndex) },
  ];

  let lastErr;
  let maxTokens = estimateMaxTokens(batchQuestions);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await groqChatJsonCompletion(groq, {
        model: GROQ_MODEL,
        temperature: 0.25,
        max_tokens: maxTokens,
        messages,
      });

      const { content, finishReason, reasoningTokens } = extractChatContent(response);
      if (!content) {
        if (finishReason === 'length' || reasoningTokens > 0) {
          maxTokens = Math.min(16384, maxTokens + 2048);
        }
        throw new Error('Groq returned an empty response');
      }

      return {
        answers: parseAnswerResponse(content, batchQuestions, startIndex),
        provider: `groq-${GROQ_MODEL}`,
      };
    } catch (err) {
      lastErr = err;
      if (isQuotaError(err) && attempt < 4) {
        const delayMs = parseProviderRetryDelay(err.message, attempt);
        console.warn(
          `[answerGenerationService] Groq rate-limited, waiting ${Math.round(delayMs / 1000)}s…`
        );
        await sleep(delayMs);
        continue;
      }
      if (attempt < 4 && (err.message || '').includes('empty')) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastErr;
};

const callGemini = async (batchQuestions, corpus, examInfo, startIndex) => {
  const ai = getGemini();
  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${buildUserPrompt(batchQuestions, corpus, examInfo, startIndex)}`;

  let lastErr;
  for (const modelName of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await ai.models.generateContent({ model: modelName, contents: fullPrompt });
        const raw = result.text;
        if (!raw) throw new Error(`Gemini (${modelName}) returned empty response`);
        return {
          answers: parseAnswerResponse(raw, batchQuestions, startIndex),
          provider: modelName,
        };
      } catch (err) {
        lastErr = err;
        if (isModelAccessError(err)) {
          console.warn(`[answerGenerationService] ${modelName} unavailable, trying next model…`);
          break;
        }
        if (!isQuotaError(err)) throw err;
        await sleep(parseProviderRetryDelay(err.message, attempt));
      }
    }
  }
  throw lastErr;
};

const generateBatch = async (batchQuestions, corpus, examInfo, startIndex) => {
  try {
    return await callGroq(batchQuestions, corpus, examInfo, startIndex);
  } catch (groqErr) {
    console.warn(`[answerGenerationService] Groq batch failed (Q${startIndex + 1}+), trying Gemini…`, groqErr.message);
    try {
      return await callGemini(batchQuestions, corpus, examInfo, startIndex);
    } catch (geminiErr) {
      throw new Error(
        `Answer batch failed.\n• Groq: ${groqErr.message}\n• Gemini: ${geminiErr.message}`
      );
    }
  }
};

/**
 * Generate model answers for approved questions via Groq → Gemini fallback, batched.
 *
 * @param {Array}  approvedQuestions
 * @param {Array}  documents  [{ filename, pages, extractedText }] — or string[] of raw text
 * @param {object} examInfo
 */
const generateModelAnswers = async (approvedQuestions, documents, examInfo) => {
  if (!approvedQuestions.length) {
    return { answers: [], provider: 'none' };
  }

  const corpus = buildCorpus(normalizeDocuments(documents));
  console.log(
    `[answerGenerationService] Generating model answers for ${approvedQuestions.length} questions against ${corpus.size} indexed passage(s)…`
  );

  const allAnswers = [];
  let provider = `groq-${GROQ_MODEL}`;

  for (let i = 0; i < approvedQuestions.length; i += BATCH_SIZE) {
    if (i > 0 && LLM_BATCH_PAUSE_MS > 0) {
      await sleep(LLM_BATCH_PAUSE_MS);
    }

    const batch = approvedQuestions.slice(i, i + BATCH_SIZE);
    const result = await generateBatch(batch, corpus, examInfo, i);
    allAnswers.push(...result.answers);
    if (result.provider && !result.provider.startsWith('groq')) {
      provider = result.provider;
    }
    console.log(`[answerGenerationService] Batch ${Math.floor(i / BATCH_SIZE) + 1} done (${batch.length} questions)`);
  }

  return { answers: allAnswers, provider };
};

module.exports = { generateModelAnswers };
