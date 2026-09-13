"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  Area,
  BankGoal,
  GoalTrack,
  GoalWithRelations,
  MaterialChip,
  ResponseFormatOption,
  TrackTemplateWithSteps,
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
import GoalFormModal, { type GoalFormValues } from "./goal-form-modal";
import DeleteGoalConfirmModal from "./delete-goal-confirm-modal";

const GOAL_SELECT_COLUMNS =
  "id, student_id, area_id, text, response_format_id, baseline, target_percent, status, visible_to_parent, track_id, step_order, created_at, area:areas(id, name), response_format:response_formats(id, name), track:goal_tracks(id, name)";

type Props = {
  studentId: string;
  initialGoals: GoalWithRelations[];
  initialGoalsError: string | null;
  areas: Area[];
  responseFormats: ResponseFormatOption[];
  bankGoals: BankGoal[];
  initialGoalTracks: GoalTrack[];
  /** Her saved track templates (either origin — saved from a track, or
   *  built from scratch in the library), each with its steps in order,
   *  for the "Apply a track template" picker. */
  trackTemplates: TrackTemplateWithSteps[];
  /** Materials linked to each goal (via material_goals), keyed by goal id —
   *  shown as clickable chips right on the card. Missing entries render
   *  no chips. */
  materialsByGoalId: Record<string, MaterialChip[]>;
};

export default function GoalsSection({
  studentId,
  initialGoals,
  initialGoalsError,
  areas,
  responseFormats,
  bankGoals,
  initialGoalTracks,
  trackTemplates,
  materialsByGoalId,
}: Props) {
  const [goals, setGoals] = useState<GoalWithRelations[]>(initialGoals);
  const [goalTracks, setGoalTracks] = useState<GoalTrack[]>(initialGoalTracks);
  const [listError] = useState<string | null>(initialGoalsError);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showApplyTemplateModal, setShowApplyTemplateModal] = useState(false);
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<GoalWithRelations | null>(
    null
  );
  const [deletingGoal, setDeletingGoal] = useState<GoalWithRelations | null>(
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

  function sortByNewest(list: GoalWithRelations[]) {
    return [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // Groups tracked goals into ladders (one per track, steps in order) and
  // splits out everything else — standalone goals keep rendering exactly
  // as a plain card, same as before this feature existed.
  const { tracks, standaloneGoals } = useMemo(() => {
    const byTrackId = new Map<string, { name: string; steps: GoalWithRelations[] }>();
    const standalone: GoalWithRelations[] = [];
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
      const newest = (list: GoalWithRelations[]) =>
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

  async function refetchGoal(id: string): Promise<GoalWithRelations | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from("goals")
      .select(GOAL_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    // Without generated Database types, postgrest-js can't infer that
    // area/response_format are to-one relations and defaults to arrays;
    // at runtime they come back as single objects (or null), matching
    // GoalWithRelations.
    return data as unknown as GoalWithRelations | null;
  }

  // Mastering a track step can auto-advance a sibling step server-side
  // (0034_treatment_plan_tracks.sql's trigger) — refetching just the one
  // edited goal would miss that, so this pulls the whole list instead.
  async function refetchAllGoals(): Promise<GoalWithRelations[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from("goals")
      .select(GOAL_SELECT_COLUMNS)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as GoalWithRelations[];
  }

  async function handleAdd(values: GoalFormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { data, error } = await supabase
      .from("goals")
      .insert({
        slp_id: user.id,
        student_id: studentId,
        area_id: values.areaId,
        text: values.text,
        response_format_id: values.responseFormatId,
        baseline: values.baseline || null,
        target_percent: values.targetPercent,
        status: values.status,
        source_bank_goal_id: values.sourceBankGoalId,
      })
      .select("id")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    const fullGoal = await refetchGoal(data.id);
    if (fullGoal) {
      setGoals((prev) => sortByNewest([...prev, fullGoal]));
    }
    setShowAddModal(false);
    return null;
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
    const { error } = await supabase
      .from("goals")
      .update({
        area_id: values.areaId,
        text: values.text,
        response_format_id: values.responseFormatId,
        baseline: values.baseline || null,
        target_percent: values.targetPercent,
        status: values.status,
        ...(justMastered ? { mastered_at: new Date().toISOString() } : {}),
        ...(justUnmastered ? { mastered_at: null } : {}),
      })
      .eq("id", editingGoal.id);

    if (error) {
      return error.message;
    }

    // A track step's mastery can auto-activate its next step in the same
    // update (see the DB trigger) — refetch the whole list so that sibling
    // shows up too, not just the goal that was actually edited here.
    if (justMastered && editingGoal.track_id) {
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
  async function handleReorderStep(goal: GoalWithRelations, direction: "up" | "down") {
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
      supabase.from("goals").update({ step_order: otherStep }).eq("id", goal.id),
      supabase.from("goals").update({ step_order: goalStep }).eq("id", other.id),
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
      sortByNewest([...prev, ...(insertedGoals as unknown as GoalWithRelations[])])
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
      .from("goals")
      .delete()
      .eq("id", deletingGoal.id);

    if (error) {
      return error.message;
    }

    setGoals((prev) => prev.filter((g) => g.id !== deletingGoal.id));
    setDeletingGoal(null);
    return null;
  }

  // Optimistic — flips the checkbox immediately, then persists in the
  // background and rolls back with an inline error if the save fails.
  async function handleToggleVisibleToParent(goal: GoalWithRelations) {
    const nextValue = !goal.visible_to_parent;
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id ? { ...g, visible_to_parent: nextValue } : g
      )
    );
    setVisibilityErrorByGoalId((prev) => ({ ...prev, [goal.id]: "" }));

    const supabase = createClient();
    const { error } = await supabase
      .from("goals")
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
                      trackName={track.name}
                      steps={track.steps.map((g) => ({
                        id: g.id,
                        text: g.text,
                        status: g.status,
                        step_order: g.step_order ?? 0,
                      }))}
                      onStepClick={handleStepClick}
                      onReorder={handleLadderReorder}
                      onSaveAsTemplate={() => setSavingTrackId(track.trackId)}
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
                          {goal.area?.name ?? "Uncategorized"}
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
        </>
      )}

      {showAddModal && (
        <GoalFormModal
          mode="add"
          areas={areas}
          responseFormats={responseFormats}
          bankGoals={bankGoals}
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingGoal && (
        <GoalFormModal
          mode="edit"
          areas={areas}
          responseFormats={responseFormats}
          bankGoals={bankGoals}
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
          categoryLabel="Area"
          categories={areas}
          bankGoals={bankGoals.map(
            (g): BulkAssignBankGoal => ({
              id: g.id,
              categoryId: g.area_id,
              text: g.text,
              response_format_id: g.response_format_id,
              target_percent: g.target_percent,
            })
          )}
          existingTracks={goalTracks}
          goalsTable="goals"
          tracksTable="goal_tracks"
          categoryTable="areas"
          responseFormatTable="response_formats"
          categoryIdColumn="area_id"
          ownerColumn="slp_id"
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
              categoryId: t.area_id,
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
          goalsTable="goals"
          tracksTable="goal_tracks"
          categoryTable="areas"
          responseFormatTable="response_formats"
          categoryIdColumn="area_id"
          ownerColumn="slp_id"
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
            categoryLabel="Area"
            categories={areas}
            defaultCategoryId={track.steps[0]?.area_id ?? ""}
            templatesTable="track_templates"
            templateStepsTable="track_template_steps"
            categoryIdColumn="area_id"
            ownerColumn="slp_id"
            onCancel={() => setSavingTrackId(null)}
            onDone={() => {
              setSavingTrackId(null);
              setCelebration("🎉 Template saved!");
            }}
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
