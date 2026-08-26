"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  ResponseFormatOption,
  TeacherBankGoal,
  TeacherGoalWithRelations,
  TeacherSubject,
} from "@/lib/types";
import { GOAL_STATUS_CLASSES, GOAL_STATUS_LABELS } from "@/lib/goal-status";
import { fireCelebrationConfetti } from "@/lib/confetti";
import CelebrationToast from "@/components/celebration-toast";
import GoalFormModal, { type GoalFormValues } from "./goal-form-modal";
import DeleteGoalConfirmModal from "./delete-goal-confirm-modal";

const GOAL_SELECT_COLUMNS =
  "id, student_id, subject_id, text, response_format_id, baseline, target_percent, status, visible_to_parent, created_at, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name)";

type Props = {
  studentId: string;
  initialGoals: TeacherGoalWithRelations[];
  initialGoalsError: string | null;
  subjects: TeacherSubject[];
  responseFormats: ResponseFormatOption[];
  bankGoals: TeacherBankGoal[];
};

export default function GoalsSection({
  studentId,
  initialGoals,
  initialGoalsError,
  subjects,
  responseFormats,
  bankGoals,
}: Props) {
  const [goals, setGoals] = useState<TeacherGoalWithRelations[]>(initialGoals);
  const [listError] = useState<string | null>(initialGoalsError);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<TeacherGoalWithRelations | null>(
    null
  );
  const [deletingGoal, setDeletingGoal] = useState<TeacherGoalWithRelations | null>(
    null
  );
  const [visibilityErrorByGoalId, setVisibilityErrorByGoalId] = useState<
    Record<string, string>
  >({});
  const [showMasteryCelebration, setShowMasteryCelebration] = useState(false);

  function sortByNewest(list: TeacherGoalWithRelations[]) {
    return [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

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

  async function handleAdd(values: GoalFormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

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
    // any other edit) shouldn't retrigger it.
    const justMastered =
      values.status === "mastered" && editingGoal.status !== "mastered";

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_goals")
      .update({
        subject_id: values.subjectId,
        text: values.text,
        response_format_id: values.responseFormatId,
        baseline: values.baseline || null,
        target_percent: values.targetPercent,
        status: values.status,
      })
      .eq("id", editingGoal.id);

    if (error) {
      return error.message;
    }

    const fullGoal = await refetchGoal(editingGoal.id);
    if (fullGoal) {
      setGoals((prev) =>
        prev.map((g) => (g.id === fullGoal.id ? fullGoal : g))
      );
    }
    setEditingGoal(null);

    if (justMastered) {
      setShowMasteryCelebration(true);
      fireCelebrationConfetti();
    }

    return null;
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
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Target className="h-5 w-5 text-brand-500" />
          Goals
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Set a goal
        </button>
      </div>

      {listError && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load goals: {listError}
        </p>
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {goals.map((goal) => (
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

      {showAddModal && (
        <GoalFormModal
          mode="add"
          subjects={subjects}
          responseFormats={responseFormats}
          bankGoals={bankGoals}
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

      {showMasteryCelebration && (
        <CelebrationToast
          message="🎉 Goal mastered!"
          onDone={() => setShowMasteryCelebration(false)}
        />
      )}
    </div>
  );
}
