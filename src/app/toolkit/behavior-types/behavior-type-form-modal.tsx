"use client";

import { useState, type FormEvent } from "react";
import type { BehaviorType } from "@/lib/types";
import { COLOR_OPTIONS, getColorOption } from "@/lib/colors";

type Props = {
  mode: "add" | "edit";
  initialBehaviorType?: BehaviorType | null;
  onCancel: () => void;
  onSubmit: (values: { name: string; color: string }) => Promise<string | null>;
};

export default function BehaviorTypeFormModal({
  mode,
  initialBehaviorType,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialBehaviorType?.name ?? "");
  const [color, setColor] = useState(initialBehaviorType?.color ?? "grey");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({ name: trimmedName, color });
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
            {mode === "add" ? "Add behavior type" : "Edit behavior type"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="behavior-type-name"
                className="block text-sm font-medium text-stone-700"
              >
                Name
              </label>
              <input
                id="behavior-type-name"
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Off-task"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-stone-700">
                Color
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    aria-label={c.label}
                    aria-pressed={color === c.value}
                    className={`h-8 w-8 rounded-full ${c.swatchClass} transition-all ${
                    color === c.value
                      ? "ring-2 ring-stone-900 ring-offset-2"
                      : "hover:scale-110"
                  }`}
                  />
                ))}
              </div>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
                <span
                  className={`rounded-full px-2.5 py-1 ${getColorOption(color).badgeClass}`}
                >
                  {name.trim() || "Preview"}
                </span>
              </p>
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
                    ? "Add behavior type"
                    : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
