/**
 * Deterministic question → topic allocation.
 *
 * The generation prompt used to hand the LLM every global question count and
 * every per-topic mark budget at once and ask it to satisfy both. That is a
 * bin-packing problem, small instruction-tuned models are bad at it, and the
 * effort it spends on arithmetic comes at the cost of engaging with the source
 * text. Solving it here leaves the model one job: write a question about the
 * passage it was given.
 *
 * Fixing the plan up front also lets generation run in small batches, so each
 * topic gets a meaningful share of the prompt's evidence budget.
 */

const TYPE_ORDER = ['MCQ', 'FillInTheBlanks', 'ShortAnswer', 'MediumAnswer', 'LongAnswer'];
const DIFFICULTY_CYCLE = ['Easy', 'Medium', 'Hard'];

/** Keep each LLM call small so its evidence stays focused and it stays accurate. */
const MAX_QUESTIONS_PER_BATCH = 5;
const MAX_TOPICS_PER_BATCH = 2;

const typeRank = (type) => {
  const idx = TYPE_ORDER.indexOf(type);
  return idx === -1 ? TYPE_ORDER.length : idx;
};

/** Expand the blueprint's per-type counts into one entry per question. */
const expandSlots = (questionTypes = {}) => {
  const slots = [];
  Object.entries(questionTypes).forEach(([type, cfg]) => {
    const count = Number(cfg?.count) || 0;
    const marks = Number(cfg?.marks) || 1;
    for (let i = 0; i < count; i++) slots.push({ type, marks });
  });
  // Decreasing marks — best-fit decreasing packs exact budgets far more often.
  return slots.sort((a, b) => b.marks - a.marks || typeRank(a.type) - typeRank(b.type));
};

const resolveDifficulty = (topicDifficulty, slotIndex, marks = 1) => {
  if (DIFFICULTY_CYCLE.includes(topicDifficulty)) return topicDifficulty;
  const m = Number(marks) || 1;
  if (m >= 5) return 'Hard';
  if (m >= 3) return slotIndex % 2 === 0 ? 'Hard' : 'Medium';
  if (m >= 2) return 'Medium';
  return slotIndex % 3 === 2 ? 'Hard' : slotIndex % 2 === 0 ? 'Medium' : 'Easy';
};

/**
 * Assign every question to a topic, respecting each topic's allocated marks
 * where the numbers allow it.
 *
 * @param {object} examInfo  { questionTypes }
 * @param {Array}  topics    [{ topicName, marks, difficulty, description, keywords }]
 * @returns {{ assignments: Array, warnings: string[], totalQuestions: number }}
 */
const buildQuestionPlan = (examInfo, topics = []) => {
  const slots = expandSlots(examInfo?.questionTypes);
  const warnings = [];

  if (!topics.length || !slots.length) {
    return { assignments: [], warnings, totalQuestions: 0 };
  }

  const buckets = topics.map((topic) => ({
    topic,
    remaining: Number(topic.marks) || 0,
    slots: [],
  }));

  const leftovers = [];

  for (const slot of slots) {
    // Best fit: the tightest topic the question still fits into, so topics with
    // large budgets stay available for the high-mark questions.
    let best = null;
    for (const bucket of buckets) {
      if (bucket.remaining >= slot.marks && (!best || bucket.remaining < best.remaining)) {
        best = bucket;
      }
    }
    if (best) {
      best.remaining -= slot.marks;
      best.slots.push(slot);
    } else {
      leftovers.push(slot);
    }
  }

  // Never drop a question the teacher asked for: place any remainder on the
  // topic with the most headroom and flag the overflow.
  if (leftovers.length) {
    warnings.push(
      `${leftovers.length} question(s) could not be packed into the per-topic mark budgets exactly; ` +
      'they were assigned to the topics with the most remaining capacity.'
    );
    for (const slot of leftovers) {
      const target = buckets.reduce((a, b) => (b.remaining > a.remaining ? b : a), buckets[0]);
      target.remaining -= slot.marks;
      target.slots.push(slot);
    }
  }

  const assignments = buckets
    .filter((bucket) => bucket.slots.length)
    .map((bucket) => ({
      topic: bucket.topic,
      questions: bucket.slots
        .sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.marks - b.marks)
        .map((slot, i) => ({
          type: slot.type,
          marks: slot.marks,
          difficulty: resolveDifficulty(bucket.topic.difficulty, i, slot.marks),
        })),
    }));

  const emptyTopics = buckets.filter((b) => !b.slots.length).map((b) => b.topic.topicName);
  if (emptyTopics.length) {
    warnings.push(`No questions fit these topics' allocated marks: ${emptyTopics.join(', ')}.`);
  }

  return {
    assignments,
    warnings,
    totalQuestions: assignments.reduce((sum, a) => sum + a.questions.length, 0),
  };
};

/**
 * Group the plan into LLM calls. Each batch stays small in both questions and
 * topics so every topic's excerpts get real room in the prompt.
 *
 * @returns {Array<Array<{topic: object, questions: Array}>>}
 */
const batchPlan = (assignments) => {
  const batches = [];
  let current = [];
  let currentCount = 0;

  const flush = () => {
    if (current.length) batches.push(current);
    current = [];
    currentCount = 0;
  };

  for (const assignment of assignments) {
    let pending = assignment.questions;

    while (pending.length) {
      const room = MAX_QUESTIONS_PER_BATCH - currentCount;

      if (room <= 0 || current.length >= MAX_TOPICS_PER_BATCH) {
        flush();
        continue;
      }

      const take = pending.slice(0, room);
      current.push({ topic: assignment.topic, questions: take });
      currentCount += take.length;
      pending = pending.slice(room);

      if (currentCount >= MAX_QUESTIONS_PER_BATCH) flush();
    }
  }

  flush();
  return batches;
};

module.exports = {
  buildQuestionPlan,
  batchPlan,
  TYPE_ORDER,
  typeRank,
  MAX_QUESTIONS_PER_BATCH,
};
