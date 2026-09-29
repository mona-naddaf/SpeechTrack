"use client";

import { useState } from "react";
import Link from "next/link";
import type { AssessmentWithAreas } from "@/lib/types";
import AssessmentMetaBadges from "@/components/assessment-meta-badges";

type Props = {
  assessments: AssessmentWithAreas[];
  onCancel: () => void;
  onSubmit: (assessmentId: string) => Promise<string | null>;
};

export default function RunAssessmentModal({
  assessments,
  onCancel,
  onSubmit,
}: Props) {
  const [assessmentId, setAssessmentId] = useState(assessments[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!assessmentId) {
      setError("Please choose an assessment.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await onSubmit(assessmentId);
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">Run assessment</h2>

          {assessments.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">
              You don&apos;t have any saved assessments yet.{" "}
              <Link
                href="/toolkit/assessments"
                className="font-medium text-stone-900 underline underline-offset-2"
              >
                Create one in the toolkit
              </Link>{" "}
              first.
            </p>
          ) : (
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {assessments.map((a) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  assessmentId === a.id
                    ? "border-stone-900 bg-cream-50"
                    : "border-stone-200 hover:bg-cream-50"
                }`}
                >
                  <span className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="run-assessment"
                      className="mt-0.5"
                      checked={assessmentId === a.id}
                      onChange={() => setAssessmentId(a.id)}
                    />
                    <span className="font-medium text-stone-900">{a.name}</span>
                  </span>
                  <AssessmentMetaBadges
                    kind={a.kind}
                    formality={a.formality}
                    areas={a.areas}
                  />
                </label>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              Cancel
            </button>
            {assessments.length > 0 && (
              <button
                type="button"
                onClick={handleStart}
                disabled={loading}
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? "Starting…" : "Start"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
