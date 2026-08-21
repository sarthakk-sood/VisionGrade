const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const {
  GEMINI_MODELS,
  OPENROUTER_VISION_MODELS,
  getOpenRouter,
  hasOpenRouter,
  extractChatContent,
  isModelAccessError,
  isQuotaError,
  parseJsonFromLlm,
  parseProviderRetryDelay,
  sleep,
} = require('../utils/llmUtils');

const { buildMarkingPayload, resolveCriteria } = require('../utils/markingCriteria');
const { stepMarkByKeywords, roundHalf, normalize } = require('../utils/stepMarking');

/**
 * Vision-capable Groq model used when Gemini vision fails or is rate-limited.
 * NOTE: as of writing, Groq only offers vision on Llama 4 Scout/Maverick, and
 * those are NOT enabled on every account/API key (some keys get a 404 "model
 * does not exist or you do not have access to it" even though the model is
 * real). If that happens for your key, Groq vision will always fail over to
 * OpenRouter — that's expected, not a bug, until Groq enables it for your key.
 */
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

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

const VISION_SYSTEM_PROMPT = `You are a university examiner marking a PHOTOGRAPH of a handwritten answer sheet.

You receive the official questions (max marks, model answer, MARKING SCHEME) and the student's sheet image/PDF.

## How to read the sheet
- This is a REAL handwritten answer sheet — read it carefully like a human examiner, even if the handwriting is messy, slanted, cursive, or uses different pen colours.
- Locate each question by its number label (e.g. "Q1", "1.", "1)", "Ans 1", etc). These may sit in a printed left margin next to a ruled line (common in Indian university answer booklets), inline before the answer, or above it on plain/ruled paper. Do NOT assume one fixed template — find the numbers wherever they appear on the page and read whatever handwriting follows each one.
- An answer may wrap onto later lines, continue on another part of the page (look for arrows or "contd." marks), or be squeezed into a margin. Follow it to completion before deciding what was written.
- If the image is rotated, skewed, low-contrast, blurry, or partially cropped, still make your best-effort reading of every visible character rather than giving up.
- Only mark a question as not attempted if there is genuinely no handwriting anywhere near that question number — never guess "not attempted" just because the layout looks unfamiliar.
- If part of an answer is crossed out or struck through, ignore the struck-out text and transcribe the final (non-struck) version.
- Transcribe exactly what is written. Do not invent answers. Do not use any OCR dump.

## Step marking (award each criterion independently)
Each question lists its MARKING CRITERIA as a JSON array of { "point": "...", "marks": N }.
For EVERY point in that array, decide a matchLevel by comparing it to what the student wrote:
- "full"    — the point / concept / required keyword(s) are clearly and correctly present. Award the point's full marks.
- "partial" — some but not all of the point is present (e.g. only one of two required keywords, a vague or incomplete mention, right idea but missing detail). Award HALF of the point's marks (round to the nearest 0.5).
- "none"    — the point is missing entirely, or the question was not attempted. Award 0 for that point.

Sum of all per-point awards = marksAwarded for the question (capped at max_marks, decimals allowed, e.g. 1.5).

## Other rules
1. MCQ: the student may write ONLY the option letter (A/B/C/D), the full option text, or both — all are valid. Match the letter/text against the "Options" list and "Correct / key" given for that question to decide correctness. Treat it as ONE criterion — matchLevel "full" (full marks) if it identifies the correct option, "none" (0) otherwise. NEVER split an MCQ into multiple criteria and NEVER award partial credit for MCQ.
2. Fill-in / one-word: one criterion — "full" if the written word matches the key (ignore case/punctuation), otherwise "none".
3. If not attempted, every criterion is "none", marksAwarded = 0, studentAnswer = "".
4. studentAnswer is your transcription of that question from the photo.
5. Return one entry in "criteria" for EVERY item in that question's MARKING CRITERIA array, in the same order, using the same "point" text.

Return ONLY valid JSON:
{
  "evaluations": [
    {
      "questionNumber": 1,
      "studentAnswer": "<what you read on the page>",
      "criteria": [
        { "point": "<criterion point text, copied exactly>", "matchLevel": "full", "marksAwarded": 1 }
      ],
      "marksAwarded": 1.5,
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
    'Marking criteria JSON (return one "criteria" entry per item, in order):',
    JSON.stringify(buildMarkingPayload(q), null, 2),
  ].filter(Boolean).join('\n');
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
Read Q1…Q${questions.length} from the page and step-mark every question listed above using its marking criteria.
Return JSON only.`;
};

const clampMarks = (awarded, max) => {
  const n = Number(awarded);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, roundHalf(n)));
};

/** Normalize an LLM "matchLevel" + per-point max into a clamped mark. */
const marksForMatchLevel = (matchLevel, maxMarks) => {
  const level = String(matchLevel || '').toLowerCase();
  if (level === 'full') return maxMarks;
  if (level === 'partial') return roundHalf(maxMarks / 2);
  return 0;
};

const levelForMarks = (awarded, maxMarks) => {
  if (maxMarks <= 0) return 'none';
  if (awarded >= maxMarks) return 'full';
  if (awarded > 0) return 'partial';
  return 'none';
};

/** Pull a bare option letter (A-D) out of the official "correctAnswer" field, e.g. "B" or "B. Some text". */
const correctOptionLetter = (question) => {
  const m = String(question?.correctAnswer || '').trim().match(/^([A-D])\b/i);
  return m ? m[1].toUpperCase() : null;
};

/** Find the full option text for a given letter, e.g. "B" -> "B. Merge Sort" -> "Merge Sort". */
const optionTextForLetter = (question, letter) => {
  if (!letter || !Array.isArray(question?.options)) return '';
  const re = new RegExp(`^${letter}[.):]\\s*`, 'i');
  const match = question.options.find((o) => re.test(String(o || '').trim()));
  return match ? String(match).trim().replace(re, '').trim() : '';
};

/** Pull a bare option letter (A-D) out of whatever the student actually wrote. */
const extractStudentOptionLetter = (studentAnswer) => {
  const text = String(studentAnswer || '').trim();
  if (!text) return null;
  // Prefer an isolated letter (whole answer, or "Option B", "(B)", "B.", "B)") over a letter
  // that just happens to appear inside a longer restated sentence.
  const isolated = text.match(/^\(?([A-D])\)?[.):]?\s*$/i) || text.match(/\boption\s*([A-D])\b/i);
  if (isolated) return isolated[1].toUpperCase();
  const anywhere = text.match(/^\(?([A-D])\)?[.):]/i);
  return anywhere ? anywhere[1].toUpperCase() : null;
};

/**
 * MCQ (and fill-in/one-word) questions are strictly all-or-nothing — no step
 * marking, no partial credit. This remembers which option letter maps to
 * which answer text so a sheet that only records the letter (no restated
 * option text) can still be graded deterministically, as a floor under
 * whatever the vision LLM itself decided.
 */
const stepMarkMcq = (question, llmRow, studentAnswer) => {
  const maxMarks = Number(question.marks) || 0;
  const llmAwarded = clampMarks(llmRow?.marksAwarded, maxMarks);

  const correctLetter = correctOptionLetter(question);
  const correctText = normalize(optionTextForLetter(question, correctLetter) || question.correctAnswer);
  const studentLetter = extractStudentOptionLetter(studentAnswer);
  const studentText = normalize(studentAnswer);

  let deterministicAward = 0;
  if (correctLetter && studentLetter) {
    deterministicAward = studentLetter === correctLetter ? maxMarks : 0;
  } else if (correctText && studentText) {
    deterministicAward = studentText === correctText || studentText.includes(correctText) ? maxMarks : 0;
  }

  return { breakdown: [], marksAwarded: Math.max(llmAwarded, deterministicAward) };
};

/** Fill-in-the-blank / one-word answers are also all-or-nothing — exact (normalized) match only. */
const stepMarkFillInTheBlank = (question, llmRow, studentAnswer) => {
  const maxMarks = Number(question.marks) || 0;
  const llmAwarded = clampMarks(llmRow?.marksAwarded, maxMarks);

  const key = normalize(question.correctAnswer);
  const given = normalize(studentAnswer);
  const deterministicAward = key && given && (given === key || given.includes(key)) ? maxMarks : 0;

  return { breakdown: [], marksAwarded: Math.max(llmAwarded, deterministicAward) };
};

/**
 * Blend the LLM's per-criterion step marking with a deterministic keyword
 * cross-check so a criterion is never scored lower than plain keyword overlap
 * would give it. Returns the per-criterion breakdown plus the summed marks.
 *
 * MCQ and FillInTheBlanks are all-or-nothing by nature, so they skip
 * decomposition entirely (empty breakdown -> no "step marking" shown).
 */
const stepMarkQuestion = (question, llmRow, studentAnswer) => {
  const type = String(question?.type || '').trim();
  if (type === 'MCQ') return stepMarkMcq(question, llmRow, studentAnswer);
  if (type === 'FillInTheBlanks') return stepMarkFillInTheBlank(question, llmRow, studentAnswer);

  const officialCriteria = resolveCriteria(question);
  const keywordPass = stepMarkByKeywords(question, studentAnswer);

  if (!officialCriteria.length) {
    // No structured criteria (e.g. legacy paper) — trust the LLM's overall mark.
    const maxMarks = Number(question.marks) || 0;
    return { breakdown: [], marksAwarded: clampMarks(llmRow?.marksAwarded, maxMarks) };
  }

  const llmCriteria = Array.isArray(llmRow?.criteria) ? llmRow.criteria : [];

  const breakdown = officialCriteria.map((point, idx) => {
    const maxMarks = Number(point.marks) || 0;
    const llmPoint = llmCriteria[idx] || llmCriteria.find(
      (c) => String(c?.point || '').trim().toLowerCase() === point.point.trim().toLowerCase()
    );
    const llmAwarded = llmPoint ? clampMarks(
      llmPoint.marksAwarded ?? marksForMatchLevel(llmPoint.matchLevel, maxMarks),
      maxMarks
    ) : 0;

    const kwRow = keywordPass.breakdown[idx];
    const kwAwarded = kwRow ? clampMarks(kwRow.marksAwarded, maxMarks) : 0;

    const marksAwarded = Math.max(llmAwarded, kwAwarded);
    const matchLevel = String(llmPoint?.matchLevel || '').toLowerCase() || levelForMarks(marksAwarded, maxMarks);

    return {
      point: point.point,
      maxMarks,
      matchLevel: marksAwarded >= maxMarks && maxMarks > 0 ? 'full' : levelForMarks(marksAwarded, maxMarks),
      marksAwarded,
      matchedKeywords: kwRow?.matchedKeywords || [],
    };
  });

  const maxMarks = Number(question.marks) || 0;
  const summed = breakdown.reduce((sum, row) => sum + row.marksAwarded, 0);
  return { breakdown, marksAwarded: clampMarks(summed, maxMarks) };
};

const parseEvalResponse = (raw) => {
  const parsed = parseJsonFromLlm(raw);
  const rows = Array.isArray(parsed.evaluations) ? parsed.evaluations : [];
  if (!rows.length) {
    throw new Error('LLM response is missing "evaluations" array');
  }
  return new Map(rows.map((r) => [Number(r.questionNumber), r]));
};

/** Primary: Gemini reads the sheet photo/PDF directly and grades it. */
const callGeminiVision = async (questions, examInfo, sheetMedia) => {
  if (!sheetMedia?.base64) {
    throw new Error('No answer-sheet image to send to Gemini');
  }
  const ai = getGemini();
  const prompt = `${VISION_SYSTEM_PROMPT}\n\n---\n\n${buildVisionUserPrompt(questions, examInfo)}`;
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
        return { byNumber: parseEvalResponse(raw), provider: `${modelName}-vision` };
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

/** Fallback LLM: Groq vision model reads the same image if Gemini is unavailable. */
const callGroqVision = async (questions, examInfo, sheetMedia) => {
  if (!sheetMedia?.base64) {
    throw new Error('No answer-sheet image to send to Groq');
  }
  if (!/^image\//i.test(sheetMedia.mimeType || '')) {
    throw new Error(`Groq vision only accepts image files, got "${sheetMedia.mimeType}"`);
  }

  const groq = getGroq();
  const prompt = `${VISION_SYSTEM_PROMPT}\n\n---\n\n${buildVisionUserPrompt(questions, examInfo)}`;
  const dataUrl = `data:${sheetMedia.mimeType};base64,${sheetMedia.base64}`;
  const maxTokens = Math.min(16384, Math.max(4096, questions.length * 400 + 1200));

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await groq.chat.completions.create({
        model: GROQ_VISION_MODEL,
        temperature: 0.15,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      });
      const { content } = extractChatContent(response);
      if (!content) throw new Error('Groq vision returned an empty response');
      return { byNumber: parseEvalResponse(content), provider: `groq-${GROQ_VISION_MODEL}-vision` };
    } catch (err) {
      lastErr = err;
      if (isQuotaError(err) && attempt < 2) {
        await sleep(parseProviderRetryDelay(err.message, attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
};

/**
 * Third-tier fallback: OpenRouter vision model(s), used when Gemini AND Groq
 * are both unavailable. Tries each model in OPENROUTER_VISION_MODELS in
 * order — free-tier slugs on OpenRouter get retired/renamed periodically, and
 * each free model has its own separate rate limit, so trying a second one
 * before giving up meaningfully improves odds of a successful grade.
 */
const callOpenRouterVision = async (questions, examInfo, sheetMedia) => {
  if (!sheetMedia?.base64) {
    throw new Error('No answer-sheet image to send to OpenRouter');
  }
  if (!/^image\//i.test(sheetMedia.mimeType || '')) {
    throw new Error(`OpenRouter vision only accepts image files, got "${sheetMedia.mimeType}"`);
  }

  const openrouter = getOpenRouter();
  const prompt = `${VISION_SYSTEM_PROMPT}\n\n---\n\n${buildVisionUserPrompt(questions, examInfo)}`;
  const dataUrl = `data:${sheetMedia.mimeType};base64,${sheetMedia.base64}`;
  const maxTokens = Math.min(16384, Math.max(4096, questions.length * 400 + 1200));

  let lastErr;
  for (const modelName of OPENROUTER_VISION_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await openrouter.chat.completions.create({
          model: modelName,
          temperature: 0.15,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        });
        const { content } = extractChatContent(response);
        if (!content) throw new Error(`OpenRouter vision (${modelName}) returned an empty response`);
        return { byNumber: parseEvalResponse(content), provider: `openrouter-${modelName}-vision` };
      } catch (err) {
        lastErr = err;
        if (isModelAccessError(err)) break; // try next model, no point retrying a 404
        if (isQuotaError(err) && attempt < 2) {
          await sleep(parseProviderRetryDelay(err.message, attempt));
          continue;
        }
        break; // non-retryable error on this model — try the next one
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

/**
 * Grade one student's sheet against the session answer key + marking scheme.
 * Reads the sheet photo directly with Gemini vision; if that fails, falls back
 * to a Groq vision model. LLM only — no OCR, no legacy keyword-only marking.
 *
 * Each marking-criteria point is step-marked independently (full / half /
 * zero), blending the LLM's own judgement with a deterministic keyword
 * cross-check so partial keyword matches are never missed.
 */
const evaluateAnswerSheet = async ({ questions, examInfo, sheetMedia }) => {
  if (!questions?.length) {
    throw new Error('Session has no questions to mark against');
  }
  if (!sheetMedia?.base64) {
    throw new Error(
      'Could not load the answer-sheet image/PDF for scoring. Check that the file uploaded ' +
      'successfully to Cloudinary and try again.'
    );
  }

  let result;
  let geminiErr;
  try {
    result = await callGeminiVision(questions, examInfo, sheetMedia);
  } catch (err) {
    geminiErr = err;
    console.warn('[evaluationService] Gemini vision failed, trying Groq vision…', err.message);
    try {
      result = await callGroqVision(questions, examInfo, sheetMedia);
    } catch (groqErr) {
      if (!hasOpenRouter()) {
        throw new Error(
          `Evaluation failed — both vision LLMs were unable to score this sheet.\n` +
          `• Gemini: ${geminiErr.message}\n` +
          `• Groq: ${groqErr.message}`
        );
      }
      console.warn('[evaluationService] Groq vision failed, trying OpenRouter vision…', groqErr.message);
      try {
        result = await callOpenRouterVision(questions, examInfo, sheetMedia);
      } catch (openrouterErr) {
        throw new Error(
          `Evaluation failed — all vision LLMs were unable to score this sheet.\n` +
          `• Gemini: ${geminiErr.message}\n` +
          `• Groq: ${groqErr.message}\n` +
          `• OpenRouter: ${openrouterErr.message}`
        );
      }
    }
  }

  const questionEvals = questions.map((q) => {
    const llm = result.byNumber.get(Number(q.questionNumber)) || {};
    const maxMarks = Number(q.marks) || 0;
    const studentAnswer = String(llm.studentAnswer || '').trim();

    if (!studentAnswer) {
      return {
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        modelAnswer: q.modelAnswer || '',
        studentAnswer: '',
        maxMarks,
        marksAwarded: 0,
        matchedKeywords: [],
        criteriaBreakdown: [],
        keywordCoverage: 0,
        semanticScore: 0,
        strengths: [],
        weaknesses: Array.isArray(llm.weaknesses) ? llm.weaknesses.map(String) : [],
        feedback: llm.feedback || 'No answer found for this question on the sheet.',
      };
    }

    const { breakdown, marksAwarded } = stepMarkQuestion(q, llm, studentAnswer);
    const matchedKeywords = unique(breakdown.flatMap((row) => row.matchedKeywords || []));
    const coverage = maxMarks ? marksAwarded / maxMarks : 0;

    return {
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      modelAnswer: q.modelAnswer || '',
      studentAnswer,
      maxMarks,
      marksAwarded,
      matchedKeywords,
      criteriaBreakdown: breakdown,
      keywordCoverage: parseFloat(coverage.toFixed(2)),
      semanticScore: parseFloat(coverage.toFixed(2)),
      strengths: Array.isArray(llm.strengths) ? llm.strengths.map(String) : [],
      weaknesses: Array.isArray(llm.weaknesses) ? llm.weaknesses.map(String) : [],
      feedback: llm.feedback || '',
    };
  });

  return assembleReport(questions, questionEvals, result.provider);
};

function unique(arr) {
  return [...new Set(arr)];
}

module.exports = { evaluateAnswerSheet };
