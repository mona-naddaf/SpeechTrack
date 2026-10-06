"use client";

import { useState, type FormEvent } from "react";
import { getTodayLocalDateString } from "@/lib/date";

export type ManualEntryValues = {
  date: string;
  note: string;
};

type Props = {
  onCancel: () => void;
  onSubmit: (values: ManualEntryValues) => Promise<string | null>;
};

/** "+ Add session manually" — counts a session that happened but was
 *  never logged toward the student's package. */
export default function ManualEntryModal({ onCancel, onSubmit }: Props) {
  const [date, setDate] = useState(getTodayLocalDateString());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Please pick a date.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await onSubmit({ date, note: note.trim() });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">Add session manually</h2>
          <p className="mt-1 text-sm text-stone-500">
            For a session that happened but wasn&apos;t logged. Counts toward
            the package only — it adds no trial data.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="manual-entry-date"
                className="block text-sm font-medium text-stone-700"
              >
                Date
              </label>
              <input
                id="manual-entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="manual-entry-note"
                className="block text-sm font-medium text-stone-700"
              >
                Note <span className="text-stone-400">(optional)</span>
              </label>
              <textarea
                id="manual-entry-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. Session held, no log taken"
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
                {loading ? "Saving…" : "Add session"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
