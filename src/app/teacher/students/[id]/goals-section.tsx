"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Lightbulb, Plus, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  FutureGoalNote,
  MaterialChip,
  ResponseFormatOption,
  TeacherBankGoal,
  TeacherGoalTrack,
  TeacherGoalWithRelations,
  TeacherSubject,
  TeacherTrackTemplateWithSteps,
} from "@/lib/types";
import { GOAL_STATUS_CLASSES, GOAL_STATUS_LABELS } from "@/lib/goal-status";
import { fireCelebrationConfetti } from "@/lib/confetti";
import CelebrationToast from "@/components/celebration-toast";
import MaterialChips from "@/components/material-chips";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";
import BulkAssignTrackModal, {
  type BulkAssignBankGoal,
} from "@/components/bulk-assign-track-modal";
import SaveTrackAsTemplateModal from "@/components/save-track-as-template-modal";
import ApplyTrackTemplateModal, {
  type ApplyTemplateOption,
} from "@/components/apply-track-template-modal";
import TrackLadder from "@/components/track-ladder";
import TreatmentPlanProgress from "@/components/treatment-plan-progress";
import { resolveQueuePlacement } from "@/lib/goal-queue-placement";
import GoalFormModal, { type GoalFormValues } from "./goal-form-modal";
import DeleteGoalConfirmModal from "./delete-goal-confirm-modal";
import DeleteTrackConfirmModal from "./delete-track-confirm-modal";
import RenameTrackModal from "./rename-track-modal";

const GOAL_SELECT_COLUMNS =
  "id, student_id, subject_id, text, response_format_id, baseline, target_percent, status, visible_to_parent, track_id, step_order, created_at, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name), track:teacher_goal_tracks(id, name)";

type Props = {
  studentId: string;
  initialGoals: TeacherGoalWithRelations[];
  initialGoalsError: string | null;
  subjects: TeacherSubject[];
  responseFormats: ResponseFormatOption[];
  bankGoals: TeacherBankGoal[];
  initialGoalTracks: TeacherGoalTrack[];
  /** Her saved track templates (either origin — saved from a track, or
   *  built from scratch in the library), each with its steps in order,
   *  for the "Apply a track template" picker. */
  trackTemplates: TeacherTrackTemplateWithSteps[];
  /** Materials linked to each goal (via teacher_material_goals), keyed by
   *  goal id — shown as clickable chips right on the card. Missing
   *  entries render no chips. */
  materialsByGoalId: Record<string, MaterialChip[]>;
  /** This student's unresolved future-goal-idea notes, for the collapsed
   *  "Future goals" area below the goal list. */
  initialFutureGoalNotes: FutureGoalNote[];
};

export default function GoalsSection({
  studentId,
  initialGoals,
  initialGoalsError,
  subjects,
  responseFormats,
  bankGoals,
  initialGoalTracks,
  trackTemplates,
  materialsByGoalId,
  initialFutureGoalNotes,
}: Props) {
  const [goals, setGoals] = useState<TeacherGoalWithRelations[]>(initialGoals);
  const [goalTracks, setGoalTracks] = useState<TeacherGoalTrack[]>(initialGoalTracks);
  const [listError] = useState<string | null>(initialGoalsError);
  const [showAddModal, setShowAddModal] = useState(false);
  const [futureGoalNotes, setFutureGoalNotes] = useState<FutureGoalNote[]>(
    initialFutureGoalNotes
  );
  const [showFutureGoals, setShowFutureGoals] = useState(false);
  const [promotingNote, setPromotingNote] = useState<FutureGoalNote | null>(
    null
  );
  const [futureGoalError, setFutureGoalError] = useState<string | null>(null);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showApplyTemplateModal, setShowApplyTemplateModal] = useState(false);
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<TeacherGoalWithRelations | null>(
    null
  );
  const [deletingGoal, setDeletingGoal] = useState<TeacherGoalWithRelations | null>(
    null
  );
  const [visibilityErrorByGoalId, setVisibilityErrorByGoalId] = useState<
    Record<string, string>
  >({});
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("goals");

  function sortByNewest(list: TeacherGoalWithRelations[]) {
    return [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // Groups tracked goals into ladders (one per track, steps in order) and
  // splits out everything else — standalone goals keep rendering exactly
  // as a plain card, same as before this feature existed.
  const { tracks, standaloneGoals } = useMemo(() => {
    const byTrackId = new Map<
      string,
      { name: string; steps: TeacherGoalWithRelations[] }
    >();
    const standalone: TeacherGoalWithRelations[] = [];
    for (const goal of goals) {
      if (goal.track_id && goal.track) {
        const entry = byTrackId.get(goal.track_id) ?? { name: goal.track.name, steps: [] };
        entry.steps.push(goal);
        byTrackId.set(goal.track_id, entry);
      } else {
        standalone.push(goal);
      }
    }
    const trackList = Array.from(byTrackId.entries()).map(([trackId, { name, steps }]) => ({
      trackId,
      name,
      steps: [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0)),
    }));
    trackList.sort((a, b) => {
      const newest = (list: TeacherGoalWithRelations[]) =>
        Math.max(...list.map((g) => new Date(g.created_at).getTime()));
      return newest(b.steps) - newest(a.steps);
    });
    return { tracks: trackList, standaloneGoals: standalone };
  }, [goals]);

  const masteredCount = useMemo(
    () => goals.filter((g) => g.status === "mastered").length,
    [goals]
  );
  const totalCount = goals.length;

  // Celebrates the whole treatment plan crossing into 100% mastered —
  // separate from (and can layer with) the per-goal "mastered" celebration
  // below. The ref means this only fires on an actual transition, never
  // on first load of an already-complete plan.
  const wasCompleteRef = useRef<boolean | null>(null);
  useEffect(() => {
    const complete = totalCount > 0 && masteredCount === totalCount;
    if (wasCompleteRef.current === null) {
      wasCompleteRef.current = complete;
      return;
    }
    if (complete && !wasCompleteRef.current) {
      setCelebration("🎉 Treatment plan complete!");
      fireCelebrationConfetti();
    }
    wasCompleteRef.current = complete;
  }, [masteredCount, totalCount]);

  async function refetchGoal(id: string): Promise<TeacherGoalWithRelations | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from("teacher_goals")
      .select(GOAL_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    // Without generated Database types, postgrest-js can't infer that
    // subject/response_format are to-one relations and defaults to arrays;
    // at runtime they come back as single objects (or null), matching
    // TeacherGoalWithRelations.
    return data as unknown as TeacherGoalWithRelations | null;
  }

  // Mastering a track step can auto-advance a sibling step server-side
  // (0034_treatment_plan_tracks.sql's trigger) — refetching just the one
  // edited goal would miss that, so this pulls the whole list instead.
  async function refetchAllGoals(): Promise<TeacherGoalWithRelations[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from("teacher_goals")
      .select(GOAL_SELECT_COLUMNS)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as TeacherGoalWithRelations[];
  }

  const QUEUE_TABLES = {
    goalsTable: "teacher_goals" as const,
    tracksTable: "teacher_goal_tracks" as const,
    ownerColumn: "teacher_id" as const,
    categoryTable: "teacher_subjects" as const,
  };

  // Folds a resolveQueuePlacement() result's new track (if any) into
  // local state — same shape/spot handleBulkAssignDone already adds a
  // freshly-created track in, just triggered from the goal form instead.
  function addTrackIfNew(newTrack: { id: string; name: string } | null) {
    if (!newTrack) return;
    setGoalTracks((prev) => [
      {
        id: newTrack.id,
        name: newTrack.name,
        student_id: studentId,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  async function handleAdd(values: GoalFormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    let trackId: string | null = null;
    let stepOrder: number | null = null;
    if (values.queueBehind) {
      const placement = await resolveQueuePlacement(
        supabase,
        QUEUE_TABLES,
        user.id,
        studentId,
        values.queueBehind
      );
      if (!placement.ok) return placement.error;
      trackId = placement.trackId;
      stepOrder = placement.stepOrder;
      addTrackIfNew(placement.newTrack);
    }

    const { data, error } = await supabase
      .from("teacher_goals")
      .insert({
        teacher_id: user.id,
        student_id: studentId,
        subject_id: values.subjectId,
        text: values.text,
        response_format_id: values.responseFormatId,
        baseline: values.baseline || null,
        target_percent: values.targetPercent,
        status: values.status,
        source_bank_goal_id: values.sourceBankGoalId,
        track_id: trackId,
        step_order: stepOrder,
      })
      .select("id")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    // A queue-behind placement can touch OTHER existing goals too (steps
    // shifted down to make room, or an anchor goal migrated into a
    // brand-new track) — refetch the whole list rather than just the one
    // goal just created, same as the mastery-advance refetch below.
    if (values.queueBehind) {
      setGoals(await refetchAllGoals());
    } else {
      const fullGoal = await refetchGoal(data.id);
      if (fullGoal) {
        setGoals((prev) => sortByNewest([...prev, fullGoal]));
      }
    }
    setShowAddModal(false);
    return null;
  }

  // Reuses handleAdd's exact insert logic (including queue placement),
  // then also resolves the future-goal note it was promoted from — but
  // only once the goal insert itself actually succeeds.
  async function handlePromoteFutureGoal(values: GoalFormValues) {
    const result = await handleAdd(values);
    if (result) return result;

    if (promotingNote) {
      const supabase = createClient();
      await supabase
        .from("teacher_future_goal_notes")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", promotingNote.id);
      setFutureGoalNotes((prev) =>
        prev.filter((n) => n.id !== promotingNote.id)
      );
    }
    setPromotingNote(null);
    return null;
  }

  async function handleDeleteFutureGoal(id: string) {
    setFutureGoalError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_future_goal_notes")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setFutureGoalError(error.message);
      return;
    }
    setFutureGoalNotes((prev) => prev.filter((n) => n.id !== id));
  }

  async function handleEdit(values: GoalFormValues) {
    if (!editingGoal) return null;

    // Captured before the update so the celebration only fires on an actual
    // transition into "mastered" — re-saving an already-mastered goal (or
    // any other edit) shouldn't retrigger it. mastered_at follows the same
    // transition: set on the way in, cleared on the way back out, so the
    // dashboard's "goals mastered in the last 30 days" stat only ever
    // reflects goals still actually sitting at "mastered".
    const wasMastered = editingGoal.status === "mastered";
    const isNowMastered = values.status === "mastered";
    const justMastered = isNowMastered && !wasMastered;
    const justUnmastered = wasMastered && !isNowMastered;

    const supabase = createClient();

    let trackFields: { track_id: string; step_order: number } | null = null;
    if (values.queueBehind) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return "You need to be signed in.";
      const placement = await resolveQueuePlacement(
        supabase,
        QUEUE_TABLES,
        user.id,
        studentId,
        values.queueBehind
      );
      if (!placement.ok) return placement.error;
      trackFields = { track_id: placement.trackId, step_order: placement.stepOrder };
      addTrackIfNew(placement.newTrack);
    }

    const { error } = await supabase
      .from("teacher_goals")
      .update({
        subject_id: values.subjectId,
        text: values.text,
        response_format_id: values.responseFormatId,
        baseline: values.baseline || null,
        target_percent: values.targetPercent,
        status: values.status,
        ...(trackFields ?? {}),
        ...(justMastered ? { mastered_at: new Date().toISOString() } : {}),
        ...(justUnmastered ? { mastered_at: null } : {}),
      })
      .eq("id", editingGoal.id);

    if (error) {
      return error.message;
    }

    // A track step's mastery can auto-activate its next step in the same
    // update (see the DB trigger), and a queue-behind placement can shift
    // sibling steps or migrate another goal into a brand-new track —
    // either way, refetch the whole list so goals other than the one just
    // edited pick up their changes too.
    if ((justMastered && editingGoal.track_id) || values.queueBehind) {
      setGoals(await refetchAllGoals());
    } else {
      const fullGoal = await refetchGoal(editingGoal.id);
      if (fullGoal) {
        setGoals((prev) =>
          prev.map((g) => (g.id === fullGoal.id ? fullGoal : g))
        );
      }
    }
    setEditingGoal(null);

    if (justMastered) {
      setCelebration("🎉 Goal mastered!");
      fireCelebrationConfetti();
    }

    return null;
  }

  function handleStepClick(stepId: string) {
    const goal = goals.find((g) => g.id === stepId);
    if (goal) setEditingGoal(goal);
  }

  function handleLadderReorder(stepId: string, direction: "up" | "down") {
    const goal = goals.find((g) => g.id === stepId);
    if (goal) handleReorderStep(goal, direction);
  }

  // Swaps step_order between two adjacent steps in the same track. Doesn't
  // touch status at all, so it can never retroactively re-trigger the
  // mastery-advance trigger (that only fires on a transition into
  // 'mastered') — reordering only affects which step gets auto-activated
  // *next*, per requirement 6.
  async function handleReorderStep(
    goal: TeacherGoalWithRelations,
    direction: "up" | "down"
  ) {
    if (!goal.track_id || goal.step_order === null) return;

    const siblings = goals
      .filter((g) => g.track_id === goal.track_id)
      .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
    const idx = siblings.findIndex((g) => g.id === goal.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const other = siblings[swapIdx];
    const goalStep = goal.step_order;
    const otherStep = other.step_order;
    if (otherStep === null) return;

    setReorderError(null);
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id === goal.id) return { ...g, step_order: otherStep };
        if (g.id === other.id) return { ...g, step_order: goalStep };
        return g;
      })
    );

    const supabase = createClient();
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("teacher_goals").update({ step_order: otherStep }).eq("id", goal.id),
      supabase.from("teacher_goals").update({ step_order: goalStep }).eq("id", other.id),
    ]);

    if (e1 || e2) {
      setGoals((prev) =>
        prev.map((g) => {
          if (g.id === goal.id) return { ...g, step_order: goalStep };
          if (g.id === other.id) return { ...g, step_order: otherStep };
          return g;
        })
      );
      setReorderError((e1 ?? e2)?.message ?? "Couldn't reorder that step.");
    }
  }

  function handleBulkAssignDone({
    insertedGoals,
    newTrack,
  }: {
    insertedGoals: Record<string, unknown>[];
    newTrack: { id: string; name: string } | null;
  }) {
    setGoals((prev) =>
      sortByNewest([...prev, ...(insertedGoals as unknown as TeacherGoalWithRelations[])])
    );
    if (newTrack) {
      setGoalTracks((prev) => [
        { id: newTrack.id, name: newTrack.name, student_id: studentId, created_at: new Date().toISOString() },
        ...prev,
      ]);
    }
    setShowBulkAssignModal(false);
  }

  // Applying a template creates a new track the same way bulk-assign's
  // "create a new track" path does, so the result folds into state the
  // same way.
  function handleApplyTemplateDone(result: {
    insertedGoals: Record<string, unknown>[];
    newTrack: { id: string; name: string } | null;
  }) {
    handleBulkAssignDone(result);
    setShowApplyTemplateModal(false);
  }

  async function handleDelete() {
    if (!deletingGoal) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_goals")
      .delete()
      .eq("id", deletingGoal.id);

    if (error) {
      return error.message;
    }

    setGoals((prev) => prev.filter((g) => g.id !== deletingGoal.id));
    setDeletingGoal(null);
    return null;
  }

  // Deletes the track AND every one of its step goals — not just the
  // grouping, which would otherwise leave orphaned goals with a track_id
  // pointing at nothing (teacher_goals.track_id is "on delete set null",
  // so deleting the track row first would even fail outright: it'd null
  // out track_id on those goals while step_order stayed set, violating
  // teacher_goals_track_step_pairing_check). Goals are deleted first, then
  // the now-empty track row. Never touches
  // teacher_track_templates/teacher_track_template_steps — a track has no
  // reference back to whatever template it was saved as or applied from,
  // so this can't affect one either way.
  async function handleDeleteTrack() {
    if (!deletingTrackId) return null;

    const supabase = createClient();
    const { error: goalsError } = await supabase
      .from("teacher_goals")
      .delete()
      .eq("track_id", deletingTrackId);

    if (goalsError) {
      return goalsError.message;
    }

    const { error: trackError } = await supabase
      .from("teacher_goal_tracks")
      .delete()
      .eq("id", deletingTrackId);

    if (trackError) {
      return trackError.message;
    }

    setGoals((prev) => prev.filter((g) => g.track_id !== deletingTrackId));
    setGoalTracks((prev) => prev.filter((t) => t.id !== deletingTrackId));
    setDeletingTrackId(null);
    return null;
  }

  // Works for any track — not just the ones auto-created by the "queued
  // behind a single goal" flow, whose default name is what made renaming
  // worth adding in the first place. The name lives in two places in
  // local state: each step goal's own joined `track.name` (what the
  // ladder heading actually reads from) and the separate goalTracks list
  // (what BulkAssignTrackModal's "Add to <existing track>" picker reads
  // from) — both need updating or one of the two would keep showing the
  // old name until a reload.
  async function handleRenameTrack(newName: string) {
    if (!renamingTrackId) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_goal_tracks")
      .update({ name: newName })
      .eq("id", renamingTrackId);

    if (error) {
      return error.message;
    }

    setGoals((prev) =>
      prev.map((g) =>
        g.track_id === renamingTrackId && g.track
          ? { ...g, track: { ...g.track, name: newName } }
          : g
      )
    );
    setGoalTracks((prev) =>
      prev.map((t) => (t.id === renamingTrackId ? { ...t, name: newName } : t))
    );
    setRenamingTrackId(null);
    return null;
  }

  // Optimistic — flips the checkbox immediately, then persists in the
  // background and rolls back with an inline error if the save fails.
  async function handleToggleVisibleToParent(goal: TeacherGoalWithRelations) {
    const nextValue = !goal.visible_to_parent;
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id ? { ...g, visible_to_parent: nextValue } : g
      )
    );
    setVisibilityErrorByGoalId((prev) => ({ ...prev, [goal.id]: "" }));

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_goals")
      .update({ visible_to_parent: nextValue })
      .eq("id", goal.id);

    if (error) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goal.id ? { ...g, visible_to_parent: goal.visible_to_parent } : g
        )
      );
      setVisibilityErrorByGoalId((prev) => ({
        ...prev,
        [goal.id]: error.message,
      }));
    }
  }

  return (
    <div data-tour="student-goals-section">
      <SectionHeader
        icon={Target}
        title="Goals"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowApplyTemplateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
            >
              Apply a track template
            </button>
            <button
              onClick={() => setShowBulkAssignModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
            >
              Assign from bank
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
            >
              <Plus className="h-4 w-4" />
              Set a goal
            </button>
          </div>
        }
      />

      {!collapsed && (
        <>
          {listError && (
            <p className="mt-4 text-sm text-red-600">
              Couldn&apos;t load goals: {listError}
            </p>
          )}

          {reorderError && (
            <p className="mt-4 text-sm text-red-600">{reorderError}</p>
          )}

          {!listError && goals.length === 0 && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <Target className="h-6 w-6 text-brand-500" />
              </div>
              <p className="text-stone-500">
                No goals yet — set one to start tracking progress.
              </p>
            </div>
          )}

          {goals.length > 0 && (
            <div className="mt-4">
              <TreatmentPlanProgress masteredCount={masteredCount} totalCount={totalCount} />

              {tracks.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {tracks.map((track) => (
                    <TrackLadder
                      key={track.trackId}
                      trackId={track.trackId}
                      trackName={track.name}
                      steps={track.steps.map((g) => ({
                        id: g.id,
                        text: g.text,
                        status: g.status,
                        step_order: g.step_order ?? 0,
                      }))}
                      onStepClick={handleStepClick}
                      onReorder={handleLadderReorder}
                      onRenameTrack={() => setRenamingTrackId(track.trackId)}
                      onSaveAsTemplate={() => setSavingTrackId(track.trackId)}
                      onDeleteTrack={() => setDeletingTrackId(track.trackId)}
                    />
                  ))}
                </div>
              )}

              {standaloneGoals.length > 0 && (
                <div className={`grid gap-3 sm:grid-cols-2 ${tracks.length > 0 ? "mt-3" : ""}`}>
                  {standaloneGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                          {goal.subject?.name ?? "Uncategorized"}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${GOAL_STATUS_CLASSES[goal.status]}`}
                        >
                          {GOAL_STATUS_LABELS[goal.status]}
                        </span>
                      </div>

                      <p className="mt-3 flex-1 text-sm text-stone-900">
                        {goal.text}
                      </p>

                      <p className="mt-2 text-sm text-stone-500">
                        {goal.target_percent !== null
                          ? `Target: ${goal.target_percent}%`
                          : "No target set"}
                      </p>

                      <MaterialChips materials={materialsByGoalId[goal.id] ?? []} />

                      <label className="mt-3 flex items-center gap-2 text-xs font-medium text-stone-500">
                        <input
                          type="checkbox"
                          checked={goal.visible_to_parent}
                          onChange={() => handleToggleVisibleToParent(goal)}
                          className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                        />
                        Show progress to parent
                      </label>
                      {visibilityErrorByGoalId[goal.id] && (
                        <p className="mt-1 text-xs text-red-600">
                          {visibilityErrorByGoalId[goal.id]}
                        </p>
                      )}

                      <div className="mt-3 flex justify-end gap-1">
                        <button
                          onClick={() => setEditingGoal(goal)}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingGoal(goal)}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white">
            <button
              type="button"
              onClick={() => setShowFutureGoals((v) => !v)}
              aria-expanded={showFutureGoals}
              className="flex w-full items-center justify-between gap-2 px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-stone-700">
                {showFutureGoals ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
                )}
                <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
                Future goals
              </span>
              {futureGoalNotes.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                  {futureGoalNotes.length}
                </span>
              )}
            </button>

            {showFutureGoals && (
              <div className="space-y-2 px-4 pb-4">
                {futureGoalError && (
                  <p className="text-sm text-red-600">{futureGoalError}</p>
                )}
                {futureGoalNotes.length === 0 ? (
                  <p className="text-sm text-stone-500">
                    No future goal ideas yet — jot one down from a session.
                  </p>
                ) : (
                  futureGoalNotes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
                    >
                      <span className="flex-1 text-sm text-stone-700">
                        {note.text}
                      </span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => setPromotingNote(note)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
                        >
                          Promote to goal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFutureGoal(note.id)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {promotingNote && (
        <GoalFormModal
          mode="add"
          subjects={subjects}
          responseFormats={responseFormats}
          bankGoals={bankGoals}
          studentGoals={goals}
          studentTracks={tracks}
          initialText={promotingNote.text}
          onCancel={() => setPromotingNote(null)}
          onSubmit={handlePromoteFutureGoal}
        />
      )}

      {showAddModal && (
        <GoalFormModal
          mode="add"
          subjects={subjects}
          responseFormats={responseFormats}
          bankGoals={bankGoals}
          studentGoals={goals}
          studentTracks={tracks}
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingGoal && (
        <GoalFormModal
          mode="edit"
          subjects={subjects}
          responseFormats={responseFormats}
          bankGoals={bankGoals}
          studentGoals={goals}
          studentTracks={tracks}
          initialGoal={editingGoal}
          onCancel={() => setEditingGoal(null)}
          onSubmit={handleEdit}
        />
      )}

      {deletingGoal && (
        <DeleteGoalConfirmModal
          goal={deletingGoal}
          onCancel={() => setDeletingGoal(null)}
          onConfirm={handleDelete}
        />
      )}

      {showBulkAssignModal && (
        <BulkAssignTrackModal
          studentId={studentId}
          categoryLabel="Subject"
          categories={subjects}
          bankGoals={bankGoals.map(
            (g): BulkAssignBankGoal => ({
              id: g.id,
              categoryId: g.subject_id,
              text: g.text,
              response_format_id: g.response_format_id,
              target_percent: g.target_percent,
            })
          )}
          existingTracks={goalTracks}
          goalsTable="teacher_goals"
          tracksTable="teacher_goal_tracks"
          categoryTable="teacher_subjects"
          responseFormatTable="teacher_response_formats"
          categoryIdColumn="subject_id"
          ownerColumn="teacher_id"
          onCancel={() => setShowBulkAssignModal(false)}
          onDone={handleBulkAssignDone}
        />
      )}

      {showApplyTemplateModal && (
        <ApplyTrackTemplateModal
          studentId={studentId}
          templates={trackTemplates.map(
            (t): ApplyTemplateOption => ({
              id: t.id,
              name: t.name,
              categoryId: t.subject_id,
              steps: t.steps.map((s) => ({
                id: s.id,
                order_index: s.order_index,
                goal_text: s.goal_text,
                response_format_id: s.response_format_id,
                target_percent: s.target_percent,
              })),
            })
          )}
          responseFormats={responseFormats}
          goalsTable="teacher_goals"
          tracksTable="teacher_goal_tracks"
          categoryTable="teacher_subjects"
          responseFormatTable="teacher_response_formats"
          categoryIdColumn="subject_id"
          ownerColumn="teacher_id"
          onCancel={() => setShowApplyTemplateModal(false)}
          onDone={handleApplyTemplateDone}
        />
      )}

      {savingTrackId && (() => {
        const track = tracks.find((t) => t.trackId === savingTrackId);
        if (!track) return null;
        return (
          <SaveTrackAsTemplateModal
            trackName={track.name}
            steps={track.steps.map((g) => ({
              text: g.text,
              response_format_id: g.response_format_id,
              target_percent: g.target_percent,
            }))}
            categoryLabel="Subject"
            categories={subjects}
            defaultCategoryId={track.steps[0]?.subject_id ?? ""}
            templatesTable="teacher_track_templates"
            templateStepsTable="teacher_track_template_steps"
            categoryIdColumn="subject_id"
            ownerColumn="teacher_id"
            onCancel={() => setSavingTrackId(null)}
            onDone={() => {
              setSavingTrackId(null);
              setCelebration("🎉 Template saved!");
            }}
          />
        );
      })()}

      {deletingTrackId && (() => {
        const track = tracks.find((t) => t.trackId === deletingTrackId);
        if (!track) return null;
        return (
          <DeleteTrackConfirmModal
            trackName={track.name}
            stepCount={track.steps.length}
            onCancel={() => setDeletingTrackId(null)}
            onConfirm={handleDeleteTrack}
          />
        );
      })()}

      {renamingTrackId && (() => {
        const track = tracks.find((t) => t.trackId === renamingTrackId);
        if (!track) return null;
        return (
          <RenameTrackModal
            initialName={track.name}
            onCancel={() => setRenamingTrackId(null)}
            onConfirm={handleRenameTrack}
          />
        );
      })()}

      {celebration && (
        <CelebrationToast
          message={celebration}
          onDone={() => setCelebration(null)}
        />
      )}
    </div>
  );
}
