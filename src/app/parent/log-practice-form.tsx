"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { getTodayLocalDateString } from "@/lib/date";
import { HOW_IT_WENT_OPTIONS } from "@/lib/practice";
import type { HomePracticeItem, HowItWent } from "@/lib/types";

type Props = {
  items: HomePracticeItem[];
};

// Warm, distinct colors per mood — selecting one should feel like a tap of
// joy, not a form field. Kept local to this component since the SLP-side
// practice log view renders moods as plain neutral badges instead. Shades
// are chosen for solid white-text contrast (4.5:1+), not just visual warmth.
const MOOD_SELECTED_CLASSES: Record<HowItWent, string> = {
  great: "border-green-700 bg-green-700 text-white shadow-lg shadow-green-200",
  okay: "border-amber-700 bg-amber-700 text-white shadow-lg shadow-amber-200",
  tricky: "border-brand-700 bg-brand-700 text-white shadow-lg shadow-brand-200",
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
      className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4 sm:p-5"
    >
      {items.length > 0 && (
        <div>
          <p className="text-sm font-medium text-stone-700">
            What did you practice?
          </p>
          <div className="mt-2 space-y-2">
            {items.map((item) => (
              <label
                key={item.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-base transition-colors ${
                  selectedIds.has(item.id)
                    ? "border-brand-300 bg-brand-50"
                    : "border-stone-200 bg-white hover:bg-cream-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="h-5 w-5 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                />
                {item.what_to_practice}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="text-sm font-medium text-stone-700">How did it go?</p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {HOW_IT_WENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setHowItWent(option.value)}
              className={`flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                howItWent === option.value
                  ? `scale-105 ${MOOD_SELECTED_CLASSES[option.value]}`
                  : "border-stone-200 bg-white text-stone-700 shadow-sm hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
              }`}
            >
              <span className="text-4xl">{option.emoji}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <label
          htmlFor="practice-note"
          className="text-sm font-medium text-stone-700"
        >
          Anything to add? <span className="text-stone-400">(optional)</span>
        </label>
        <textarea
          id="practice-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-green-600">
          <PartyPopper className="h-4 w-4" />
          Saved! Great job today.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-lg bg-brand-700 px-4 py-3 text-base font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save today's practice"}
      </button>
    </form>
  );
}
