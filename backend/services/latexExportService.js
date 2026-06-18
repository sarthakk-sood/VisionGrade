const { escapeLatex, latexParagraph } = require('../utils/latexEscape');

const TYPE_LABEL = {
  MCQ: 'Multiple Choice',
  ShortAnswer: 'Short Answer',
  MediumAnswer: 'Medium Answer',
  LongAnswer: 'Long Answer',
  FillInTheBlanks: 'Fill in the Blanks',
};

const PREAMBLE = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[margin=2.5cm,top=2.8cm,bottom=2.5cm]{geometry}
\\usepackage{enumitem}
\\usepackage{fancyhdr}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage{hyperref}
\\usepackage{array}
\\usepackage{booktabs}

\\definecolor{vgblue}{RGB}{37,99,235}
\\definecolor{vggrey}{RGB}{100,116,139}

\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0.4pt}
\\fancyfoot[C]{\\small\\textcolor{vggrey}{VisionGrade --- AI Academic Evaluation Platform}}

\\titleformat{\\section}{\\large\\bfseries\\color{vgblue}}{}{0em}{}
\\setlist[enumerate,1]{leftmargin=*,itemsep=0.8em,topsep=0.4em}
\\setlist[enumerate,2]{leftmargin=1.5em,itemsep=0.3em,label=(\\alph*)}

\\hypersetup{colorlinks=true,linkcolor=vgblue,urlcolor=vgblue}
`;

const buildHeader = (session, docLabel) => {
  const title = escapeLatex(session.examTitle || 'Examination Paper');
  const subject = escapeLatex(session.subject || 'General');
  const marks = session.totalMarks ?? 0;
  const duration = session.durationMinutes ?? 90;
  const count = session.questionCount ?? session.questions?.length ?? 0;
  const date = new Date(session.finalizedAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return `
\\begin{center}
  {\\LARGE\\bfseries ${title}}\\\\[0.6em]
  {\\large ${subject}}\\\\[0.4em]
  {\\normalsize\\textcolor{vggrey}{${escapeLatex(docLabel)}}}\\\\[1em]
  \\begin{tabular}{@{}ll@{}}
    \\textbf{Total Marks:} & ${marks} \\\\
    \\textbf{Duration:} & ${duration} minutes \\\\
    \\textbf{Questions:} & ${count} \\\\
    \\textbf{Date:} & ${escapeLatex(date)} \\\\
  \\end{tabular}
\\end{center}
\\vspace{1em}
\\hrule
\\vspace{1em}
`;
};

const buildInstructions = () => `
\\section*{General Instructions}
\\begin{itemize}[leftmargin=1.2em,itemsep=0.3em]
  \\item Read all questions carefully before answering.
  \\item Write your answers clearly in the space provided.
  \\item Marks for each question are indicated in brackets.
  \\item All questions are compulsory unless stated otherwise.
\\end{itemize}
\\vspace{0.5em}
`;

const formatMcqOptions = (options) => {
  if (!options?.length) return '';
  const items = options.map((opt) => `  \\item ${latexParagraph(opt)}`).join('\n');
  return `\\begin{enumerate}\n${items}\n\\end{enumerate}\n`;
};

const buildQuestionItems = (questions, { includeAnswers = false } = {}) => {
  const items = questions.map((q) => {
    const typeLabel = TYPE_LABEL[q.type] || q.type || 'Question';
    const marks = q.marks ?? 0;
    const topic = q.topicName ? `\\textit{[${escapeLatex(q.topicName)}]}` : '';
    const diff = q.difficulty ? `\\textcolor{vggrey}{\\small (${escapeLatex(q.difficulty)})}` : '';

    let body = `\\item ${topic} ${diff} \\textbf{[${typeLabel}, ${marks} mark${marks === 1 ? '' : 's'}]}\\\\[0.4em]\n`;
    body += `${latexParagraph(q.questionText)}\n`;

    if (q.type === 'MCQ' && q.options?.length) {
      body += formatMcqOptions(q.options);
    }

    if (includeAnswers) {
      body += `\\vspace{0.4em}\n`;
      body += `{\\color{vgblue}\\textbf{Correct Answer:}} ${latexParagraph(q.correctAnswer || '---')}\\\\\n`;
      if (q.modelAnswer) {
        body += `{\\color{vgblue}\\textbf{Model Answer:}}\\\\\n${latexParagraph(q.modelAnswer)}\\\\\n`;
      }
      if (q.markingScheme) {
        body += `{\\color{vgblue}\\textbf{Marking Scheme:}}\\\\\n${latexParagraph(q.markingScheme)}\\\\\n`;
      }
      if (q.explanation) {
        body += `{\\color{vggrey}\\textbf{Note:}} ${latexParagraph(q.explanation)}\\\\\n`;
      }
    }

    return body;
  });

  return `\\begin{enumerate}\n${items.join('\n')}\\end{enumerate}\n`;
};

const buildQuestionPaperLatex = (session) => {
  const questions = session.questions || [];
  return `${PREAMBLE}
\\begin{document}
${buildHeader(session, 'Question Paper')}
${buildInstructions()}
\\section*{Questions}
${buildQuestionItems(questions, { includeAnswers: false })}
\\end{document}
`;
};

const buildAnswerKeyLatex = (session) => {
  const questions = session.questions || [];
  const provider = session.answerProvider ? escapeLatex(session.answerProvider) : 'LLM';

  return `${PREAMBLE}
\\begin{document}
${buildHeader(session, 'Model Answer Key --- For Faculty Use Only')}
\\section*{Answer Key Overview}
This document contains official model answers and marking schemes generated for faculty evaluation.
Answers were produced using \\textbf{${provider}}.

\\section*{Detailed Answers}
${buildQuestionItems(questions, { includeAnswers: true })}
\\end{document}
`;
};

module.exports = { buildQuestionPaperLatex, buildAnswerKeyLatex };
