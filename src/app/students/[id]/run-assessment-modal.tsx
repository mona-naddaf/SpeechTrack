"use client";

import { useState } from "react";
import Link from "next/link";
import type { Assessment } from "@/lib/types";

type Props = {
  assessments: Assessment[];
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-slate-900">Run assessment</h2>

        {assessments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            You don&apos;t have any saved assessments yet.{" "}
            <Link
              href="/toolkit/assessments"
              className="font-medium text-slate-900 underline underline-offset-2"
            >
              Create one in the toolkit
            </Link>{" "}
            first.
          </p>
        ) : (
          <div className="mt-4">
            <label
              htmlFor="run-assessment-select"
              className="block text-sm font-medium text-slate-700"
            >
              Assessment
            </label>
            <select
              id="run-assessment-select"
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          {assessments.length > 0 && (
            <button
              type="button"
              onClick={handleStart}
              disabled={loading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Starting…" : "Start"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
