const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const {
  GROQ_GENERATION_INPUT_CHARS,
  isQuotaError,
  parseGeminiRetryDelay,
  sleep,
  truncateDocuments,
} = require('../utils/llmUtils');

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
// ─────────────────────────────────────────────────────────────────────────────
const QUESTION_GENERATION_SYSTEM_PROMPT = `You are an expert academic question paper setter with decades of experience in designing university examination papers.

Your task is to generate a complete, well-structured question paper based on the teacher's exact configuration. You MUST follow the configuration precisely — generate EXACTLY the number and type of questions specified per topic.

## Rules

1. **Strict adherence**: Generate EXACTLY the number of questions of each type and difficulty as specified in the config. Do not add or remove any questions.

2. **Question quality**:
   - MCQ: 4 options (A, B, C, D), one correct answer, include a brief explanation.
   - ShortAnswer: 2–4 sentence expected answer, clear and specific question.
   - MediumAnswer: paragraph-length expected answer.
   - LongAnswer: detailed multi-part answer, may include diagrams/steps.
   - FillInTheBlanks: clear context with one blank; provide the correct answer.

3. **Source fidelity**: Base all questions ONLY on content present in the provided source documents. Do not hallucinate facts.

4. **Difficulty calibration**:
   - Easy: recall/definition level, single concept.
   - Medium: application/analysis level, requires understanding.
   - Hard: synthesis/evaluation level, multi-step reasoning.

5. **No duplication**: Each question must test a distinct concept or sub-topic.

6. **Marks alignment**: Each question's marks must match the marksPerQuestion specified for that question type.

## Output Format

Return ONLY valid JSON — no markdown fences, no prose:

{
  "examTitle": "<string>",
  "subject": "<string>",
  "totalMarks": <number>,
  "totalQuestions": <number>,
  "questions": [
    {
      "id": <integer starting from 1>,
      "topicName": "<string>",
      "type": "MCQ" | "ShortAnswer" | "MediumAnswer" | "LongAnswer" | "FillInTheBlanks",
      "difficulty": "Easy" | "Medium" | "Hard",
      "marks": <number>,
      "questionText": "<string>",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."] or null,
      "correctAnswer": "<string — option letter for MCQ, answer text for others>",
      "explanation": "<brief explanation of the answer>"
    }
  ]
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Build the structured user prompt from teacher's config
// ─────────────────────────────────────────────────────────────────────────────
const buildGenerationPrompt = (config, extractedTexts) => {
  const { examInfo, topics } = config;

  const truncatedTexts = truncateDocuments(extractedTexts, GROQ_GENERATION_INPUT_CHARS);
  const combined = truncatedTexts
    .map((t, i) => `=== SOURCE DOCUMENT ${i + 1} ===\n${t}`)
    .join('\n\n');

  // Build global question types specification
  const qtGlobal = Object.entries(examInfo.questionTypes || {})
    .filter(([, data]) => data.count > 0)
    .map(([qType, data]) => `  - ${qType}: EXACTLY ${data.count} question(s), ${data.marks} mark(s) each.`)
    .join('\n');

  // Build per-topic specification block
  const topicBlocks = topics.map((t, i) => {
    return `Topic ${i + 1}: "${t.topicName}"
  - Allocated Marks: ${t.marks}
  - Difficulty Requirement: ${t.difficulty || 'Mixed'}`;
  }).join('\n\n');

  return `You are generating a question paper with the following EXACT specifications:

## Exam Information
- Title: ${examInfo.examTitle}
- Subject: ${examInfo.subject}
- Total Marks: ${examInfo.totalMarks}
- Duration: ${examInfo.durationMinutes} minutes

## Overall Question Requirements (YOU MUST FOLLOW EXACTLY)
You must generate exactly these question types across the entire paper:
${qtGlobal}

## Per-Topic Constraints (YOU MUST FOLLOW EXACTLY)
You must distribute the above global questions among the topics below.
For each topic, the sum of marks of the questions you assign to it MUST EXACTLY match its "Allocated Marks".
The questions you generate for each topic must align with its "Difficulty Requirement".
You decide which question types to generate for which topic to satisfy BOTH the global question counts and the per-topic allocated marks.

${topicBlocks}

## Source Documents (use ONLY this content for questions)
${combined}

Generate the complete question paper now as valid JSON per the schema.`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Parse and validate the LLM JSON response
// ─────────────────────────────────────────────────────────────────────────────
const parseGenerationResponse = (raw) => {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM response was not valid JSON: ${cleaned.slice(0, 300)}`);
  }

  if (!Array.isArray(parsed.questions)) {
    throw new Error('LLM response missing "questions" array');
  }

  const VALID_Q_DIFFICULTY = ['Easy', 'Medium', 'Hard'];
  const sanitizeDiff = (d) => (VALID_Q_DIFFICULTY.includes(d) ? d : 'Medium');

  // Normalise each question
  const questions = parsed.questions.map((q, idx) => ({
    id:           q.id          ?? idx + 1,
    topicName:    q.topicName   ?? '',
    type:         q.type        ?? 'ShortAnswer',
    difficulty:   sanitizeDiff(q.difficulty),
    marks:        q.marks       ?? 0,
    questionText: q.questionText ?? '',
    options:      Array.isArray(q.options) ? q.options : null,
    correctAnswer: q.correctAnswer ?? '',
    explanation:  q.explanation  ?? '',
    approved:     false,   // teacher must review & approve
  }));

  return {
    examTitle:      parsed.examTitle      || '',
    subject:        parsed.subject        || '',
    totalMarks:     parsed.totalMarks     || 0,
    totalQuestions: parsed.totalQuestions || questions.length,
    questions,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Groq (Llama 3) provider
// ─────────────────────────────────────────────────────────────────────────────
const generateWithGroq = async (config, extractedTexts) => {
  const groq = getGroq();
  const userPrompt = buildGenerationPrompt(config, extractedTexts);

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature: 0.4,       // slightly higher for creative question wording
    max_tokens: 4096,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: QUESTION_GENERATION_SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq returned an empty response');

  return {
    ...parseGenerationResponse(raw),
    provider: 'groq-llama-3.1-8b',
    usage: {
      promptTokens:     response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens:      response.usage?.total_tokens,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Gemini fallback provider
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash'];

const generateWithGemini = async (config, extractedTexts) => {
  const ai = getGemini();
  const userPrompt = buildGenerationPrompt(config, extractedTexts);
  const fullPrompt = `${QUESTION_GENERATION_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;

  let lastErr;
  for (const modelName of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[questionGenerationService] Trying Gemini ${modelName} (attempt ${attempt + 1})…`);
        const result = await ai.models.generateContent({ model: modelName, contents: fullPrompt });
        const raw = result.text;
        if (!raw) throw new Error(`Gemini (${modelName}) returned empty response`);
        return { ...parseGenerationResponse(raw), provider: modelName, usage: null };
      } catch (err) {
        lastErr = err;
        if (!isQuotaError(err)) throw err;
        const delayMs = parseGeminiRetryDelay(err.message, attempt);
        console.warn(`[questionGenerationService] ${modelName} unavailable/rate-limited, waiting ${Math.round(delayMs / 1000)}s…`);
        await sleep(delayMs);
      }
    }
    console.warn(`[questionGenerationService] ${modelName} exhausted, trying next model…`);
  }
  throw lastErr;
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — generateQuestions
//
//   config         : { examInfo, difficultyDistribution, topics[] }
//   extractedTexts : string[]   — one per source document
//   Returns        : { examTitle, subject, totalMarks, totalQuestions, questions[], provider, usage }
// ─────────────────────────────────────────────────────────────────────────────
const generateQuestions = async (config, extractedTexts) => {
  try {
    console.log('[questionGenerationService] Attempting with Groq…');
    const result = await generateWithGroq(config, extractedTexts);
    console.log(`[questionGenerationService] Groq succeeded — ${result.questions.length} questions`);
    return result;
  } catch (groqErr) {
    if (isQuotaError(groqErr)) {
      console.warn('[questionGenerationService] Groq quota exceeded, falling back to Gemini…');
      try {
        const result = await generateWithGemini(config, extractedTexts);
        console.log(`[questionGenerationService] Gemini succeeded via ${result.provider} — ${result.questions.length} questions`);
        return result;
      } catch (geminiErr) {
        throw new Error(
          `All LLM providers failed.\n• Groq: ${groqErr.message}\n• Gemini: ${geminiErr.message}`
        );
      }
    }
    throw groqErr;
  }
};

module.exports = { generateQuestions };
