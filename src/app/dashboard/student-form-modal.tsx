"use client";

import { useState, type FormEvent } from "react";
import type { Student } from "@/lib/types";

type Props = {
  mode: "add" | "edit";
  initialStudent?: Student | null;
  onCancel: () => void;
  onSubmit: (values: {
    name: string;
    className: string;
  }) => Promise<string | null>;
};

export default function StudentFormModal({
  mode,
  initialStudent,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialStudent?.name ?? "");
  const [className, setClassName] = useState(initialStudent?.class ?? "");
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
    const result = await onSubmit({
      name: trimmedName,
      className: className.trim(),
    });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">
          {mode === "add" ? "Add student" : "Edit student"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="student-name"
              className="block text-sm font-medium text-stone-700"
            >
              Name
            </label>
            <input
              id="student-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="student-class"
              className="block text-sm font-medium text-stone-700"
            >
              Class <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="student-class"
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
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
              {loading
                ? "Saving…"
                : mode === "add"
                  ? "Add student"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
