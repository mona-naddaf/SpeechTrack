"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { CueingLevel, SentenceStructureComponent, Trial } from "@/lib/types";
import { getColorOption } from "@/lib/colors";

type Extra = { label: string; level: string };

type Props = {
  components: SentenceStructureComponent[];
  levels: CueingLevel[];
  /** Past trials for this goal — used only to show a running per-component
   *  per-level tally, same as the count badges the other format types
   *  already show on their buttons. */
  trials: Trial[];
  logging: boolean;
  onLogAttempt: (value: Record<string, unknown>) => Promise<void> | void;
};

/** The "sentence_structure" trial-entry body: one row per component, each
 *  with the same colored level buttons the other formats use — tapping
 *  builds up the current attempt rather than logging immediately. An
 *  ad-hoc "+ Add extra" can tag one more part for just this attempt
 *  without touching the format's own component list. "Log attempt" saves
 *  the whole row (every component + any extras) as ONE trial, matching
 *  how she'd tally this on paper. */
export default function SentenceStructureTrialBody({
  components,
  levels,
  trials,
  logging,
  onLogAttempt,
}: Props) {
  const [draftByComponent, setDraftByComponent] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [addingExtra, setAddingExtra] = useState(false);
  const [extraLabel, setExtraLabel] = useState("");
  const [extraLevel, setExtraLevel] = useState(levels[0]?.name ?? "");

  // Running per-component, per-level counts across every past trial —
  // same idea as the count badge every other format's buttons show.
  const tally: Record<string, Record<string, number>> = {};
  for (const trial of trials) {
    const picked = Array.isArray(trial.value?.components) ? trial.value.components : [];
    for (const c of picked) {
      if (c && typeof c === "object" && typeof (c as { name?: unknown }).name === "string") {
        const name = (c as { name: string }).name;
        const level = (c as { level?: unknown }).level;
        if (typeof level === "string") {
          tally[name] = tally[name] ?? {};
          tally[name][level] = (tally[name][level] ?? 0) + 1;
        }
      }
    }
  }

  function selectLevel(componentName: string, levelName: string) {
    setDraftByComponent((prev) => {
      const next = { ...prev };
      if (next[componentName] === levelName) {
        delete next[componentName];
      } else {
        next[componentName] = levelName;
      }
      return next;
    });
  }

  function handleStartAddExtra() {
    setExtraLabel("");
    setExtraLevel(levels[0]?.name ?? "");
    setAddingExtra(true);
  }

  function handleConfirmAddExtra() {
    if (!extraLabel.trim() || !extraLevel) return;
    setExtras((prev) => [...prev, { label: extraLabel.trim(), level: extraLevel }]);
    setAddingExtra(false);
  }

  function removeExtra(index: number) {
    setExtras((prev) => prev.filter((_, i) => i !== index));
  }

  const hasAnyPick = Object.keys(draftByComponent).length > 0 || extras.length > 0;

  async function handleLogAttempt() {
    if (!hasAnyPick) return;
    const componentsPayload = components
      .filter((c) => draftByComponent[c.name])
      .map((c) => ({ name: c.name, level: draftByComponent[c.name] }));
    await onLogAttempt({ components: componentsPayload, extras });
    setDraftByComponent({});
    setExtras([]);
  }

  return (
    <div className="mt-4 space-y-3">
      {components.map((component) => (
        <div key={component.id}>
          <p className="text-xs font-medium text-stone-500">{component.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {levels.map((level) => {
              const color = getColorOption(level.color);
              const selected = draftByComponent[component.name] === level.name;
              const count = tally[component.name]?.[level.name] ?? 0;
              return (
                <button
                  key={level.name}
                  type="button"
                  onClick={() => selectLevel(component.name, level.name)}
                  disabled={logging}
                  aria-label={`${component.name}: ${level.name}${count > 0 ? ` (${count} logged)` : ""}`}
                  aria-pressed={selected}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50 ${color.badgeClass} ${
                    selected ? "ring-2 ring-offset-1 ring-stone-900" : ""
                  }`}
                >
                  {level.name}
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
      ))}

      {extras.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {extras.map((extra, i) => {
            const level = levels.find((l) => l.name === extra.level);
            const color = getColorOption(level?.color ?? "grey");
            return (
              <span
                key={i}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${color.badgeClass}`}
              >
                {extra.label}: {extra.level}
                <button
                  type="button"
                  onClick={() => removeExtra(i)}
                  aria-label={`Remove extra ${extra.label}`}
                  className="rounded-full p-0.5 hover:bg-white/50"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {addingExtra ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-stone-300 p-2">
          <input
            type="text"
            value={extraLabel}
            onChange={(e) => setExtraLabel(e.target.value)}
            placeholder="Extra part, e.g. Preposition"
            className="min-w-0 flex-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            autoFocus
          />
          <select
            value={extraLevel}
            onChange={(e) => setExtraLevel(e.target.value)}
            className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {levels.map((level) => (
              <option key={level.name} value={level.name}>
                {level.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleConfirmAddExtra}
            className="rounded-lg bg-stone-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-stone-900"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAddingExtra(false)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleStartAddExtra}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-cream-50"
        >
          <Plus className="h-3 w-3" />
          Add extra
        </button>
      )}

      <button
        type="button"
        onClick={handleLogAttempt}
        disabled={logging || !hasAnyPick}
        className="w-full rounded-lg bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
      >
        Log attempt
      </button>
    </div>
  );
}
