"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Holiday } from "@/lib/types";
import { formatDateRange } from "@/lib/date";

type Props = {
  holiday: Holiday;
  onCancel: () => void;
  onConfirm: () => Promise<string | null>;
};

/** Same "separate confirm modal before a permanent delete" pattern as
 *  every other delete in this app (e.g. DeleteScheduleEventConfirmModal)
 *  — reached from HolidayFormModal's own "Delete" button. */
export default function DeleteHolidayConfirmModal({
  holiday,
  onCancel,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await onConfirm();
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900">
            <Trash2 className="h-5 w-5 text-red-500" />
            Delete holiday
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Are you sure you want to delete this holiday? Any protection it
            gave a student&apos;s streak on{" "}
            {holiday.start_date === holiday.end_date ? "that day" : "those days"}{" "}
            goes with it. This action cannot be undone.
          </p>
          <div className="mt-2 rounded-md bg-cream-50 p-3 text-sm text-stone-700">
            <p className="font-medium">{holiday.title}</p>
            <p className="text-stone-500">
              {formatDateRange(holiday.start_date, holiday.end_date)}
            </p>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
