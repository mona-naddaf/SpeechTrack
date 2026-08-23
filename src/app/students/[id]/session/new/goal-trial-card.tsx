"use client";

import { useState } from "react";
import type { SessionGoal, Trial } from "@/lib/types";
import { getColorOption } from "@/lib/colors";

type Props = {
  goal: SessionGoal;
  trials: Trial[];
  onLogTrial: (value: Record<string, unknown>) => Promise<void> | void;
  onUndo: () => Promise<void> | void;
};

export default function GoalTrialCard({
  goal,
  trials,
  onLogTrial,
  onUndo,
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
  const isCueing = format?.type === "cueing_hierarchy";
  const levels = isCueing ? (format?.config.levels ?? []) : [];

  const tally: Record<string, number> = {};
  for (const trial of trials) {
    const key = isCueing
      ? String(trial.value?.level ?? "")
      : trial.value?.correct
        ? "correct"
        : "incorrect";
    tally[key] = (tally[key] ?? 0) + 1;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          {goal.area && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {goal.area.name}
            </span>
          )}
          <p className="mt-2 text-sm font-medium text-slate-900">
            {goal.text}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-400">
          {trials.length} trial{trials.length === 1 ? "" : "s"}
        </span>
      </div>

      {isCueing ? (
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
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleLog({ correct: true })}
            disabled={logging}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg bg-green-100 px-2 py-3 text-center text-sm font-semibold text-green-800 transition-transform active:scale-95 disabled:opacity-50"
          >
            <span>Correct</span>
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
            <span>Incorrect</span>
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
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
        >
          Undo last
        </button>
      </div>
    </div>
  );
}
