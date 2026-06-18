const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const {
  GROQ_GENERATION_INPUT_CHARS,
  isQuotaError,
  parseGeminiRetryDelay,
  sleep,
  truncateDocuments,
  stripMarkdownFences,
} = require('../utils/llmUtils');

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

const SYSTEM_PROMPT = `You are an expert university examiner creating official model answers and marking schemes for an approved question paper.

For EACH question you receive, produce answers appropriate to the question type:

- **MCQ**: correctAnswer = single letter (A/B/C/D). modelAnswer = full text of the correct option plus 1-2 sentences explaining why it is correct.
- **ShortAnswer**: modelAnswer = 2–4 clear sentences covering all key points (proportional to marks).
- **MediumAnswer**: modelAnswer = one well-structured paragraph (roughly 80–150 words for typical marks).
- **LongAnswer**: modelAnswer = detailed multi-part answer with numbered sub-points, examples, and conclusions (scale length to marks).
- **FillInTheBlanks**: correctAnswer = the exact word/phrase for the blank. modelAnswer = the completed sentence with brief explanation.

For every question also provide:
- **markingScheme**: bullet-style partial credit breakdown totalling the question's marks.
- **explanation**: 1–2 sentence summary for the teacher.

Base answers on the provided source document text when available; otherwise use standard academic knowledge aligned with the question.

Return ONLY valid JSON:
{
  "answers": [
    {
      "questionNumber": <integer matching input>,
      "correctAnswer": "<string>",
      "modelAnswer": "<string>",
      "markingScheme": "<string>",
      "explanation": "<string>"
    }
  ]
}`;

const estimateMaxTokens = (questions) => {
  const perQuestion = questions.reduce((max, q) => {
    const byType = {
      MCQ: 400,
      ShortAnswer: 600,
      MediumAnswer: 900,
      LongAnswer: 1400,
      FillInTheBlanks: 350,
    };
    return Math.max(max, byType[q.type] || 700);
  }, 500);
  return Math.min(8192, perQuestion * questions.length + 400);
};

const buildUserPrompt = (approvedQuestions, extractedTexts, examInfo, startIndex = 0) => {
  const sourceBlock = extractedTexts.length
    ? truncateDocuments(extractedTexts, GROQ_GENERATION_INPUT_CHARS)
        .map((t, i) => `=== SOURCE ${i + 1} ===\n${t}`)
        .join('\n\n')
    : '(No source documents — use question context and standard subject knowledge.)';

  const questionsBlock = approvedQuestions.map((q, i) => {
    const globalNum = startIndex + i + 1;
    const opts = q.options?.length
      ? `\n  Options: ${q.options.join(' | ')}`
      : '';
    return `Q${globalNum} [${q.type}, ${q.difficulty}, ${q.marks} marks, Topic: ${q.topicName}]
  Text: ${q.questionText}${opts}
  Existing answer hint: ${q.correctAnswer || '(none)'}`;
  }).join('\n\n');

  return `Exam: ${examInfo.examTitle || 'Exam'}
Subject: ${examInfo.subject || 'General'}
Total marks: ${examInfo.totalMarks || 100}

Generate model answers for ALL ${approvedQuestions.length} approved questions below. Use questionNumber ${startIndex + 1} through ${startIndex + approvedQuestions.length}.

${questionsBlock}

--- SOURCE DOCUMENTS ---
${sourceBlock}`;
};

const parseAnswerResponse = (raw, batchQuestions, startIndex) => {
  const cleaned = stripMarkdownFences(raw);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM answer response was not valid JSON: ${cleaned.slice(0, 300)}`);
  }

  if (!Array.isArray(parsed.answers)) {
    throw new Error('LLM response missing "answers" array');
  }

  const byNumber = new Map(
    parsed.answers.map((a) => [Number(a.questionNumber), a])
  );

  const merged = [];
  for (let i = 0; i < batchQuestions.length; i++) {
    const num = startIndex + i + 1;
    const llm = byNumber.get(num) || {};
    merged.push({
      questionNumber: num,
      correctAnswer:  llm.correctAnswer  || '',
      modelAnswer:    llm.modelAnswer    || '',
      markingScheme:  llm.markingScheme  || '',
      explanation:    llm.explanation    || '',
    });
  }

  return merged;
};

const callGroq = async (batchQuestions, extractedTexts, examInfo, startIndex) => {
  const groq = getGroq();
  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature: 0.3,
    max_tokens: estimateMaxTokens(batchQuestions),
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(batchQuestions, extractedTexts, examInfo, startIndex) },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq returned an empty response');

  return {
    answers: parseAnswerResponse(raw, batchQuestions, startIndex),
    provider: 'groq-llama-3.1-8b',
  };
};

const GEMINI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash'];

const callGemini = async (batchQuestions, extractedTexts, examInfo, startIndex) => {
  const ai = getGemini();
  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${buildUserPrompt(batchQuestions, extractedTexts, examInfo, startIndex)}`;

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
        if (!isQuotaError(err)) throw err;
        await sleep(parseGeminiRetryDelay(err.message, attempt));
      }
    }
  }
  throw lastErr;
};

const generateBatch = async (batchQuestions, extractedTexts, examInfo, startIndex) => {
  try {
    return await callGroq(batchQuestions, extractedTexts, examInfo, startIndex);
  } catch (groqErr) {
    console.warn(`[answerGenerationService] Groq batch failed (Q${startIndex + 1}+), trying Gemini…`, groqErr.message);
    try {
      return await callGemini(batchQuestions, extractedTexts, examInfo, startIndex);
    } catch (geminiErr) {
      throw new Error(
        `Answer batch failed.\n• Groq: ${groqErr.message}\n• Gemini: ${geminiErr.message}`
      );
    }
  }
};

/**
 * Generate model answers for approved questions via Groq → Gemini fallback, batched.
 */
const generateModelAnswers = async (approvedQuestions, extractedTexts, examInfo) => {
  if (!approvedQuestions.length) {
    return { answers: [], provider: 'none' };
  }

  console.log(`[answerGenerationService] Generating model answers for ${approvedQuestions.length} questions…`);

  const allAnswers = [];
  let provider = 'groq-llama-3.1-8b';

  for (let i = 0; i < approvedQuestions.length; i += BATCH_SIZE) {
    const batch = approvedQuestions.slice(i, i + BATCH_SIZE);
    const result = await generateBatch(batch, extractedTexts, examInfo, i);
    allAnswers.push(...result.answers);
    if (result.provider && !result.provider.startsWith('groq')) {
      provider = result.provider;
    }
    console.log(`[answerGenerationService] Batch ${Math.floor(i / BATCH_SIZE) + 1} done (${batch.length} questions)`);
  }

  return { answers: allAnswers, provider };
};

module.exports = { generateModelAnswers };
