"use client";

import { useMemo, useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ResponseFormatOption, ShareVisibility, TeacherSubject } from "@/lib/types";
import BankGoalFormModal, { type BankGoalFormValues } from "./bank-goal-form-modal";
import DeleteBankGoalConfirmModal from "./delete-bank-goal-confirm-modal";
import GoalExcelImport, { type ImportedBankGoal } from "@/components/goal-excel-import";

const VISIBILITY_LABELS: Record<ShareVisibility, string> = {
  private: "Private",
  shared: "Shared",
};

const VISIBILITY_CLASSES: Record<ShareVisibility, string> = {
  private: "bg-stone-100 text-stone-600",
  shared: "bg-accent-100 text-accent-700",
};

/** A teacher goal-bank row (student_id is null) joined with its subject and
 *  default response format for display on the goal bank page. Bank goals
 *  are the only goals that can ever be "shared" — an assigned student goal
 *  is tied to a real child, so goals-section.tsx (student page) never
 *  touches visibility at all; the DB enforces that too (see
 *  0024_community_sharing.sql). */
export type TeacherBankGoalWithRelations = {
  id: string;
  subject_id: string;
  text: string;
  response_format_id: string | null;
  target_percent: number | null;
  visibility: ShareVisibility;
  created_at: string;
  subject: { id: string; name: string } | null;
  response_format: { id: string; name: string } | null;
};

const BANK_GOAL_SELECT_COLUMNS =
  "id, student_id, subject_id, text, response_format_id, target_percent, visibility, created_at, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name)";

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
  // Local copy so a newly-created subject (from an Excel upload) shows up
  // in the group headings and the add/edit modal without a page reload.
  const [subjectList, setSubjectList] = useState<TeacherSubject[]>(subjects);
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
        visibility: values.visibility,
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
        visibility: values.visibility,
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

  function handleImported(newGoals: ImportedBankGoal[], newSubjects: TeacherSubject[]) {
    if (newSubjects.length > 0) {
      setSubjectList((prev) => [...prev, ...newSubjects]);
    }
    if (newGoals.length > 0) {
      setGoals((prev) => [
        ...(newGoals as unknown as TeacherBankGoalWithRelations[]),
        ...prev,
      ]);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
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

      <div className="mt-3">
        <GoalExcelImport
          categoryLabel="Subject"
          categories={subjectList}
          goalsTable="teacher_goals"
          categoryTable="teacher_subjects"
          categoryIdColumn="subject_id"
          ownerColumn="teacher_id"
          onImported={handleImported}
        />
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
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 text-sm text-stone-900">
                        {goal.text}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${VISIBILITY_CLASSES[goal.visibility]}`}
                      >
                        {VISIBILITY_LABELS[goal.visibility]}
                      </span>
                    </div>

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
          subjects={subjectList}
          responseFormats={responseFormats}
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingGoal && (
        <BankGoalFormModal
          mode="edit"
          subjects={subjectList}
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
