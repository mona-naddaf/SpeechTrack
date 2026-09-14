import type { createClient } from "@/lib/supabase/client";

type SupabaseClient = ReturnType<typeof createClient>;

/** What she picked in the goal form's "Queued behind…" picker (see
 *  QueueBehindPicker) — resolved by resolveQueuePlacement() below into a
 *  concrete track_id/step_order for the goal being saved. Both cases end
 *  up on the exact same two columns 0034_treatment_plan_tracks.sql
 *  already added, so the existing mastery-advance trigger drives either
 *  one identically — no separate "single goal dependency" system. */
export type QueueBehindChoice =
  | {
      type: "track";
      trackId: string;
      /** The step to insert immediately after — always one of that
       *  track's own current steps (never "before everything"), so a
       *  freshly-queued goal never jumps ahead of work already underway. */
      afterGoalId: string;
    }
  | {
      /** A lighter-weight dependency on one specific other goal, active
       *  or mastered — no track name to make up, no multi-step sequence
       *  to plan. Resolved below into the very same track machinery: if
       *  that goal is already a track step, this just extends its track;
       *  if it's standalone, a plain 2-step track is created behind the
       *  scenes to hold the two of them. */
      type: "goal";
      goalId: string;
    };

type QueueTables = {
  goalsTable: "goals" | "teacher_goals";
  tracksTable: "goal_tracks" | "teacher_goal_tracks";
  ownerColumn: "slp_id" | "teacher_id";
};

export type QueuePlacementResult =
  | {
      ok: true;
      trackId: string;
      stepOrder: number;
      /** Set only when resolving this choice created a brand-new track
       *  behind the scenes (a "behind a single goal" pick whose target
       *  wasn't already part of one) — the caller folds it into its track
       *  list the same way a bulk-assigned/template-applied track is. */
      newTrack: { id: string; name: string } | null;
    }
  | { ok: false; error: string };

const AUTO_TRACK_NAME_MAX = 60;

/** Names a track created behind the scenes for the "behind a single
 *  goal" case, from the existing goal's own text — she never has to make
 *  up a track name for what's meant to be a lightweight, implicit
 *  dependency. */
function autoTrackName(goalText: string): string {
  const trimmed = goalText.trim();
  return trimmed.length > AUTO_TRACK_NAME_MAX
    ? `${trimmed.slice(0, AUTO_TRACK_NAME_MAX - 1)}…`
    : trimmed;
}

/** Shifts every step after `afterStepOrder` in `trackId` down by one to
 *  make room (a no-op when inserting after the current last step), then
 *  returns the step_order the new step should take. Done as individual
 *  per-row updates — same idiom goals-section.tsx's own step-reorder
 *  already uses — rather than a single "step_order + 1" update, since
 *  postgrest can't express an update relative to a row's own existing
 *  value. Tracks are always small, so this stays cheap. */
async function makeRoomAfter(
  supabase: SupabaseClient,
  goalsTable: QueueTables["goalsTable"],
  trackId: string,
  afterStepOrder: number
): Promise<{ error: string | null; stepOrder: number }> {
  const { data: laterSteps, error: fetchError } = await (
    supabase.from(goalsTable) as any
  )
    .select("id, step_order")
    .eq("track_id", trackId)
    .gt("step_order", afterStepOrder)
    .order("step_order", { ascending: false });

  if (fetchError) {
    return { error: fetchError.message, stepOrder: afterStepOrder + 1 };
  }

  if (laterSteps && laterSteps.length > 0) {
    const results = await Promise.all(
      (laterSteps as { id: string; step_order: number }[]).map((s) =>
        (supabase.from(goalsTable) as any)
          .update({ step_order: s.step_order + 1 })
          .eq("id", s.id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return { error: failed.error.message, stepOrder: afterStepOrder + 1 };
    }
  }

  return { error: null, stepOrder: afterStepOrder + 1 };
}

/** Turns a QueueBehindChoice into a concrete track_id/step_order for the
 *  goal being saved, performing whatever side-effect writes are needed
 *  first:
 *   - "track": makes room at the chosen position in that existing track.
 *   - "goal", target already tracked: makes room right after that step,
 *     in its SAME track — extends it rather than building a confusing
 *     separate mini-track alongside it.
 *   - "goal", target standalone: creates a brand-new 2-step track and
 *     migrates the target goal into it as step 1 (its status is left
 *     exactly as-is), so the new goal becomes step 2. From here on the
 *     existing mastery-advance trigger drives it exactly like any other
 *     track.
 *  Callers should refetch the student's full goal list afterward — this
 *  can touch other existing goals (shifted siblings, a migrated anchor),
 *  not just the one being saved. */
export async function resolveQueuePlacement(
  supabase: SupabaseClient,
  tables: QueueTables,
  ownerId: string,
  studentId: string,
  choice: QueueBehindChoice
): Promise<QueuePlacementResult> {
  const { goalsTable, tracksTable, ownerColumn } = tables;

  if (choice.type === "track") {
    const { data: anchor, error: anchorError } = await (
      supabase.from(goalsTable) as any
    )
      .select("id, step_order")
      .eq("id", choice.afterGoalId)
      .eq("track_id", choice.trackId)
      .maybeSingle();

    if (anchorError || !anchor || anchor.step_order === null) {
      return {
        ok: false,
        error: anchorError?.message ?? "Couldn't find that step.",
      };
    }

    const { error, stepOrder } = await makeRoomAfter(
      supabase,
      goalsTable,
      choice.trackId,
      anchor.step_order
    );
    if (error) return { ok: false, error };
    return { ok: true, trackId: choice.trackId, stepOrder, newTrack: null };
  }

  const { data: anchor, error: anchorError } = await (
    supabase.from(goalsTable) as any
  )
    .select("id, text, track_id, step_order")
    .eq("id", choice.goalId)
    .maybeSingle();

  if (anchorError || !anchor) {
    return {
      ok: false,
      error: anchorError?.message ?? "Couldn't find that goal.",
    };
  }

  if (anchor.track_id !== null && anchor.step_order !== null) {
    const { error, stepOrder } = await makeRoomAfter(
      supabase,
      goalsTable,
      anchor.track_id,
      anchor.step_order
    );
    if (error) return { ok: false, error };
    return { ok: true, trackId: anchor.track_id, stepOrder, newTrack: null };
  }

  const { data: track, error: trackError } = await (
    supabase.from(tracksTable) as any
  )
    .insert({
      [ownerColumn]: ownerId,
      student_id: studentId,
      name: autoTrackName(anchor.text),
    })
    .select("id, name")
    .single();

  if (trackError || !track) {
    return {
      ok: false,
      error: trackError?.message ?? "Couldn't create the track.",
    };
  }

  const { error: migrateError } = await (supabase.from(goalsTable) as any)
    .update({ track_id: track.id, step_order: 1 })
    .eq("id", anchor.id);

  if (migrateError) {
    return { ok: false, error: migrateError.message };
  }

  return {
    ok: true,
    trackId: track.id as string,
    stepOrder: 2,
    newTrack: { id: track.id as string, name: track.name as string },
  };
}
