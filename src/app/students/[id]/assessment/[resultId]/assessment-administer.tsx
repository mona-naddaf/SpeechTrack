"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  AssessmentAnswerValue,
  AssessmentQuestion,
  AssessmentQuestionResponseType,
} from "@/lib/types";
import { isAssessmentAnswered } from "@/lib/assessment";

type Props = {
  resultId: string;
  assessmentName: string;
  assessmentDescription: string | null;
  questions: AssessmentQuestion[];
  initialAnswersByQuestionId: Map<
    string,
    { response_type: AssessmentQuestionResponseType; value: AssessmentAnswerValue }
  >;
};

const TAGS: NonNullable<AssessmentAnswerValue["tag"]>[] = [
  "correct",
  "approx",
  "incorrect",
];
const TAG_LABELS: Record<NonNullable<AssessmentAnswerValue["tag"]>, string> = {
  correct: "Correct",
  approx: "Approx",
  incorrect: "Incorrect",
};

export default function AssessmentAdminister({
  resultId,
  assessmentName,
  assessmentDescription,
  questions,
  initialAnswersByQuestionId,
}: Props) {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, AssessmentAnswerValue>>(() => {
    const initial: Record<string, AssessmentAnswerValue> = {};
    for (const [questionId, a] of initialAnswersByQuestionId.entries()) {
      initial[questionId] = a.value;
    }
    return initial;
  });
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [questionId, a] of initialAnswersByQuestionId.entries()) {
      initial[questionId] = a.value.text ?? "";
    }
    return initial;
  });
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const answeredCount = useMemo(
    () =>
      questions.filter((q) => isAssessmentAnswered(q.response_type, answers[q.id]))
        .length,
    [questions, answers]
  );

  function setSaving(id: string, saving: boolean) {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function persist(
    question: AssessmentQuestion,
    value: AssessmentAnswerValue
  ) {
    setError(null);
    setSaving(question.id, true);
    const supabase = createClient();

    if (isAssessmentAnswered(question.response_type, value)) {
      const { error } = await supabase.from("assessment_answers").upsert(
        {
          result_id: resultId,
          question_id: question.id,
          response_type: question.response_type,
          value,
        },
        { onConflict: "result_id,question_id" }
      );
      setSaving(question.id, false);
      if (error) {
        setError(error.message);
        return;
      }
      setAnswers((prev) => ({ ...prev, [question.id]: value }));
    } else {
      // Cleared back to empty — remove the row rather than save a blank one,
      // so it stops counting as answered.
      const { error } = await supabase
        .from("assessment_answers")
        .delete()
        .eq("result_id", resultId)
        .eq("question_id", question.id);
      setSaving(question.id, false);
      if (error) {
        setError(error.message);
        return;
      }
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
    }
  }

  function handleRightWrong(question: AssessmentQuestion, correct: boolean) {
    persist(question, { correct });
  }

  function handleTag(
    question: AssessmentQuestion,
    tag: NonNullable<AssessmentAnswerValue["tag"]>
  ) {
    const current = answers[question.id] ?? {};
    const nextTag = current.tag === tag ? undefined : tag;
    persist(question, { ...current, tag: nextTag });
  }

  function handleTextChange(questionId: string, text: string) {
    setDrafts((prev) => ({ ...prev, [questionId]: text }));
  }

  function handleTextBlur(question: AssessmentQuestion) {
    const text = drafts[question.id] ?? "";
    const current = answers[question.id] ?? {};
    if ((current.text ?? "") === text) return; // no change, skip the write
    persist(question, { ...current, text });
  }

  async function handleMarkComplete() {
    setCompleting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("assessment_results")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", resultId);
    setCompleting(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.refresh();
  }

  const progressPercent =
    questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className="pb-24">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-bold text-slate-900">{assessmentName}</h1>
        {assessmentDescription && (
          <p className="mt-1 text-slate-600">{assessmentDescription}</p>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              {answeredCount}/{questions.length} answered
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {questions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          This assessment has no questions yet.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {questions.map((question, i) => {
            const value = answers[question.id];
            const answered = isAssessmentAnswered(question.response_type, value);
            const saving = savingIds.has(question.id);

            return (
              <li
                key={question.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-400">
                      #{i + 1}
                    </span>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {question.prompt}
                    </p>
                    {question.expected_answer && (
                      <p className="mt-1 text-xs text-slate-500">
                        Expected: {question.expected_answer}
                      </p>
                    )}
                    {question.notes && (
                      <p className="mt-1 text-xs text-slate-400">
                        {question.notes}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      answered
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {answered ? "Answered" : "Unanswered"}
                  </span>
                </div>

                <div className="mt-3">
                  {question.response_type === "right_wrong" && (
                    <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
                      <button
                        type="button"
                        onClick={() => handleRightWrong(question, true)}
                        disabled={saving}
                        className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                          value?.correct === true
                            ? "bg-green-600 text-white"
                            : "bg-green-100 text-green-800 hover:bg-green-200"
                        }`}
                      >
                        Correct
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRightWrong(question, false)}
                        disabled={saving}
                        className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                          value?.correct === false
                            ? "bg-red-600 text-white"
                            : "bg-red-100 text-red-800 hover:bg-red-200"
                        }`}
                      >
                        Incorrect
                      </button>
                    </div>
                  )}

                  {question.response_type === "transcription" && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={drafts[question.id] ?? ""}
                        onChange={(e) =>
                          handleTextChange(question.id, e.target.value)
                        }
                        onBlur={() => handleTextBlur(question)}
                        placeholder="What the child said…"
                        disabled={saving}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50"
                      />
                      <div className="flex gap-2">
                        {TAGS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleTag(question, tag)}
                            disabled={saving}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                              value?.tag === tag
                                ? tag === "correct"
                                  ? "bg-green-600 text-white"
                                  : tag === "approx"
                                    ? "bg-amber-500 text-white"
                                    : "bg-red-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {TAG_LABELS[tag]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {question.response_type === "free_text" && (
                    <textarea
                      value={drafts[question.id] ?? ""}
                      onChange={(e) =>
                        handleTextChange(question.id, e.target.value)
                      }
                      onBlur={() => handleTextBlur(question)}
                      rows={2}
                      disabled={saving}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <p className="hidden text-sm text-slate-500 sm:block">
            Answers save automatically as you go.
          </p>
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={completing}
            className="w-full rounded-md bg-slate-900 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50 sm:w-auto sm:px-4 sm:py-2 sm:text-sm"
          >
            {completing ? "Marking complete…" : "Mark complete"}
          </button>
        </div>
      </div>
    </div>
  );
}
