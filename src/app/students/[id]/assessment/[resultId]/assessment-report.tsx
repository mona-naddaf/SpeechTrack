import {
  buildAssessmentReportText,
  computeAssessmentScore,
  formatAssessmentAnswer,
} from "@/lib/assessment";
import { formatDate } from "@/lib/date";
import type {
  AssessmentAnswerValue,
  AssessmentQuestion,
  AssessmentQuestionResponseType,
} from "@/lib/types";
import CopyReportButton from "./copy-report-button";

type Props = {
  studentName: string;
  assessmentName: string;
  assessmentDescription: string | null;
  date: string;
  questions: AssessmentQuestion[];
  answersByQuestionId: Map<
    string,
    { response_type: AssessmentQuestionResponseType; value: AssessmentAnswerValue }
  >;
};

export default function AssessmentReport({
  studentName,
  assessmentName,
  assessmentDescription,
  date,
  questions,
  answersByQuestionId,
}: Props) {
  const score = computeAssessmentScore(
    Array.from(answersByQuestionId.values()).map((a) => ({
      response_type: a.response_type,
      value: a.value,
    }))
  );

  const reportText = buildAssessmentReportText({
    studentName,
    assessmentName,
    date,
    questions,
    answersByQuestionId,
    score,
  });

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
              Completed
            </span>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {assessmentName}
            </h1>
            {assessmentDescription && (
              <p className="mt-1 text-slate-600">{assessmentDescription}</p>
            )}
            <p className="mt-1 text-sm text-slate-500">
              {studentName} · {formatDate(date)}
            </p>
          </div>
          <CopyReportButton text={reportText} />
        </div>

        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-700">
          {score.total > 0
            ? `Score: ${score.correct}/${score.total} correct${
                score.approx > 0
                  ? ` (${score.approx} approximation${score.approx === 1 ? "" : "s"})`
                  : ""
              }`
            : "No scored questions in this assessment."}
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {questions.map((question, i) => {
          const answer = answersByQuestionId.get(question.id);
          return (
            <li
              key={question.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <span className="text-xs font-semibold text-slate-400">
                #{i + 1}
              </span>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {question.prompt}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {formatAssessmentAnswer(question.response_type, answer?.value)}
              </p>
              {question.expected_answer && (
                <p className="mt-1 text-xs text-slate-500">
                  Expected: {question.expected_answer}
                </p>
              )}
              {question.notes && (
                <p className="mt-1 text-xs text-slate-400">{question.notes}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
