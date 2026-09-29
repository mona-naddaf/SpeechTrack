"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import type { Holiday } from "@/lib/types";

export type HolidayFormValues = {
  title: string;
  startDate: string;
  endDate: string;
};

type Props = {
  mode: "add" | "edit";
  initialHoliday?: Holiday | null;
  onCancel: () => void;
  onSubmit: (values: HolidayFormValues) => Promise<string | null>;
  /** Edit mode only — hands off to the caller's own delete-confirm flow,
   *  same "Delete button inside the edit form" shape
   *  ScheduleEventFormModal already uses. */
  onDelete?: () => void;
};

/** Add/edit form for a holiday — title + a date range (see
 *  0033_holiday_date_ranges.sql). Shared by the SLP and Teacher Schedule
 *  pages via ScheduleView, since holidays is one table for both sides
 *  (see 0032_holidays_and_countdowns.sql). */
export default function HolidayFormModal({
  mode,
  initialHoliday,
  onCancel,
  onSubmit,
  onDelete,
}: Props) {
  const [title, setTitle] = useState(initialHoliday?.title ?? "");
  const [startDate, setStartDate] = useState(initialHoliday?.start_date ?? "");
  const [endDate, setEndDate] = useState(initialHoliday?.end_date ?? "");
  // Whether the end date has ever been set independently of the start
  // date. While false, changing the start date carries the end date
  // along with it — so a single-day holiday only means picking one
  // date, same as this form's old single-`date` shape effectively felt
  // like. An edit starts "touched": its two dates already carry real,
  // possibly-different values chosen on purpose, so nudging the start
  // date of an existing multi-day holiday must never silently collapse
  // its end date back to match.
  const [endDateTouched, setEndDateTouched] = useState(mode === "edit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (!endDateTouched) {
      setEndDate(value);
    }
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);
    setEndDateTouched(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (endDate < startDate) {
      setError("End date can't be before the start date.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({ title: trimmedTitle, startDate, endDate });
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
            {mode === "add" ? "Add holiday" : "Edit holiday"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="holiday-title"
                className="block text-sm font-medium text-stone-700"
              >
                Title
              </label>
              <input
                id="holiday-title"
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Winter break"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div>
                <label
                  htmlFor="holiday-start-date"
                  className="block text-sm font-medium text-stone-700"
                >
                  Start date
                </label>
                <input
                  id="holiday-start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label
                  htmlFor="holiday-end-date"
                  className="block text-sm font-medium text-stone-700"
                >
                  End date
                </label>
                <input
                  id="holiday-end-date"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
            <p className="text-xs text-stone-400">
              A single-day holiday just picks the same date twice — the end
              date follows the start date automatically until you change it
              yourself.
            </p>

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
                      ? "Add holiday"
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
