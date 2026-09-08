"use client";

import { useState, type FormEvent } from "react";
import type { ClassroomStrategy } from "@/lib/types";

export type ClassroomStrategyFormValues = {
  whatToDo: string;
  howToDoIt: string;
  lastUsedDate: string;
};

type Props = {
  mode: "add" | "edit";
  initialItem?: ClassroomStrategy | null;
  onCancel: () => void;
  onSubmit: (values: ClassroomStrategyFormValues) => Promise<string | null>;
};

export default function ClassroomStrategyFormModal({
  mode,
  initialItem,
  onCancel,
  onSubmit,
}: Props) {
  const [whatToDo, setWhatToDo] = useState(initialItem?.what_to_do ?? "");
  const [howToDoIt, setHowToDoIt] = useState(initialItem?.how_to_do_it ?? "");
  const [lastUsedDate, setLastUsedDate] = useState(
    initialItem?.last_used_date ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = whatToDo.trim();
    if (!trimmed) {
      setError("Please describe the strategy.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({
      whatToDo: trimmed,
      howToDoIt: howToDoIt.trim(),
      lastUsedDate,
    });
    setLoading(false);
    if (result) setError(result);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">
          {mode === "add" ? "Add classroom strategy" : "Edit classroom strategy"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="what-to-do"
              className="block text-sm font-medium text-stone-700"
            >
              What to do
            </label>
            <input
              id="what-to-do"
              type="text"
              required
              autoFocus
              value={whatToDo}
              onChange={(e) => setWhatToDo(e.target.value)}
              placeholder="e.g. Give extra think time before calling on her"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="how-to-do-it"
              className="block text-sm font-medium text-stone-700"
            >
              How to do it <span className="text-stone-400">(optional)</span>
            </label>
            <textarea
              id="how-to-do-it"
              value={howToDoIt}
              onChange={(e) => setHowToDoIt(e.target.value)}
              rows={3}
              placeholder="e.g. Count to 5 silently after asking a question before moving on"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="last-used-date"
              className="block text-sm font-medium text-stone-700"
            >
              Last used <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="last-used-date"
              type="date"
              value={lastUsedDate}
              onChange={(e) => setLastUsedDate(e.target.value)}
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
                  ? "Add strategy"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
