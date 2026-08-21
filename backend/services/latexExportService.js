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
\\usepackage{microtype}

\\definecolor{vgblue}{RGB}{37,99,235}
\\definecolor{vggrey}{RGB}{100,116,139}

\\emergencystretch=2em
\\sloppy

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
    if (Array.isArray(q.markingCriteria) && q.markingCriteria.length) {
      block += `\\noindent{\\textcolor{vgblue}{\\textbf{Marking Scheme:}}}\n\\par\n`;
      q.markingCriteria.forEach((c) => {
        block += `\\noindent $\\bullet$~${tex(`${c.marks} mark${Number(c.marks) === 1 ? '' : 's'}: ${c.point}`)}\n\\par\n`;
      });
    } else if (q.markingScheme) {
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

// ─── Evaluation report (Module 2 — per-student scored sheet) ─────────────────
const MATCH_LEVEL_LABEL = { full: 'Full credit', partial: 'Half credit', none: 'No credit' };

const buildReportHeader = (report, session) => {
  const examTitle = esc(session?.examTitle || 'Examination');
  const subject   = esc(session?.subject   || '');
  const student    = esc(report.studentName || 'Unnamed Student');
  const roll       = esc(report.rollNumber  || '—');
  const total      = report.totalMarks    ?? 0;
  const obtained   = report.marksObtained ?? 0;
  const percentage = report.percentage    ?? 0;
  const date       = new Date(report.updatedAt || report.createdAt || Date.now())
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return `
{\\centering
  {\\LARGE\\bfseries ${examTitle}\\par}
  \\vspace{0.3em}
  {\\large\\textcolor{vggrey}{${subject}}\\par}
  \\vspace{0.2em}
  {\\normalsize\\bfseries\\textcolor{vgblue}{Evaluated Answer Sheet}\\par}
  \\vspace{0.8em}
  \\begin{tabularx}{\\textwidth}{|X|X|X|X|}
    \\hline
    \\textbf{Student:} ${student} &
    \\textbf{Roll No:} ${roll} &
    \\textbf{Score:} ${obtained}/${total} (${percentage}\\%) &
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

/** One scored question — student's answer, marks, and the step-marking breakdown behind the score. */
const buildScoredQuestion = (row) => {
  const maxMarks = row.maxMarks ?? 0;
  const awarded  = row.isOverridden ? (row.overriddenMarks ?? row.marksAwarded) : row.marksAwarded;
  const marksStr = `${awarded}/${maxMarks} mark${maxMarks === 1 ? '' : 's'}`;

  let block = `\\noindent\\textbf{Q${row.questionNumber}.}\\quad`;
  block    += `{\\bfseries\\textcolor{vgblue}{${esc(marksStr)}}}`;
  if (row.isOverridden) block += `{\\small\\textcolor{vggrey}{~(overridden by faculty)}}`;
  block    += `\n\\par\n`;
  block    += `\\noindent ${tex(row.questionText)}\n\\par\n`;

  block += `\\vspace{0.3em}\n`;
  block += `\\noindent{\\textcolor{vgblue}{\\textbf{Student's Answer:}}}\n\\par\n`;
  block += `\\noindent ${row.studentAnswer ? tex(row.studentAnswer) : '\\textit{No answer found on the sheet for this question.}'}\n\\par\n`;

  if (Array.isArray(row.criteriaBreakdown) && row.criteriaBreakdown.length) {
    block += `\\vspace{0.3em}\n`;
    block += `\\noindent{\\textcolor{vgblue}{\\textbf{Marking Scheme (Step Marking):}}}\n\\par\n`;
    row.criteriaBreakdown.forEach((c) => {
      const label = MATCH_LEVEL_LABEL[c.matchLevel] || 'No credit';
      block += `\\noindent $\\bullet$~${tex(`${c.point} — ${c.marksAwarded}/${c.maxMarks} (${label})`)}\n\\par\n`;
    });
  } else if (row.modelAnswer) {
    block += `\\vspace{0.3em}\n`;
    block += `\\noindent{\\textcolor{vgblue}{\\textbf{Model Answer:}}}\n\\par\n`;
    block += `\\noindent ${tex(row.modelAnswer)}\n\\par\n`;
  }

  if (row.feedback) {
    block += `\\vspace{0.2em}\n`;
    block += `{\\small\\textcolor{vggrey}{\\textbf{Feedback:}~${tex(row.feedback)}}}\n\\par\n`;
  }

  block += `\\vspace{0.5em}\n\\noindent\\textcolor{vggrey!30}{\\rule{\\textwidth}{0.2pt}}\n\\vspace{0.3em}\n`;
  return block;
};

const buildEvaluationReportLatex = (report, session) => {
  const rows = report.questionEvals || [];
  const body = rows.length
    ? rows.map(buildScoredQuestion).join('\n')
    : '\\textit{No questions were evaluated for this sheet.}\n';

  return `${PREAMBLE}
\\begin{document}
\\thispagestyle{firstpage}
${buildReportHeader(report, session)}
{\\bfseries\\large\\textcolor{vgblue}{Question-wise Evaluation}}
\\vspace{0.4em}

${body}
\\end{document}
`;
};

module.exports = { buildQuestionPaperLatex, buildAnswerKeyLatex, buildEvaluationReportLatex };
