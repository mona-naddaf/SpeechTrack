"use client";

import { useState, type FormEvent } from "react";
import { getTodayLocalDateString } from "@/lib/date";
import { SEVERITY_LABELS } from "@/lib/behavior";
import type { BehaviorSeverity, BehaviorType } from "@/lib/types";

export type LogBehaviorValues = {
  date: string;
  behaviorTypeId: string;
  severity: BehaviorSeverity | null;
  note: string;
};

type Props = {
  behaviorTypes: BehaviorType[];
  onCancel: () => void;
  onSubmit: (values: LogBehaviorValues) => Promise<string | null>;
};

const SEVERITIES: BehaviorSeverity[] = [1, 2, 3];

export default function LogBehaviorModal({
  behaviorTypes,
  onCancel,
  onSubmit,
}: Props) {
  const [date, setDate] = useState(getTodayLocalDateString());
  const [behaviorTypeId, setBehaviorTypeId] = useState(behaviorTypes[0]?.id ?? "");
  const [severity, setSeverity] = useState<BehaviorSeverity | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!behaviorTypeId) {
      setError("Please choose a behavior type.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({
      date,
      behaviorTypeId,
      severity,
      note: note.trim(),
    });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">Log behavior</h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="behavior-date"
                className="block text-sm font-medium text-stone-700"
              >
                Date
              </label>
              <input
                id="behavior-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="behavior-type"
                className="block text-sm font-medium text-stone-700"
              >
                Behavior type
              </label>
              <select
                id="behavior-type"
                value={behaviorTypeId}
                onChange={(e) => setBehaviorTypeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {behaviorTypes.length === 0 && (
                  <option value="">No behavior types yet</option>
                )}
                {behaviorTypes.map((bt) => (
                  <option key={bt.id} value={bt.id}>
                    {bt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-sm font-medium text-stone-700">
                Severity <span className="text-stone-400">(optional)</span>
              </span>
              <div className="mt-1 flex gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity((prev) => (prev === s ? null : s))}
                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                    severity === s
                      ? "border-brand-600 bg-brand-50 text-brand-800"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-cream-50"
                  }`}
                  >
                    {SEVERITY_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="behavior-note"
                className="block text-sm font-medium text-stone-700"
              >
                Note <span className="text-stone-400">(optional)</span>
              </label>
              <textarea
                id="behavior-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="What happened?"
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
                {loading ? "Saving…" : "Log behavior"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
