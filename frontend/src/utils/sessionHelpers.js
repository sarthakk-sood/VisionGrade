const STATUS_LABELS = {
  finalized: 'Generated',
  exported:  'Exported',
};

export const displaySessionStatus = (status) =>
  STATUS_LABELS[status] || status || 'Generated';

export const relativeTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export const buildDashboardStats = (sessions = []) => {
  const totalQuestions = sessions.reduce((s, x) => s + (x.questionCount || 0), 0);
  const withAnswers = sessions.filter((s) => s.hasModelAnswers).length;
  const totalEvaluated = sessions.reduce((s, x) => s + (x.studentsEvaluated || 0), 0);
  const totalPending = sessions.reduce((s, x) => s + (x.pendingSheets || 0), 0);
  return [
    { label: 'Exam Sessions', value: String(sessions.length), delta: sessions.length ? 'Your finalized papers' : 'Create your first exam' },
    { label: 'Questions Finalized', value: String(totalQuestions), delta: sessions.length ? 'Across all sessions' : '—' },
    { label: 'Answer Keys Ready', value: String(withAnswers), delta: withAnswers ? 'Export as LaTeX PDF' : 'Finalize a session first' },
    {
      label: 'Sheets Evaluated',
      value: String(totalEvaluated),
      delta: totalPending ? `${totalPending} pending review` : totalEvaluated ? 'All caught up' : 'Upload sheets in Module 2',
    },
  ];
};

export const buildActivityTimeline = (sessions = []) => {
  const finalizedEvents = sessions.map((s, i) => ({
    id: `finalized-${s.id || i}`,
    time: relativeTime(s.dateCreated),
    timestamp: s.dateCreated,
    title: 'Question paper finalized',
    detail: `${s.examName}${s.subject ? ` · ${s.subject}` : ''} — ${s.questionCount} questions, ${s.totalMarks} marks.`,
    type: 'session',
  }));

  const evaluationEvents = sessions
    .filter((s) => s.studentsEvaluated > 0)
    .map((s, i) => ({
      id: `evaluated-${s.id || i}`,
      time: relativeTime(s.evaluationDate),
      timestamp: s.evaluationDate,
      title: 'Answer sheets evaluated',
      detail: `${s.examName}${s.subject ? ` · ${s.subject}` : ''} — ${s.studentsEvaluated} sheet${s.studentsEvaluated === 1 ? '' : 's'} scored, ${s.avgScore}% average.`,
      type: 'evaluation',
    }));

  return [...finalizedEvents, ...evaluationEvents]
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 8);
};

export const deriveTopicsFromQuestions = (questions = []) => {
  const map = new Map();
  questions.forEach((q) => {
    const name = q.topicName || q.topic || 'General';
    const prev = map.get(name) || { name, marks: 0, count: 0 };
    prev.marks += q.marks || 0;
    prev.count += 1;
    map.set(name, prev);
  });
  const total = [...map.values()].reduce((s, t) => s + t.marks, 0);
  return [...map.values()].map((t, i) => ({
    id: i + 1,
    name: t.name,
    marks: t.marks,
    questionCount: t.count,
    weightage: total ? Math.round((t.marks / total) * 100) : 0,
  }));
};

export const countQuestionsByType = (questions = []) => {
  const counts = { MCQ: 0, ShortAnswer: 0, MediumAnswer: 0, LongAnswer: 0, FillInTheBlanks: 0 };
  questions.forEach((q) => {
    const t = q.type || 'ShortAnswer';
    if (counts[t] !== undefined) counts[t] += 1;
    else counts.ShortAnswer += 1;
  });
  const total = questions.length || 1;
  const rows = [
    { label: 'MCQ', key: 'MCQ', color: 'purple' },
    { label: 'Short Answer', key: 'ShortAnswer', color: 'blue' },
    { label: 'Medium Answer', key: 'MediumAnswer', color: 'cyan' },
    { label: 'Long Answer', key: 'LongAnswer', color: 'amber' },
    { label: 'Fill in the Blanks', key: 'FillInTheBlanks', color: 'emerald' },
  ];
  return rows
    .map((r) => ({
      ...r,
      count: counts[r.key],
      pct: Math.round((counts[r.key] / total) * 100),
    }))
    .filter((r) => r.count > 0);
};

export const buildSessionActivity = (session) => {
  if (!session) return [];
  const items = [];
  if (session.dateCreated) {
    items.push({
      id: 'finalized',
      time: relativeTime(session.dateCreated),
      title: 'Session finalized',
      detail: `${session.questionCount} questions saved with model answers.`,
      type: 'session',
    });
  }
  if (session.hasModelAnswers) {
    items.push({
      id: 'answers',
      time: relativeTime(session.dateCreated),
      title: 'Model answers generated',
      detail: session.answerProvider
        ? `Generated via ${session.answerProvider}.`
        : 'Answer key ready for faculty review.',
      type: 'export',
    });
  }
  return items;
};

/** Only include label/value pairs that have real content */
export const sessionDetailRows = (session) => {
  const rows = [
    { label: 'Subject', value: session?.subject },
    { label: 'Total Marks', value: session?.totalMarks != null ? String(session.totalMarks) : null },
    { label: 'Questions', value: session?.questionCount != null ? String(session.questionCount) : null },
    { label: 'Date Finalized', value: session?.dateCreated ? new Date(session.dateCreated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null },
    { label: 'Answer Provider', value: session?.answerProvider },
    { label: 'Status', value: displaySessionStatus(session?.status) },
  ];
  return rows.filter((r) => r.value);
};
