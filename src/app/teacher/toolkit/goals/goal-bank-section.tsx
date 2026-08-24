"use client";

import { useMemo, useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ResponseFormatOption, TeacherSubject } from "@/lib/types";
import BankGoalFormModal, { type BankGoalFormValues } from "./bank-goal-form-modal";
import DeleteBankGoalConfirmModal from "./delete-bank-goal-confirm-modal";

/** A teacher goal-bank row (student_id is null) joined with its subject and
 *  default response format for display on the goal bank page. */
export type TeacherBankGoalWithRelations = {
  id: string;
  subject_id: string;
  text: string;
  response_format_id: string | null;
  target_percent: number | null;
  created_at: string;
  subject: { id: string; name: string } | null;
  response_format: { id: string; name: string } | null;
};

const BANK_GOAL_SELECT_COLUMNS =
  "id, student_id, subject_id, text, response_format_id, target_percent, created_at, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name)";

type Props = {
  initialGoals: TeacherBankGoalWithRelations[];
  subjects: TeacherSubject[];
  responseFormats: ResponseFormatOption[];
};

export default function GoalBankSection({
  initialGoals,
  subjects,
  responseFormats,
}: Props) {
  const [goals, setGoals] = useState<TeacherBankGoalWithRelations[]>(initialGoals);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<TeacherBankGoalWithRelations | null>(
    null
  );
  const [deletingGoal, setDeletingGoal] = useState<TeacherBankGoalWithRelations | null>(
    null
  );

  const groups = useMemo(() => {
    const bySubject = new Map<string, TeacherBankGoalWithRelations[]>();
    for (const goal of goals) {
      const key = goal.subject?.name ?? "Uncategorized";
      const list = bySubject.get(key) ?? [];
      list.push(goal);
      bySubject.set(key, list);
    }
    return Array.from(bySubject.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [goals]);

  async function refetchGoal(id: string): Promise<TeacherBankGoalWithRelations | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from("teacher_goals")
      .select(BANK_GOAL_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    // See the equivalent comment in goals-section.tsx — without generated
    // Database types, postgrest-js can't infer subject/response_format as
    // to-one relations, but at runtime they come back as single objects.
    return data as unknown as TeacherBankGoalWithRelations | null;
  }

  async function handleAdd(values: BankGoalFormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { data, error } = await supabase
      .from("teacher_goals")
      .insert({
        teacher_id: user.id,
        student_id: null,
        subject_id: values.subjectId,
        text: values.text,
        response_format_id: values.responseFormatId,
        target_percent: values.targetPercent,
      })
      .select("id")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    const fullGoal = await refetchGoal(data.id);
    if (fullGoal) {
      setGoals((prev) => [fullGoal, ...prev]);
    }
    setShowAddModal(false);
    return null;
  }

  async function handleEdit(values: BankGoalFormValues) {
    if (!editingGoal) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_goals")
      .update({
        subject_id: values.subjectId,
        text: values.text,
        response_format_id: values.responseFormatId,
        target_percent: values.targetPercent,
      })
      .eq("id", editingGoal.id);

    if (error) {
      return error.message;
    }

    const fullGoal = await refetchGoal(editingGoal.id);
    if (fullGoal) {
      setGoals((prev) => prev.map((g) => (g.id === fullGoal.id ? fullGoal : g)));
    }
    setEditingGoal(null);
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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <ListChecks className="h-5 w-5 text-brand-500" />
          Bank goals
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Add to bank
        </button>
      </div>

      {goals.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <ListChecks className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No bank goals yet — add one to start building your reusable goal
            bank.
          </p>
        </div>
      )}

      {groups.length > 0 && (
        <div className="mt-4 space-y-6">
          {groups.map(([subjectName, subjectGoals]) => (
            <div key={subjectName}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
                {subjectName}
              </h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {subjectGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4"
                  >
                    <p className="flex-1 text-sm text-stone-900">
                      {goal.text}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                      {goal.response_format && (
                        <span>{goal.response_format.name}</span>
                      )}
                      {goal.target_percent !== null && (
                        <span>Target: {goal.target_percent}%</span>
                      )}
                    </div>

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
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <BankGoalFormModal
          mode="add"
          subjects={subjects}
          responseFormats={responseFormats}
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingGoal && (
        <BankGoalFormModal
          mode="edit"
          subjects={subjects}
          responseFormats={responseFormats}
          initialGoal={editingGoal}
          onCancel={() => setEditingGoal(null)}
          onSubmit={handleEdit}
        />
      )}

      {deletingGoal && (
        <DeleteBankGoalConfirmModal
          goal={deletingGoal}
          onCancel={() => setDeletingGoal(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
