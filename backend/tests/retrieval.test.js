const {
  buildCorpus,
  retrieve,
  verifyQuote,
} = require('../services/retrievalService');
const { buildQuestionPlan, batchPlan } = require('../utils/questionPlan');

// Stands in for extracted PDF text: three pages of distinct subject matter,
// carrying details specific to this document rather than to the topic in general.
const documents = [
  {
    filename: 'dbms-unit3.pdf',
    pages: [
      {
        num: 1,
        text:
          'Normalization is the process of organizing relations to reduce redundancy. ' +
          'Consider the relation SUPPLIER(sid, sname, city, city_status) used throughout this unit. ' +
          'Here city_status is functionally determined by city, which is itself a non-key attribute, ' +
          'so SUPPLIER exhibits a transitive dependency and violates third normal form. ' +
          'Decomposing SUPPLIER into SUPPLIER1(sid, sname, city) and CITY_INFO(city, city_status) removes the anomaly. ' +
          'The worked example in Table 3.4 shows the update anomaly costing 14 redundant writes.',
      },
      {
        num: 2,
        text:
          'Indexing improves retrieval speed. A B+ tree of order 200 over the SUPPLIER table reduces ' +
          'the height to three levels for one million tuples. Unlike a B tree, a B+ tree stores all keys ' +
          'in leaf nodes and links leaves in a sequence set, which makes range scans cheap. ' +
          'The unit measures a 12x speedup on the range query used in Assignment 2.',
      },
      {
        num: 3,
        text:
          'Concurrency control uses two-phase locking. Under strict 2PL every exclusive lock is held ' +
          'until commit, which guarantees recoverable schedules. The deadlock example in Figure 3.9 ' +
          'shows transactions T4 and T7 waiting on the CITY_INFO relation, resolved by wound-wait ' +
          'with T4 as the older transaction.',
      },
    ],
  },
];

const topics = [
  {
    topicName: 'Third Normal Form',
    description: 'Transitive dependency and decomposition',
    keywords: ['normalization', 'transitive', '3NF'],
    marks: 10,
    difficulty: 'Mixed',
  },
  {
    topicName: 'B+ Tree Indexing',
    description: 'Index structures for fast retrieval',
    keywords: ['index', 'B+ tree', 'range scan'],
    marks: 10,
    difficulty: 'Medium',
  },
  {
    topicName: 'Two Phase Locking',
    description: 'Concurrency control and deadlock',
    keywords: ['deadlock', 'locking', '2PL'],
    marks: 5,
    difficulty: 'Hard',
  },
];

const topicQuery = (topic) => [
  { text: topic.topicName, weight: 3 },
  { text: topic.keywords.join(' '), weight: 2 },
  { text: topic.description, weight: 1 },
];

const REAL_QUOTE =
  'city_status is functionally determined by city, which is itself a non-key attribute';

describe('retrieval', () => {
  const corpus = buildCorpus(documents);

  it('indexes every document page', () => {
    expect(corpus.size).toBeGreaterThanOrEqual(3);
  });

  it('returns excerpts for every topic', () => {
    topics.forEach((topic) => {
      const evidence = retrieve(corpus, topicQuery(topic), { maxChars: 3000, maxChunks: 3 });
      expect(evidence.length).toBeGreaterThan(0);
    });
  });

  it('ranks the page that actually discusses the topic first', () => {
    const index = retrieve(corpus, [{ text: 'B+ tree index range scan', weight: 3 }], { maxChunks: 1 });
    expect(index[0].page).toBe(2);

    const locking = retrieve(corpus, [{ text: 'deadlock wound-wait two phase locking', weight: 3 }], { maxChunks: 1 });
    expect(locking[0].page).toBe(3);
  });

  it('works for documents stored without page text', () => {
    const flat = buildCorpus([
      { filename: 'legacy.pdf', extractedText: documents[0].pages.map((p) => p.text).join(' ') },
    ]);
    expect(flat.size).toBeGreaterThanOrEqual(2);

    const check = verifyQuote(flat, REAL_QUOTE);
    expect(check.grounded).toBe(true);
    expect(check.chunk.page).toBeNull();
  });
});

describe('grounding verification', () => {
  const corpus = buildCorpus(documents);

  it('accepts a verbatim quote and attributes it to its page', () => {
    const check = verifyQuote(corpus, REAL_QUOTE);
    expect(check.grounded).toBe(true);
    expect(check.chunk.page).toBe(1);
  });

  it('tolerates reformatted punctuation and casing', () => {
    const check = verifyQuote(
      corpus,
      'City_Status is functionally determined by City -- which is itself a non key attribute!'
    );
    expect(check.grounded).toBe(true);
  });

  it('rejects a plausible sentence that is absent from the documents', () => {
    const check = verifyQuote(
      corpus,
      'Normalization was introduced by Codd in 1970 and has five commonly cited normal forms in total'
    );
    expect(check.grounded).toBe(false);
  });

  it('rejects generic textbook phrasing', () => {
    const check = verifyQuote(
      corpus,
      'A B+ tree is a self balancing tree data structure that maintains sorted data for efficient insertion'
    );
    expect(check.grounded).toBe(false);
  });
});

describe('question planning', () => {
  const examInfo = {
    examTitle: 'Mid Semester — DBMS',
    subject: 'Database Management Systems',
    totalMarks: 25,
    questionTypes: {
      MCQ: { count: 5, marks: 1 },
      ShortAnswer: { count: 3, marks: 2 },
      LongAnswer: { count: 2, marks: 7 },
    },
  };

  const plan = buildQuestionPlan(examInfo, topics);
  const topicMarks = (assignment) =>
    assignment.questions.reduce((sum, q) => sum + q.marks, 0);

  it('plans every requested question', () => {
    expect(plan.totalQuestions).toBe(10);
  });

  it('matches the blueprint total marks', () => {
    const planned = plan.assignments.reduce((sum, a) => sum + topicMarks(a), 0);
    expect(planned).toBe(25);
  });

  it('never exceeds a topic\u2019s allocated marks', () => {
    plan.assignments.forEach((a) => {
      expect(topicMarks(a)).toBeLessThanOrEqual(a.topic.marks);
    });
  });

  it('varies difficulty for Mixed topics and fixes it otherwise', () => {
    const mixed = plan.assignments.find((a) => a.topic.difficulty === 'Mixed');
    expect(new Set(mixed.questions.map((q) => q.difficulty)).size).toBeGreaterThan(1);

    const hard = plan.assignments.find((a) => a.topic.difficulty === 'Hard');
    expect(hard.questions.every((q) => q.difficulty === 'Hard')).toBe(true);
  });

  it('batches without losing questions, keeping each call small', () => {
    const batches = batchPlan(plan.assignments);
    const total = batches.reduce(
      (sum, b) => sum + b.reduce((s, e) => s + e.questions.length, 0), 0
    );
    expect(total).toBe(plan.totalQuestions);

    batches.forEach((batch) => {
      expect(batch.reduce((s, e) => s + e.questions.length, 0)).toBeLessThanOrEqual(5);
      expect(batch.length).toBeLessThanOrEqual(2);
    });
  });
});

// The regression this retrieval layer exists to fix. Generation previously sent
// the model a head+tail slice capped at 10k chars, so anything in the middle of
// a real set of notes was invisible and had to be invented from general
// knowledge — which is what made questions generic rather than document-specific.
describe('content in the middle of a long document', () => {
  const filler = (label, n) =>
    Array.from({ length: n }, (_, i) =>
      `${label} paragraph ${i + 1} discusses routine bookkeeping details of the course administration and assessment calendar.`
    ).join(' ');

  const buriedFact =
    'The campus deployment of the scheduler uses a quantum of 17 milliseconds ' +
    'and demotes any process exceeding four consecutive quanta to the tertiary queue.';

  const longDoc = {
    filename: 'os-full-notes.pdf',
    extractedText: `${filler('Front', 300)} ${buriedFact} ${filler('Back', 300)}`,
  };

  it('falls outside the old head+tail window', () => {
    const OLD_BUDGET = 10_000;
    const head = longDoc.extractedText.slice(0, Math.floor(OLD_BUDGET * 0.65));
    const tail = longDoc.extractedText.slice(-Math.floor(OLD_BUDGET * 0.35));
    expect(`${head}${tail}`).not.toContain('17 milliseconds');
  });

  it('is retrievable and verifies as grounded', () => {
    const corpus = buildCorpus([longDoc]);
    const found = retrieve(
      corpus,
      [
        { text: 'Multilevel Queue Scheduling', weight: 3 },
        { text: 'quantum demote tertiary queue scheduler', weight: 2 },
      ],
      { maxChars: 3000, maxChunks: 3 }
    );

    expect(found.some((e) => e.text.includes('17 milliseconds'))).toBe(true);
    expect(verifyQuote(corpus, buriedFact).grounded).toBe(true);
  });
});

describe('parseJsonFromLlm', () => {
  const { parseJsonFromLlm, isLlmParseError } = require('../utils/llmUtils');

  it('parses bare JSON', () => {
    const parsed = parseJsonFromLlm('{"questions":[{"planIndex":1}]}');
    expect(parsed.questions).toHaveLength(1);
  });

  it('parses JSON wrapped in markdown fences', () => {
    const parsed = parseJsonFromLlm('```json\n{"questions":[]}\n```');
    expect(parsed.questions).toEqual([]);
  });

  it('extracts JSON from leading prose', () => {
    const parsed = parseJsonFromLlm('Here is the result:\n{"questions":[{"planIndex":2}]}');
    expect(parsed.questions[0].planIndex).toBe(2);
  });

  it('throws a parse error that isGroqFallbackError recognizes', () => {
    let err;
    try {
      parseJsonFromLlm('not json at all');
    } catch (e) {
      err = e;
    }
    expect(isLlmParseError(err)).toBe(true);
  });
});
