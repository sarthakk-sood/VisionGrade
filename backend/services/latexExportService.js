/**
 * latexExportService.js
 * Generates clean, properly-aligned LaTeX for question papers and answer keys.
 *
 * Deliberately simple to avoid tectonic 0.3.2 quirks:
 *  - No \enumerate for questions (avoids double-label shift)
 *  - No hyperref (causes blank page in tectonic 0.3.2)
 *  - No parskip (causes extra page breaks with \section*)
 *  - No \leftmark in fancyhdr (starred sections don't set marks → blank pages)
 *  - Questions are plain \noindent blocks separated by \medskip
 */

const { escapeLatex } = require('../utils/latexEscape');

const esc = (s) => escapeLatex(s ?? '');

/** Convert text to safe LaTeX — single newlines become spaces, double become \par */
const tex = (text) => {
  if (!text) return '';
  return esc(String(text))
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, ' \\par\n')
    .replace(/\n/g, ' ');
};

const TYPE_LABEL = {
  MCQ:             'Multiple Choice',
  ShortAnswer:     'Short Answer',
  MediumAnswer:    'Medium Answer',
  LongAnswer:      'Long Answer',
  FillInTheBlanks: 'Fill in the Blanks',
};

// ─── Preamble — minimal and robust ────────────────────────────────────────────
const PREAMBLE = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[left=2.5cm,right=2.5cm,top=3cm,bottom=2.5cm]{geometry}
\\usepackage{xcolor}
\\usepackage{fancyhdr}
\\usepackage{enumitem}
\\usepackage{array}
\\usepackage{tabularx}

\\definecolor{vgblue}{RGB}{37,99,235}
\\definecolor{vggrey}{RGB}{100,116,139}

% Simple page style — NO \\leftmark so no blank pages from starred sections
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0.4pt}
\\fancyhead[L]{\\small\\textcolor{vggrey}{VisionGrade}}
\\fancyhead[R]{\\small\\thepage}
\\fancyfoot[C]{\\small\\textcolor{vggrey}{VisionGrade --- AI Academic Evaluation Platform}}

% First page: no header rule, but keep footer
\\fancypagestyle{firstpage}{%
  \\fancyhf{}%
  \\renewcommand{\\headrulewidth}{0pt}%
  \\renewcommand{\\footrulewidth}{0pt}%
  \\fancyfoot[C]{\\small\\textcolor{vggrey}{VisionGrade --- AI Academic Evaluation Platform}}%
}

\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.4em}
\\raggedbottom
`;

// ─── Header ───────────────────────────────────────────────────────────────────
const buildHeader = (session, docLabel) => {
  const title    = esc(session.examTitle || 'Examination Paper');
  const subject  = esc(session.subject   || '');
  const marks    = session.totalMarks    ?? 0;
  const duration = session.durationMinutes ?? 90;
  const count    = session.questionCount  ?? session.questions?.length ?? 0;
  const date     = new Date(session.finalizedAt || Date.now())
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return `
{\\centering
  {\\LARGE\\bfseries ${title}\\par}
  \\vspace{0.3em}
  {\\large\\textcolor{vggrey}{${subject}}\\par}
  \\vspace{0.2em}
  {\\normalsize\\bfseries\\textcolor{vgblue}{${esc(docLabel)}}\\par}
  \\vspace{0.8em}
  \\begin{tabularx}{\\textwidth}{|X|X|X|X|}
    \\hline
    \\textbf{Marks:} ${marks} &
    \\textbf{Duration:} ${duration} min &
    \\textbf{Questions:} ${count} &
    \\textbf{Date:} ${esc(date)} \\\\
    \\hline
  \\end{tabularx}
  \\par
}
\\vspace{0.6em}
\\noindent\\rule{\\textwidth}{0.8pt}
\\vspace{0.4em}
`;
};

// ─── Instructions ─────────────────────────────────────────────────────────────
const buildInstructions = () => `
{\\bfseries\\large\\textcolor{vgblue}{General Instructions}}
\\vspace{0.3em}

\\begin{itemize}[leftmargin=1.5em,itemsep=0.15em,topsep=0.1em]
  \\item Read all questions carefully before answering.
  \\item Write your answers clearly in the space provided.
  \\item Marks for each question are indicated in square brackets.
  \\item All questions are compulsory unless stated otherwise.
\\end{itemize}
\\vspace{0.3em}
\\noindent\\rule{\\textwidth}{0.4pt}
\\vspace{0.3em}
`;

// ─── MCQ options ──────────────────────────────────────────────────────────────
const formatMcqOptions = (options) => {
  if (!options?.length) return '';
  const cols = options.length <= 2 ? 2 : 1;
  if (cols === 2 && options.length === 4) {
    // 2x2 grid for 4-option MCQ
    return `\\vspace{0.2em}
\\begin{tabular}{@{} p{0.45\\textwidth} p{0.45\\textwidth} @{}}
  (a)~${tex(options[0])} & (b)~${tex(options[1])} \\\\[0.3em]
  (c)~${tex(options[2])} & (d)~${tex(options[3])} \\\\
\\end{tabular}
\\vspace{0.2em}
`;
  }
  const items = options.map((opt, i) =>
    `  \\item[(${String.fromCharCode(97 + i)})] ${tex(opt)}`
  ).join('\n');
  return `\\vspace{0.2em}
\\begin{itemize}[leftmargin=2.5em,itemsep=0.1em,topsep=0.1em,label={}]
${items}
\\end{itemize}
\\vspace{0.2em}
`;
};

// ─── Answer lines for students ────────────────────────────────────────────────
const buildAnswerLines = (type) => {
  const count = type === 'MCQ'         ? 0
              : type === 'ShortAnswer'  ? 3
              : type === 'MediumAnswer' ? 5
              : 8;
  if (count === 0) return '';
  const lines = Array(count).fill('\\noindent\\makebox[\\textwidth]{\\hrulefill}').join('\\\\\n');
  return `\\vspace{0.3em}\n${lines}\n\\vspace{0.2em}\n`;
};

// ─── Single question ──────────────────────────────────────────────────────────
const buildQuestion = (q, num, includeAnswers) => {
  const typeLabel = TYPE_LABEL[q.type] || q.type || 'Question';
  const marks     = q.marks ?? 0;
  const marksStr  = `[${marks} mark${marks === 1 ? '' : 's'}]`;
  const diff      = q.difficulty ? ` (${esc(q.difficulty)})` : '';
  const topic     = q.topicName  ? ` \\textit{| ${esc(q.topicName)}}` : '';

  let block = `\\noindent\\textbf{Q${num}.}\\quad`;
  block    += `{\\small\\textcolor{vggrey}{${esc(typeLabel)}${diff}${topic}}}\\quad`;
  block    += `{\\bfseries\\textcolor{vgblue}{${marksStr}}}\n`;
  block    += `\\par\n`;
  block    += `\\noindent ${tex(q.questionText)}\n`;
  block    += `\\par\n`;

  if (q.type === 'MCQ' && q.options?.length) {
    block += formatMcqOptions(q.options);
  }

  if (!includeAnswers) {
    block += buildAnswerLines(q.type);
  } else {
    block += `\\vspace{0.3em}\n`;
    block += `\\noindent{\\textcolor{vgblue}{\\textbf{Correct Answer:}}}~${tex(q.correctAnswer || '---')}\n\\par\n`;
    if (q.modelAnswer) {
      block += `\\noindent{\\textcolor{vgblue}{\\textbf{Model Answer:}}}\n\\par\n`;
      block += `\\noindent ${tex(q.modelAnswer)}\n\\par\n`;
    }
    if (q.markingScheme) {
      block += `\\noindent{\\textcolor{vgblue}{\\textbf{Marking Scheme:}}}\n\\par\n`;
      block += `\\noindent ${tex(q.markingScheme)}\n\\par\n`;
    }
    if (q.explanation) {
      block += `{\\small\\textcolor{vggrey}{\\textbf{Note:}~${tex(q.explanation)}}}\n\\par\n`;
    }
  }

  // Separator between questions
  block += `\\vspace{0.5em}\n\\noindent\\textcolor{vggrey!30}{\\rule{\\textwidth}{0.2pt}}\n\\vspace{0.3em}\n`;

  return block;
};

// ─── All questions ─────────────────────────────────────────────────────────────
const buildAllQuestions = (questions, includeAnswers) => {
  if (!questions.length) return '\\textit{No questions available.}\n';
  return questions.map((q, i) => buildQuestion(q, i + 1, includeAnswers)).join('\n');
};

// ─── Public API ────────────────────────────────────────────────────────────────
const buildQuestionPaperLatex = (session) => {
  const questions = session.questions || [];
  return `${PREAMBLE}
\\begin{document}
\\thispagestyle{firstpage}
${buildHeader(session, 'Question Paper')}
${buildInstructions()}
{\\bfseries\\large\\textcolor{vgblue}{Questions}}
\\vspace{0.4em}

${buildAllQuestions(questions, false)}
\\end{document}
`;
};

const buildAnswerKeyLatex = (session) => {
  const questions = session.questions || [];
  const provider  = esc(session.answerProvider || 'LLM');

  return `${PREAMBLE}
\\begin{document}
\\thispagestyle{firstpage}
${buildHeader(session, 'Model Answer Key --- For Faculty Use Only')}

{\\bfseries\\large\\textcolor{vgblue}{Answer Key Overview}}
\\vspace{0.3em}

\\noindent This document contains official model answers and marking schemes
for faculty evaluation. Answers were produced using \\textbf{${provider}}.
\\vspace{0.4em}
\\noindent\\rule{\\textwidth}{0.4pt}
\\vspace{0.3em}

{\\bfseries\\large\\textcolor{vgblue}{Detailed Answers}}
\\vspace{0.4em}

${buildAllQuestions(questions, true)}
\\end{document}
`;
};

module.exports = { buildQuestionPaperLatex, buildAnswerKeyLatex };
