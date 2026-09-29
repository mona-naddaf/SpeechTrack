"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import type { Countdown } from "@/lib/types";

export type CountdownFormValues = {
  title: string;
  targetDate: string;
};

type Props = {
  mode: "add" | "edit";
  initialCountdown?: Countdown | null;
  onCancel: () => void;
  onSubmit: (values: CountdownFormValues) => Promise<string | null>;
  /** Edit mode only — hands off to the caller's own delete-confirm flow,
   *  same "Delete button inside the edit form" shape
   *  ScheduleEventFormModal/HolidayFormModal already use. */
  onDelete?: () => void;
};

/** Add/edit form for a countdown — title + the date being counted down
 *  to. Shared by the SLP and Teacher Schedule pages via ScheduleView,
 *  since countdowns is one table for both sides (see
 *  0032_holidays_and_countdowns.sql). */
export default function CountdownFormModal({
  mode,
  initialCountdown,
  onCancel,
  onSubmit,
  onDelete,
}: Props) {
  const [title, setTitle] = useState(initialCountdown?.title ?? "");
  const [targetDate, setTargetDate] = useState(
    initialCountdown?.target_date ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (!targetDate) {
      setError("Date is required.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({ title: trimmedTitle, targetDate });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">
            {mode === "add" ? "Add countdown" : "Edit countdown"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="countdown-title"
                className="block text-sm font-medium text-stone-700"
              >
                Title
              </label>
              <input
                id="countdown-title"
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. IEP deadline"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="countdown-date"
                className="block text-sm font-medium text-stone-700"
              >
                Date
              </label>
              <input
                id="countdown-date"
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between gap-2 pt-2">
              {mode === "edit" && onDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
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
                      ? "Add countdown"
                      : "Save changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
