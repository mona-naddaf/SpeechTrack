"use client";

import { useState, type FormEvent } from "react";
import type { AssessmentQuestion, AssessmentQuestionResponseType } from "@/lib/types";
import { ASSESSMENT_RESPONSE_TYPE_LABELS } from "@/lib/assessment";

export type QuestionFormValues = {
  prompt: string;
  responseType: AssessmentQuestionResponseType;
  expectedAnswer: string;
  notes: string;
};

type Props = {
  mode: "add" | "edit";
  initialQuestion?: AssessmentQuestion | null;
  onCancel: () => void;
  onSubmit: (values: QuestionFormValues) => Promise<string | null>;
};

const RESPONSE_TYPES: AssessmentQuestionResponseType[] = [
  "right_wrong",
  "transcription",
  "free_text",
];

export default function QuestionFormModal({
  mode,
  initialQuestion,
  onCancel,
  onSubmit,
}: Props) {
  const [prompt, setPrompt] = useState(initialQuestion?.prompt ?? "");
  const [responseType, setResponseType] = useState<AssessmentQuestionResponseType>(
    initialQuestion?.response_type ?? "right_wrong"
  );
  const [expectedAnswer, setExpectedAnswer] = useState(
    initialQuestion?.expected_answer ?? ""
  );
  const [notes, setNotes] = useState(initialQuestion?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) {
      setError("Please enter the question prompt.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({
      prompt: prompt.trim(),
      responseType,
      expectedAnswer: expectedAnswer.trim(),
      notes: notes.trim(),
    });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">
          {mode === "add" ? "Add question" : "Edit question"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="question-prompt"
              className="block text-sm font-medium text-stone-700"
            >
              Prompt
            </label>
            <textarea
              id="question-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              autoFocus
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g. Point to the picture of a dog."
            />
          </div>

          <div>
            <label
              htmlFor="question-response-type"
              className="block text-sm font-medium text-stone-700"
            >
              Response type
            </label>
            <select
              id="question-response-type"
              value={responseType}
              onChange={(e) =>
                setResponseType(e.target.value as AssessmentQuestionResponseType)
              }
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {RESPONSE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ASSESSMENT_RESPONSE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="question-expected"
              className="block text-sm font-medium text-stone-700"
            >
              Expected answer{" "}
              <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="question-expected"
              type="text"
              value={expectedAnswer}
              onChange={(e) => setExpectedAnswer(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="question-notes"
              className="block text-sm font-medium text-stone-700"
            >
              Notes <span className="text-stone-400">(optional)</span>
            </label>
            <textarea
              id="question-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Administration notes, materials needed, etc."
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading
                ? "Saving…"
                : mode === "add"
                  ? "Add question"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
