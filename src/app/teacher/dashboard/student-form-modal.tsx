"use client";

import { useState, type FormEvent } from "react";
import type { ExpectedFrequency, TeacherStudent } from "@/lib/types";
import { EXPECTED_FREQUENCY_LABELS } from "@/lib/streaks";
import AvatarPicker from "@/components/avatar-picker";

type Props = {
  mode: "add" | "edit";
  initialStudent?: TeacherStudent | null;
  onCancel: () => void;
  onSubmit: (values: {
    name: string;
    className: string;
    expectedFrequency: ExpectedFrequency;
    avatar: string | null;
  }) => Promise<string | null>;
};

const FREQUENCY_OPTIONS: ExpectedFrequency[] = [
  "daily",
  "few_times_week",
  "weekly",
];

export default function StudentFormModal({
  mode,
  initialStudent,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialStudent?.name ?? "");
  const [className, setClassName] = useState(initialStudent?.class ?? "");
  const [expectedFrequency, setExpectedFrequency] =
    useState<ExpectedFrequency>(initialStudent?.expected_frequency ?? "weekly");
  const [avatar, setAvatar] = useState<string | null>(
    initialStudent?.avatar ?? null
  );
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
      expectedFrequency,
      avatar,
    });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
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

          <div>
            <label
              htmlFor="student-frequency"
              className="block text-sm font-medium text-stone-700"
            >
              How often do you plan to log sessions?
            </label>
            <select
              id="student-frequency"
              value={expectedFrequency}
              onChange={(e) =>
                setExpectedFrequency(e.target.value as ExpectedFrequency)
              }
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {EXPECTED_FREQUENCY_LABELS[option]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">
              Used to track this student&apos;s session streak.
            </p>
          </div>

          <AvatarPicker value={avatar} onChange={setAvatar} />

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
