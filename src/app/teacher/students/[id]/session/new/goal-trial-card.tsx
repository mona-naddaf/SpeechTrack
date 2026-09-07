"use client";

import { useState } from "react";
import { Check, Undo2, X } from "lucide-react";
import type { MaterialChip, TeacherSessionGoal, Trial } from "@/lib/types";
import type { MaterialUsageSummary } from "@/lib/progress";
import { getColorOption } from "@/lib/colors";
import SentenceStructureTrialBody from "@/components/sentence-structure-trial-body";
import GoalMaterialSection, {
  type AddMaterialResult,
} from "./goal-material-section";

type Props = {
  goal: TeacherSessionGoal;
  trials: Trial[];
  onLogTrial: (value: Record<string, unknown>) => Promise<void> | void;
  onUndo: () => Promise<void> | void;
  materials: MaterialChip[];
  activeMaterialId: string | null;
  lastUsedStats: MaterialUsageSummary | null;
  onSelectMaterial: (materialId: string | null) => void;
  onAddMaterial: (title: string, url: string) => Promise<AddMaterialResult>;
};

export default function GoalTrialCard({
  goal,
  trials,
  onLogTrial,
  onUndo,
  materials,
  activeMaterialId,
  lastUsedStats,
  onSelectMaterial,
  onAddMaterial,
}: Props) {
  const [logging, setLogging] = useState(false);
  const [undoing, setUndoing] = useState(false);

  async function handleLog(value: Record<string, unknown>) {
    setLogging(true);
    await onLogTrial(value);
    setLogging(false);
  }

  async function handleUndo() {
    setUndoing(true);
    await onUndo();
    setUndoing(false);
  }

  const format = goal.response_format;
  const formatType = format?.type;
  const levels = formatType === "cueing_hierarchy" ? (format?.config.levels ?? []) : [];
  const ratingMin = Number(format?.config.min ?? 0);
  const ratingMax = Number(format?.config.max ?? 4);
  const correctLabel = String(format?.config.correctLabel ?? "Correct");
  const incorrectLabel = String(format?.config.incorrectLabel ?? "Incorrect");

  // "sentence_structure" trials don't fit this single-value shape at all
  // (each trial holds a whole components[]/extras[] row) — its own tally
  // is computed inside SentenceStructureTrialBody instead, so it's simply
  // skipped here.
  const tally: Record<string, number> = {};
  if (formatType !== "sentence_structure") {
    for (const trial of trials) {
      let key: string;
      if (formatType === "cueing_hierarchy") {
        key = String(trial.value?.level ?? "");
      } else if (formatType === "rating_scale") {
        key = String(trial.value?.rating ?? "");
      } else {
        key = trial.value?.correct ? "correct" : "incorrect";
      }
      tally[key] = (tally[key] ?? 0) + 1;
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          {goal.subject && (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
              {goal.subject.name}
            </span>
          )}
          <p className="mt-2 text-sm font-medium text-stone-900">
            {goal.text}
          </p>
          <GoalMaterialSection
            materials={materials}
            activeMaterialId={activeMaterialId}
            lastUsedStats={lastUsedStats}
            onSelect={onSelectMaterial}
            onAddMaterial={onAddMaterial}
          />
        </div>
        <span className="shrink-0 text-xs text-stone-400">
          {trials.length} trial{trials.length === 1 ? "" : "s"}
        </span>
      </div>

      {formatType === "sentence_structure" ? (
        <SentenceStructureTrialBody
          components={format?.config.components ?? []}
          levels={format?.config.levels ?? []}
          trials={trials}
          logging={logging}
          onLogAttempt={handleLog}
        />
      ) : formatType === "cueing_hierarchy" ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {levels.map((level, i) => {
            const color = getColorOption(level.color);
            const count = tally[level.name] ?? 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleLog({ level: level.name })}
                disabled={logging}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 text-center text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50 ${color.badgeClass}`}
              >
                <span>{level.name}</span>
                {count > 0 && (
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : formatType === "rating_scale" ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {Array.from(
            { length: ratingMax - ratingMin + 1 },
            (_, i) => ratingMin + i
          ).map((rating) => {
            const count = tally[String(rating)] ?? 0;
            return (
              <button
                key={rating}
                type="button"
                onClick={() => handleLog({ rating })}
                disabled={logging}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg bg-accent-100 px-2 py-3 text-center text-sm font-semibold text-accent-800 transition-transform active:scale-95 disabled:opacity-50"
              >
                <span>{rating}</span>
                {count > 0 && (
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleLog({ correct: true })}
            disabled={logging}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg bg-green-100 px-2 py-3 text-center text-sm font-semibold text-green-800 transition-transform active:scale-95 disabled:opacity-50"
          >
            <span className="flex items-center gap-1">
              <Check className="h-4 w-4" />
              {correctLabel}
            </span>
            {(tally.correct ?? 0) > 0 && (
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">
                {tally.correct}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleLog({ correct: false })}
            disabled={logging}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg bg-red-100 px-2 py-3 text-center text-sm font-semibold text-red-800 transition-transform active:scale-95 disabled:opacity-50"
          >
            <span className="flex items-center gap-1">
              <X className="h-4 w-4" />
              {incorrectLabel}
            </span>
            {(tally.incorrect ?? 0) > 0 && (
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">
                {tally.incorrect}
              </span>
            )}
          </button>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleUndo}
          disabled={undoing || trials.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" />
          Undo last
        </button>
      </div>
    </div>
  );
}
