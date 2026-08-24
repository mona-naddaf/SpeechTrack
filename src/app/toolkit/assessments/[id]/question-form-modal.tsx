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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-slate-900">
          {mode === "add" ? "Add question" : "Edit question"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="question-prompt"
              className="block text-sm font-medium text-slate-700"
            >
              Prompt
            </label>
            <textarea
              id="question-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              autoFocus
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="e.g. Point to the picture of a dog."
            />
          </div>

          <div>
            <label
              htmlFor="question-response-type"
              className="block text-sm font-medium text-slate-700"
            >
              Response type
            </label>
            <select
              id="question-response-type"
              value={responseType}
              onChange={(e) =>
                setResponseType(e.target.value as AssessmentQuestionResponseType)
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
              className="block text-sm font-medium text-slate-700"
            >
              Expected answer{" "}
              <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="question-expected"
              type="text"
              value={expectedAnswer}
              onChange={(e) => setExpectedAnswer(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="question-notes"
              className="block text-sm font-medium text-slate-700"
            >
              Notes <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="question-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="Administration notes, materials needed, etc."
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
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
