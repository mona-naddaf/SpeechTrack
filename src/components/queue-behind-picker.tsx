"use client";

import type { QueueBehindChoice } from "@/lib/goal-queue-placement";

export type QueueBehindTrackOption = {
  id: string;
  name: string;
  /** In step_order. */
  steps: { id: string; text: string }[];
};

export type QueueBehindGoalOption = {
  id: string;
  text: string;
  categoryName: string;
  /** Set when this goal already belongs to a track — picking it then
   *  extends that same track (see resolveQueuePlacement) instead of
   *  building a separate, confusing mini-track next to it. Shown so she
   *  can see that up front rather than being surprised by it. */
  trackName: string | null;
};

/** The two selects' current picks, kept lifted in the goal form (same
 *  fully-controlled pattern every other field there already uses) rather
 *  than owned here — so nothing needs an effect to "report" a change.
 *  Only the fields for whichever `mode` is active actually get used when
 *  resolving a submission; the other pair is just left stale. */
export type QueueBehindDraft = {
  mode: "track" | "goal";
  trackId: string;
  afterGoalId: string;
  goalId: string;
};

type Props = {
  tracks: QueueBehindTrackOption[];
  goals: QueueBehindGoalOption[];
  draft: QueueBehindDraft;
  onChange: (patch: Partial<QueueBehindDraft>) => void;
};

/** Turns a QueueBehindDraft into the QueueBehindChoice resolveQueuePlacement
 *  actually needs, or null if the current pick is incomplete (nothing
 *  selected in an empty list) — used by the goal form to validate on
 *  submit without duplicating this branching there. */
export function draftToChoice(draft: QueueBehindDraft): QueueBehindChoice | null {
  if (draft.mode === "track") {
    return draft.trackId && draft.afterGoalId
      ? { type: "track", trackId: draft.trackId, afterGoalId: draft.afterGoalId }
      : null;
  }
  return draft.goalId ? { type: "goal", goalId: draft.goalId } : null;
}

/** Shown inline in the goal form whenever she sets a not-yet-tracked
 *  goal's status to "Queued" — lets her say what it's queued behind
 *  instead of leaving it permanently stuck (before this, a standalone
 *  goal set to "Queued" had no track_id at all, so the mastery-advance
 *  trigger had nothing to ever activate it with). Both paths end up on
 *  the same track_id/step_order columns — see goal-queue-placement.ts. */
export default function QueueBehindPicker({ tracks, goals, draft, onChange }: Props) {
  const selectedTrack = tracks.find((t) => t.id === draft.trackId) ?? null;
  const selectedGoal = goals.find((g) => g.id === draft.goalId) ?? null;

  if (tracks.length === 0 && goals.length === 0) {
    return (
      <p className="mt-2 rounded-lg bg-cream-50 p-3 text-sm text-stone-600">
        This student doesn&apos;t have another goal or track yet to queue
        this behind — pick a different status for now, or come back to
        this once she does.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-stone-200 p-3">
      <p className="text-sm font-medium text-stone-700">Queued behind…</p>
      <div className="flex gap-4 text-sm text-stone-600">
        <label
          className={`flex items-center gap-1.5 ${tracks.length === 0 ? "opacity-40" : ""}`}
        >
          <input
            type="radio"
            name="queue-behind-mode"
            checked={draft.mode === "track"}
            disabled={tracks.length === 0}
            onChange={() => onChange({ mode: "track" })}
          />
          A track
        </label>
        <label
          className={`flex items-center gap-1.5 ${goals.length === 0 ? "opacity-40" : ""}`}
        >
          <input
            type="radio"
            name="queue-behind-mode"
            checked={draft.mode === "goal"}
            disabled={goals.length === 0}
            onChange={() => onChange({ mode: "goal" })}
          />
          A single goal
        </label>
      </div>

      {draft.mode === "track" && selectedTrack && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-medium text-stone-500">
            Track
            <select
              value={draft.trackId}
              onChange={(e) => onChange({ trackId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-stone-500">
            Position
            <select
              value={draft.afterGoalId}
              onChange={(e) => onChange({ afterGoalId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {selectedTrack.steps.map((s, i) => (
                <option key={s.id} value={s.id}>
                  After step {i + 1}: {s.text}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {draft.mode === "goal" && (
        <div>
          <label className="block text-xs font-medium text-stone-500">
            Goal
            <select
              value={draft.goalId}
              onChange={(e) => onChange({ goalId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.text} ({g.categoryName})
                </option>
              ))}
            </select>
          </label>
          {selectedGoal && (
            <p className="mt-1.5 text-xs text-stone-500">
              {selectedGoal.trackName
                ? `Extends the "${selectedGoal.trackName}" track — this becomes the step right after it.`
                : `Activates automatically once "${selectedGoal.text}" is mastered.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
