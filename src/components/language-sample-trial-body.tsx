"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { CueingLevel, LanguageSampleTrialValue, Trial } from "@/lib/types";
import { getColorOption } from "@/lib/colors";

type Props = {
  levels: CueingLevel[];
  /** This session's trials for the goal — used for the per-level count
   *  badges (same as every other format's buttons) and the running list
   *  of utterances collected so far. */
  trials: Trial[];
  logging: boolean;
  onLogUtterance: (value: LanguageSampleTrialValue) => Promise<void> | void;
};

function readUtterance(value: Record<string, unknown>): LanguageSampleTrialValue | null {
  if (typeof value.utterance !== "string" || typeof value.level !== "string") return null;
  return {
    utterance: value.utterance,
    meaning: typeof value.meaning === "string" ? value.meaning : "",
    appropriate: value.appropriate === true,
    level: value.level,
  };
}

/** The "language_sample" trial-entry body: type what the child said and
 *  what it meant, mark whether it was appropriate in context, tap the
 *  support level it came with (same colored level buttons the other
 *  formats use), then "Log utterance" saves all of it as ONE trial. */
export default function LanguageSampleTrialBody({
  levels,
  trials,
  logging,
  onLogUtterance,
}: Props) {
  const [utterance, setUtterance] = useState("");
  const [meaning, setMeaning] = useState("");
  const [appropriate, setAppropriate] = useState<boolean | null>(null);
  const [level, setLevel] = useState<string | null>(null);

  const levelCounts: Record<string, number> = {};
  const logged: LanguageSampleTrialValue[] = [];
  for (const trial of trials) {
    const entry = readUtterance(trial.value ?? {});
    if (!entry) continue;
    logged.push(entry);
    levelCounts[entry.level] = (levelCounts[entry.level] ?? 0) + 1;
  }

  const canLog = utterance.trim() !== "" && appropriate !== null && level !== null;

  async function handleLog() {
    if (!canLog) return;
    await onLogUtterance({
      utterance: utterance.trim(),
      meaning: meaning.trim(),
      appropriate: appropriate === true,
      level: level!,
    });
    setUtterance("");
    setMeaning("");
    setAppropriate(null);
    setLevel(null);
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-stone-500">Utterance / word produced</span>
          <input
            type="text"
            value={utterance}
            onChange={(e) => setUtterance(e.target.value)}
            placeholder='e.g. "more juice"'
            className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-500">Meaning / gloss</span>
          <input
            type="text"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="e.g. requesting more"
            className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      <div>
        <p className="text-xs font-medium text-stone-500">Appropriate in context?</p>
        <div className="mt-1 flex gap-1.5">
          <button
            type="button"
            onClick={() => setAppropriate(appropriate === true ? null : true)}
            disabled={logging}
            aria-pressed={appropriate === true}
            className={`inline-flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 transition-transform active:scale-95 disabled:opacity-50 ${
              appropriate === true ? "ring-2 ring-offset-1 ring-stone-900" : ""
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            Yes
          </button>
          <button
            type="button"
            onClick={() => setAppropriate(appropriate === false ? null : false)}
            disabled={logging}
            aria-pressed={appropriate === false}
            className={`inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 transition-transform active:scale-95 disabled:opacity-50 ${
              appropriate === false ? "ring-2 ring-offset-1 ring-stone-900" : ""
            }`}
          >
            <X className="h-3.5 w-3.5" />
            No
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-stone-500">Support level</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {levels.map((l) => {
            const color = getColorOption(l.color);
            const selected = level === l.name;
            const count = levelCounts[l.name] ?? 0;
            return (
              <button
                key={l.name}
                type="button"
                onClick={() => setLevel(selected ? null : l.name)}
                disabled={logging}
                aria-label={`${l.name}${count > 0 ? ` (${count} logged)` : ""}`}
                aria-pressed={selected}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50 ${color.badgeClass} ${
                  selected ? "ring-2 ring-offset-1 ring-stone-900" : ""
                }`}
              >
                {l.name}
                {count > 0 && (
                  <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleLog}
        disabled={logging || !canLog}
        className="w-full rounded-lg bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
      >
        Log utterance
      </button>

      {logged.length > 0 && (
        <ul className="space-y-1 border-t border-stone-100 pt-2">
          {logged.map((entry, i) => {
            const color = getColorOption(levels.find((l) => l.name === entry.level)?.color ?? "grey");
            return (
              <li key={i} className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
                <span className="font-medium text-stone-900">&ldquo;{entry.utterance}&rdquo;</span>
                {entry.meaning && <span className="text-stone-500">— {entry.meaning}</span>}
                <span className={entry.appropriate ? "text-green-700" : "text-red-700"}>
                  {entry.appropriate ? "appropriate" : "not appropriate"}
                </span>
                <span className={`rounded-full px-2 py-0.5 ${color.badgeClass}`}>{entry.level}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
