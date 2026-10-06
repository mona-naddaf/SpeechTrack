"use client";

import { useState, type FormEvent } from "react";
import type { ResponseFormatOption, TrackTemplateStepWithRelations } from "@/lib/types";

export type StepFormValues = {
  goalText: string;
  responseFormatId: string | null;
  targetPercent: number | null;
};

type Props = {
  mode: "add" | "edit";
  responseFormats: ResponseFormatOption[];
  /** Account-wide default format — pre-selected for new steps only. */
  defaultFormatId: string | null;
  initialStep?: TrackTemplateStepWithRelations | null;
  onCancel: () => void;
  onSubmit: (values: StepFormValues) => Promise<string | null>;
};

export default function StepFormModal({
  mode,
  responseFormats,
  defaultFormatId,
  initialStep,
  onCancel,
  onSubmit,
}: Props) {
  const [goalText, setGoalText] = useState(initialStep?.goal_text ?? "");
  const [responseFormatId, setResponseFormatId] = useState(
    mode === "edit" ? initialStep?.response_format_id ?? "" : defaultFormatId ?? ""
  );
  const [targetPercent, setTargetPercent] = useState(
    initialStep?.target_percent !== undefined && initialStep?.target_percent !== null
      ? String(initialStep.target_percent)
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!goalText.trim()) {
      setError("Please enter the goal text.");
      return;
    }

    let targetValue: number | null = null;
    if (targetPercent.trim() !== "") {
      const parsed = Number(targetPercent);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        setError("Target % must be a number between 0 and 100.");
        return;
      }
      targetValue = parsed;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({
      goalText: goalText.trim(),
      responseFormatId: responseFormatId || null,
      targetPercent: targetValue,
    });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">
            {mode === "add" ? "Add step" : "Edit step"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="step-goal-text"
                className="block text-sm font-medium text-stone-700"
              >
                Goal text
              </label>
              <textarea
                id="step-goal-text"
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                rows={3}
                autoFocus
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="e.g. Will produce /l/ in isolation with 80% accuracy"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="step-format"
                  className="block text-sm font-medium text-stone-700"
                >
                  Response format <span className="text-stone-400">(optional)</span>
                </label>
                <select
                  id="step-format"
                  value={responseFormatId}
                  onChange={(e) => setResponseFormatId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">None</option>
                  {responseFormats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="step-target"
                  className="block text-sm font-medium text-stone-700"
                >
                  Target % <span className="text-stone-400">(optional)</span>
                </label>
                <input
                  id="step-target"
                  type="number"
                  min={0}
                  max={100}
                  value={targetPercent}
                  onChange={(e) => setTargetPercent(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
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
                    ? "Add step"
                    : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
