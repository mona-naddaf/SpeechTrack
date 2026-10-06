"use client";

import { useState, type FormEvent } from "react";
import { getTodayLocalDateString } from "@/lib/date";
import { ATTENDANCE_REASONS, ATTENDANCE_REASON_LABELS } from "@/lib/attendance";
import type { AttendanceReason } from "@/lib/types";

export type MarkAbsentValues = {
  date: string;
  reason: AttendanceReason;
  reasonNote: string;
  countsTowardPackage: boolean;
};

type Props = {
  /** Present when editing an existing absence; omitted for "Mark absent". */
  initialValues?: MarkAbsentValues;
  onCancel: () => void;
  onSubmit: (values: MarkAbsentValues) => Promise<string | null>;
};

export default function MarkAbsentModal({ initialValues, onCancel, onSubmit }: Props) {
  const isEdit = Boolean(initialValues);
  const [date, setDate] = useState(initialValues?.date ?? getTodayLocalDateString());
  const [reason, setReason] = useState<AttendanceReason>(initialValues?.reason ?? "sick");
  const [reasonNote, setReasonNote] = useState(initialValues?.reasonNote ?? "");
  const [countsTowardPackage, setCountsTowardPackage] = useState(
    initialValues?.countsTowardPackage ?? false
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await onSubmit({
      date,
      reason,
      reasonNote: reasonNote.trim(),
      countsTowardPackage,
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
            {isEdit ? "Edit absence" : "Mark absent"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="absence-date"
                className="block text-sm font-medium text-stone-700"
              >
                Date
              </label>
              <input
                id="absence-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="absence-reason"
                className="block text-sm font-medium text-stone-700"
              >
                Reason
              </label>
              <select
                id="absence-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as AttendanceReason)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {ATTENDANCE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {ATTENDANCE_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="absence-note"
                className="block text-sm font-medium text-stone-700"
              >
                Note <span className="text-stone-400">(optional)</span>
              </label>
              <textarea
                id="absence-note"
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                rows={2}
                placeholder={
                  reason === "other"
                    ? "What was the reason?"
                    : "Anything to add?"
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={countsTowardPackage}
                onChange={(e) => setCountsTowardPackage(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              />
              Counts toward package
            </label>

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
                {loading ? "Saving…" : isEdit ? "Save changes" : "Mark absent"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
