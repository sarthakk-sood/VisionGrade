import QuestionCard from './QuestionCard';

export default function QuestionList({ questions = [], ...handlers }) {
  return (
    <div className="space-y-4">
      {questions.map((question) => (
        <QuestionCard key={question.id} question={question} {...handlers} />
      ))}
    </div>
  );
}
