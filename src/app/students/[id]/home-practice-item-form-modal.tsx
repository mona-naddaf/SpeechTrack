"use client";

import { useState, type FormEvent } from "react";
import type { HomePracticeItem } from "@/lib/types";

export type HomePracticeItemFormValues = {
  whatToPractice: string;
  howToPractice: string;
  lastWorkedDate: string;
};

type Props = {
  mode: "add" | "edit";
  initialItem?: HomePracticeItem | null;
  onCancel: () => void;
  onSubmit: (values: HomePracticeItemFormValues) => Promise<string | null>;
};

export default function HomePracticeItemFormModal({
  mode,
  initialItem,
  onCancel,
  onSubmit,
}: Props) {
  const [whatToPractice, setWhatToPractice] = useState(
    initialItem?.what_to_practice ?? ""
  );
  const [howToPractice, setHowToPractice] = useState(
    initialItem?.how_to_practice ?? ""
  );
  const [lastWorkedDate, setLastWorkedDate] = useState(
    initialItem?.last_worked_date ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = whatToPractice.trim();
    if (!trimmed) {
      setError("Please describe what to practice.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({
      whatToPractice: trimmed,
      howToPractice: howToPractice.trim(),
      lastWorkedDate,
    });
    setLoading(false);
    if (result) setError(result);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">
            {mode === "add"
              ? "Add home practice item"
              : "Edit home practice item"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="what-to-practice"
                className="block text-sm font-medium text-stone-700"
              >
                What to practice
              </label>
              <input
                id="what-to-practice"
                type="text"
                required
                autoFocus
                value={whatToPractice}
                onChange={(e) => setWhatToPractice(e.target.value)}
                placeholder="e.g. Practice /r/ words from the list"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="how-to-practice"
                className="block text-sm font-medium text-stone-700"
              >
                How to practice{" "}
                <span className="text-stone-400">(optional)</span>
              </label>
              <textarea
                id="how-to-practice"
                value={howToPractice}
                onChange={(e) => setHowToPractice(e.target.value)}
                rows={3}
                placeholder="e.g. Say each word 5 times, then use it in a sentence"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="last-worked-date"
                className="block text-sm font-medium text-stone-700"
              >
                Last worked on{" "}
                <span className="text-stone-400">(optional)</span>
              </label>
              <input
                id="last-worked-date"
                type="date"
                value={lastWorkedDate}
                onChange={(e) => setLastWorkedDate(e.target.value)}
                className="mt-1 w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                {loading
                  ? "Saving…"
                  : mode === "add"
                    ? "Add item"
                    : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
