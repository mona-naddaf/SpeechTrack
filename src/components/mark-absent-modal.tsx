"use client";

import { useState, type FormEvent } from "react";
import { getTodayLocalDateString } from "@/lib/date";
import { ATTENDANCE_REASONS, ATTENDANCE_REASON_LABELS } from "@/lib/attendance";
import type { AttendanceReason } from "@/lib/types";

export type MarkAbsentValues = {
  date: string;
  reason: AttendanceReason;
  reasonNote: string;
};

type Props = {
  onCancel: () => void;
  onSubmit: (values: MarkAbsentValues) => Promise<string | null>;
};

export default function MarkAbsentModal({ onCancel, onSubmit }: Props) {
  const [date, setDate] = useState(getTodayLocalDateString());
  const [reason, setReason] = useState<AttendanceReason>("sick");
  const [reasonNote, setReasonNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await onSubmit({ date, reason, reasonNote: reasonNote.trim() });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">Mark absent</h2>

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
              {loading ? "Saving…" : "Mark absent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
