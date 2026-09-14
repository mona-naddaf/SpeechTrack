"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";

type Props = {
  initialName: string;
  onCancel: () => void;
  onConfirm: (newName: string) => Promise<string | null>;
};

/** Renames a track — works for any track, not just the ones
 *  auto-created behind the scenes by the "queued behind a single goal"
 *  flow (see goal-queue-placement.ts's autoTrackName) — that flow just
 *  makes renaming worth having in the first place, since its default
 *  name is sometimes not what she'd have picked herself. */
export default function RenameTrackModal({
  initialName,
  onCancel,
  onConfirm,
}: Props) {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a track name.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onConfirm(trimmed);
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900">
          <Pencil className="h-5 w-5 text-brand-500" />
          Rename track
        </h2>

        <form onSubmit={handleSubmit} className="mt-4">
          <label
            htmlFor="rename-track-name"
            className="block text-sm font-medium text-stone-700"
          >
            Track name
          </label>
          <input
            id="rename-track-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

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
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
