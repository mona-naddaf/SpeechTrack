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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-slate-900">
          {mode === "add"
            ? "Add home practice item"
            : "Edit home practice item"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="what-to-practice"
              className="block text-sm font-medium text-slate-700"
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
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="how-to-practice"
              className="block text-sm font-medium text-slate-700"
            >
              How to practice{" "}
              <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="how-to-practice"
              value={howToPractice}
              onChange={(e) => setHowToPractice(e.target.value)}
              rows={3}
              placeholder="e.g. Say each word 5 times, then use it in a sentence"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="last-worked-date"
              className="block text-sm font-medium text-slate-700"
            >
              Last worked on{" "}
              <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="last-worked-date"
              type="date"
              value={lastWorkedDate}
              onChange={(e) => setLastWorkedDate(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
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
  );
}
