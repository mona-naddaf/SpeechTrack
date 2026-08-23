"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getTodayLocalDateString } from "@/lib/date";
import { HOW_IT_WENT_OPTIONS } from "@/lib/practice";
import type { HomePracticeItem, HowItWent } from "@/lib/types";

type Props = {
  items: HomePracticeItem[];
};

export default function LogPracticeForm({ items }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [howItWent, setHowItWent] = useState<HowItWent | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!howItWent) {
      setError("Please choose how it went.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    const activities = items
      .filter((item) => selectedIds.has(item.id))
      .map((item) => ({ id: item.id, text: item.what_to_practice }));

    try {
      const res = await fetch("/api/parent/practice/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities,
          howItWent,
          note: note.trim() || undefined,
          date: getTodayLocalDateString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save. Please try again.");
        setLoading(false);
        return;
      }
      setSelectedIds(new Set());
      setHowItWent(null);
      setNote("");
      setSuccess(true);
      router.refresh();
    } catch {
      setError(
        "Something went wrong. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      {items.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700">
            What did you practice?
          </p>
          <div className="mt-2 space-y-2">
            {items.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-base"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="h-5 w-5 shrink-0 rounded border-slate-300"
                />
                {item.what_to_practice}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="text-sm font-medium text-slate-700">How did it go?</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {HOW_IT_WENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setHowItWent(option.value)}
              className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border-2 text-sm font-semibold transition-colors ${
                howItWent === option.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-3xl">{option.emoji}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <label
          htmlFor="practice-note"
          className="text-sm font-medium text-slate-700"
        >
          Anything to add? <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="practice-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && (
        <p className="mt-3 text-sm text-green-600">Saved! Great job today.</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-md bg-slate-900 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save today's practice"}
      </button>
    </form>
  );
}
