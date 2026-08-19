const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const {
  GROQ_MODEL,
  GEMINI_MODELS,
  LLM_BATCH_PAUSE_MS,
  groqChatJsonCompletion,
  estimateGroqMaxTokens,
  extractChatContent,
  isModelAccessError,
  isQuotaError,
  isGroqFallbackError,
  parseJsonFromLlm,
  parseProviderRetryDelay,
  sleep,
  truncateText,
} = require('../utils/llmUtils');

const { gradeByKeywords } = require('./keywordMarkingService');
const { buildMarkingPayload } = require('../utils/markingCriteria');

const BATCH_SIZE = 6;
const MAX_OCR_CHARS = 12_000;

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

const SYSTEM_PROMPT = `You are a university examiner marking a handwritten student answer sheet that has been OCR-extracted.

You receive the official question paper (with max marks, model answer, and marking scheme) plus the student's OCR text.

## Marking rules

1. Award marks from the MARKING CRITERIA JSON. Each criterion is independent: if that point is present, award its marks; if not, 0 for that point. Sum is marksAwarded (capped at max_marks).
2. Be lenient toward OCR noise: misspellings, missing punctuation, and character substitutions that clearly intend the right word still count.
3. If the student did not attempt a question, award 0 and say so.
4. MCQ: accept the option letter (A/B/C/D) or the option text. Award full marks or zero (no partial).
5. Do not invent content the student did not write. Do not penalise for handwriting artefacts.
6. marksAwarded must be a number between 0 and maxMarks inclusive (decimals allowed, e.g. 1.5).
7. Extract the portion of OCR text that belongs to that question into studentAnswer. Prefer the mapped "Q<n>:" block when present.

Return ONLY valid JSON:
{
  "evaluations": [
    {
      "questionNumber": 1,
      "studentAnswer": "<extracted student text for this question>",
      "marksAwarded": 1.5,
      "keywordCoverage": 0.7,
      "semanticScore": 0.7,
      "strengths": ["<short>"],
      "weaknesses": ["<short>"],
      "feedback": "<1-3 sentences for the teacher>"
    }
  ]
}`;

const VISION_SYSTEM_PROMPT = `You are a university examiner marking a PHOTOGRAPH of a handwritten answer sheet.

You receive the official questions (max marks, model answer, MARKING SCHEME) and the student's sheet image/PDF.

## How to read the sheet
- Question numbers (Q1, Q2, …) are in the left margin.
- Answers are to the right of the red/pink margin line, on the same row as that Q number (extra lines wrap below).
- Empty space next to a Q number means not attempted.
- Transcribe what is written. Do not invent answers. Do not use any OCR dump.

## Marking rules
1. Award marks from the MARKING CRITERIA JSON. Each criterion is independent: if that point is present in the handwriting, award its marks; if not, award 0 for that point. Sum of awarded points is marksAwarded (capped at max_marks).
2. MCQ: accept the option letter (A/B/C/D) or the option text. Full marks or zero.
3. Fill-in / one-word: full marks if the written word matches the key (ignore case and punctuation).
4. If not attempted, marksAwarded = 0 and studentAnswer = "".
5. marksAwarded must be between 0 and maxMarks (decimals allowed, e.g. 1.5).
6. studentAnswer is your transcription of that question from the photo.

Return ONLY valid JSON:
{
  "evaluations": [
    {
      "questionNumber": 1,
      "studentAnswer": "<what you read on the page>",
      "marksAwarded": 1.5,
      "keywordCoverage": 0.7,
      "semanticScore": 0.7,
      "strengths": ["<short>"],
      "weaknesses": ["<short>"],
      "feedback": "<1-3 sentences for the teacher>"
    }
  ]
}`;

const formatQuestionBlock = (q) => {
  const options = Array.isArray(q.options) && q.options.length
    ? `Options: ${q.options.join(' | ')}`
    : '';
  return [
    `Q${q.questionNumber} [${q.type || 'ShortAnswer'}] [${q.marks} marks]`,
    `Question: ${q.questionText}`,
    options,
    `Correct / key: ${q.correctAnswer || '(none)'}`,
    `Model answer: ${q.modelAnswer || '(none)'}`,
    'Marking criteria JSON (award each point independently; sum = max_marks):',
    JSON.stringify(buildMarkingPayload(q), null, 2),
  ].filter(Boolean).join('\n');
};

const buildUserPrompt = (questions, ocrText, examInfo) => {
  const header = [
    `Exam: ${examInfo.examTitle || 'Untitled'}`,
    `Subject: ${examInfo.subject || 'Unknown'}`,
    `Total marks: ${examInfo.totalMarks || questions.reduce((s, q) => s + (q.marks || 0), 0)}`,
  ].join('\n');

  return `${header}

## Official questions (mark against these)

${questions.map(formatQuestionBlock).join('\n\n---\n\n')}

## Student answers mapped by question number (OCR, may contain errors)

${ocrText}

Mark every question listed above. Award scheme-point marks when the student hits the important keywords even if the wording differs. Return JSON only.`;
};

const buildVisionUserPrompt = (questions, examInfo) => {
  const header = [
    `Exam: ${examInfo.examTitle || 'Untitled'}`,
    `Subject: ${examInfo.subject || 'Unknown'}`,
    `Total marks: ${examInfo.totalMarks || questions.reduce((s, q) => s + (q.marks || 0), 0)}`,
  ].join('\n');

  return `${header}

## Official questions (mark against these)

${questions.map(formatQuestionBlock).join('\n\n---\n\n')}

## Student sheet

The attached image/PDF is the student's handwritten answer sheet.
Read Q1…Q${questions.length} from the page and mark every question listed above using the marking scheme.
Return JSON only.`;
};

const clampMarks = (awarded, max) => {
  const n = Number(awarded);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n * 2) / 2));
};

const parseEvalResponse = (raw, batchQuestions) => {
  const parsed = parseJsonFromLlm(raw);
  const rows = Array.isArray(parsed.evaluations) ? parsed.evaluations : [];
  if (!rows.length) {
    throw new Error('LLM response is missing "evaluations" array');
  }

  const byNumber = new Map(rows.map((r) => [Number(r.questionNumber), r]));

  return batchQuestions.map((q) => {
    const llm = byNumber.get(Number(q.questionNumber)) || {};
    const maxMarks = Number(q.marks) || 0;
    return {
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      modelAnswer: q.modelAnswer || '',
      studentAnswer: typeof llm.studentAnswer === 'string' ? llm.studentAnswer : '',
      maxMarks,
      marksAwarded: clampMarks(llm.marksAwarded, maxMarks),
      keywordCoverage: Number.isFinite(Number(llm.keywordCoverage)) ? Number(llm.keywordCoverage) : 0,
      semanticScore: Number.isFinite(Number(llm.semanticScore)) ? Number(llm.semanticScore) : 0,
      strengths: Array.isArray(llm.strengths) ? llm.strengths.map(String) : [],
      weaknesses: Array.isArray(llm.weaknesses) ? llm.weaknesses.map(String) : [],
      feedback: llm.feedback || '',
    };
  });
};

const callGroq = async (batchQuestions, ocrText, examInfo) => {
  const groq = getGroq();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(batchQuestions, ocrText, examInfo) },
  ];

  let lastErr;
  let maxTokens = estimateGroqMaxTokens(batchQuestions.length, { perItem: 700, floor: 4096 });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await groqChatJsonCompletion(groq, {
        model: GROQ_MODEL,
        temperature: 0.15,
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
        evaluations: parseEvalResponse(content, batchQuestions),
        provider: `groq-${GROQ_MODEL}`,
      };
    } catch (err) {
      lastErr = err;
      if (isQuotaError(err) && attempt < 4) {
        await sleep(parseProviderRetryDelay(err.message, attempt));
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

const callGemini = async (batchQuestions, ocrText, examInfo) => {
  const ai = getGemini();
  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${buildUserPrompt(batchQuestions, ocrText, examInfo)}`;

  let lastErr;
  for (const modelName of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await ai.models.generateContent({ model: modelName, contents: fullPrompt });
        const raw = result.text;
        if (!raw) throw new Error(`Gemini (${modelName}) returned empty response`);
        return {
          evaluations: parseEvalResponse(raw, batchQuestions),
          provider: modelName,
        };
      } catch (err) {
        lastErr = err;
        if (isModelAccessError(err)) break;
        if (!isQuotaError(err)) throw err;
        await sleep(parseProviderRetryDelay(err.message, attempt));
      }
    }
  }
  throw lastErr;
};

const callGeminiVision = async (batchQuestions, examInfo, sheetMedia) => {
  if (!sheetMedia?.base64) {
    throw new Error('No answer-sheet image to send to Gemini');
  }
  const ai = getGemini();
  const prompt = `${VISION_SYSTEM_PROMPT}\n\n---\n\n${buildVisionUserPrompt(batchQuestions, examInfo)}`;
  const contents = [
    { text: prompt },
    { inlineData: { mimeType: sheetMedia.mimeType || 'image/jpeg', data: sheetMedia.base64 } },
  ];

  let lastErr;
  for (const modelName of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents,
          ...(attempt === 0 ? { config: { responseMimeType: 'application/json' } } : {}),
        });
        const raw = result.text;
        if (!raw) throw new Error(`Gemini vision (${modelName}) returned empty response`);
        return {
          evaluations: parseEvalResponse(raw, batchQuestions),
          provider: `${modelName}-vision`,
        };
      } catch (err) {
        lastErr = err;
        if (isModelAccessError(err)) break;
        if (attempt === 0) continue;
        if (!isQuotaError(err)) throw err;
        await sleep(parseProviderRetryDelay(err.message, attempt));
      }
    }
  }
  throw lastErr;
};

const assembleReport = (questions, questionEvals, provider) => {
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const marksObtained = questionEvals.reduce((sum, e) => sum + (Number(e.marksAwarded) || 0), 0);
  return {
    questionEvals,
    totalMarks,
    marksObtained,
    percentage: totalMarks
      ? parseFloat(((marksObtained / totalMarks) * 100).toFixed(2))
      : 0,
    provider,
  };
};

const gradeBatch = async (batchQuestions, ocrText, examInfo) => {
  try {
    return await callGroq(batchQuestions, ocrText, examInfo);
  } catch (groqErr) {
    if (!isGroqFallbackError(groqErr) && !isQuotaError(groqErr)) {
      console.warn('[evaluationService] Groq failed, trying Gemini…', groqErr.message);
    }
    try {
      return await callGemini(batchQuestions, ocrText, examInfo);
    } catch (geminiErr) {
      throw new Error(
        `Evaluation batch failed.\n• Groq: ${groqErr.message}\n• Gemini: ${geminiErr.message}`
      );
    }
  }
};

/**
 * Grade one student's sheet against the session answer key + marking scheme.
 * Prefer the sheet photo (Gemini vision). Fall back to OCR text + keywords.
 */
const evaluateAnswerSheet = async ({ questions, ocrText, examInfo, sheetMedia }) => {
  if (!questions?.length) {
    throw new Error('Session has no questions to mark against');
  }

  if (sheetMedia?.base64) {
    try {
      const result = await callGeminiVision(questions, examInfo, sheetMedia);
      const byNumber = new Map(result.evaluations.map((row) => [Number(row.questionNumber), row]));
      const questionEvals = questions.map((q) => {
        const llm = byNumber.get(Number(q.questionNumber)) || {};
        const maxMarks = Number(q.marks) || 0;
        const studentAnswer = String(llm.studentAnswer || '').trim();
        return {
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          modelAnswer: q.modelAnswer || '',
          studentAnswer,
          maxMarks,
          marksAwarded: studentAnswer ? clampMarks(llm.marksAwarded, maxMarks) : 0,
          matchedKeywords: [],
          keywordCoverage: Number(llm.keywordCoverage) || 0,
          semanticScore: Number(llm.semanticScore) || 0,
          strengths: Array.isArray(llm.strengths) ? llm.strengths.map(String) : [],
          weaknesses: Array.isArray(llm.weaknesses) ? llm.weaknesses.map(String) : [],
          feedback: llm.feedback || '',
        };
      });
      return assembleReport(questions, questionEvals, result.provider || 'gemini-vision');
    } catch (err) {
      console.warn('[evaluationService] Vision marking failed, falling back to OCR text:', err.message);
    }
  }

  const text = truncateText(ocrText || '', MAX_OCR_CHARS);
  if (!text.trim()) {
    throw new Error('Answer sheet has no photo or extracted text to evaluate');
  }

  const keywordResult = gradeByKeywords(questions, text);
  const keywordByNumber = new Map(
    keywordResult.evaluations.map((row) => [Number(row.questionNumber), row])
  );

  let llmEvals = [];
  let provider = 'keyword-marking-scheme';

  try {
    const mapped = keywordResult.mappedOcr || text;
    const all = [];
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      if (i > 0 && LLM_BATCH_PAUSE_MS > 0) await sleep(LLM_BATCH_PAUSE_MS);
      const batch = questions.slice(i, i + BATCH_SIZE);
      const result = await gradeBatch(batch, mapped, examInfo);
      all.push(...result.evaluations);
      if (result.provider) provider = `${result.provider}+keywords`;
    }
    llmEvals = all;
  } catch (err) {
    console.warn('[evaluationService] LLM marking skipped, using keyword scores:', err.message);
  }

  const llmByNumber = new Map(llmEvals.map((row) => [Number(row.questionNumber), row]));

  const questionEvals = questions.map((q) => {
    const kw = keywordByNumber.get(Number(q.questionNumber));
    const llm = llmByNumber.get(Number(q.questionNumber));
    const maxMarks = Number(q.marks) || 0;
    const studentAnswer = (kw?.studentAnswer || llm?.studentAnswer || '').trim();
    const keywordMarks = Number(kw?.marksAwarded) || 0;
    const llmMarks = Number(llm?.marksAwarded) || 0;
    // Keyword match is authoritative when the LLM saw "no attempt".
    const marksAwarded = studentAnswer
      ? Math.max(keywordMarks, llmMarks)
      : 0;

    return {
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      modelAnswer: q.modelAnswer || '',
      studentAnswer,
      maxMarks,
      marksAwarded: clampMarks(marksAwarded, maxMarks),
      matchedKeywords: kw?.matchedKeywords || [],
      keywordCoverage: kw?.keywordCoverage ?? llm?.keywordCoverage ?? 0,
      semanticScore: llm?.semanticScore ?? kw?.semanticScore ?? 0,
      strengths: (llm?.strengths?.length ? llm.strengths : kw?.strengths) || [],
      weaknesses: (llm?.weaknesses?.length ? llm.weaknesses : kw?.weaknesses) || [],
      feedback: [kw?.feedback, llm?.feedback].filter(Boolean).join(' '),
    };
  });

  return assembleReport(questions, questionEvals, provider);
};

module.exports = { evaluateAnswerSheet };
