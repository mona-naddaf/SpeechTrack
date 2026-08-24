"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Area, ResponseFormatOption } from "@/lib/types";
import BankGoalFormModal, { type BankGoalFormValues } from "./bank-goal-form-modal";
import DeleteBankGoalConfirmModal from "./delete-bank-goal-confirm-modal";

/** A goal-bank row (student_id is null) joined with its area and default
 *  response format for display on the goal bank page. */
export type BankGoalWithRelations = {
  id: string;
  area_id: string;
  text: string;
  response_format_id: string | null;
  target_percent: number | null;
  created_at: string;
  area: { id: string; name: string } | null;
  response_format: { id: string; name: string } | null;
};

const BANK_GOAL_SELECT_COLUMNS =
  "id, student_id, area_id, text, response_format_id, target_percent, created_at, area:areas(id, name), response_format:response_formats(id, name)";

type Props = {
  initialGoals: BankGoalWithRelations[];
  areas: Area[];
  responseFormats: ResponseFormatOption[];
};

export default function GoalBankSection({
  initialGoals,
  areas,
  responseFormats,
}: Props) {
  const [goals, setGoals] = useState<BankGoalWithRelations[]>(initialGoals);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<BankGoalWithRelations | null>(
    null
  );
  const [deletingGoal, setDeletingGoal] = useState<BankGoalWithRelations | null>(
    null
  );

  const groups = useMemo(() => {
    const byArea = new Map<string, BankGoalWithRelations[]>();
    for (const goal of goals) {
      const key = goal.area?.name ?? "Uncategorized";
      const list = byArea.get(key) ?? [];
      list.push(goal);
      byArea.set(key, list);
    }
    return Array.from(byArea.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [goals]);

  async function refetchGoal(id: string): Promise<BankGoalWithRelations | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from("goals")
      .select(BANK_GOAL_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    // See the equivalent comment in goals-section.tsx — without generated
    // Database types, postgrest-js can't infer area/response_format as
    // to-one relations, but at runtime they come back as single objects.
    return data as unknown as BankGoalWithRelations | null;
  }

  async function handleAdd(values: BankGoalFormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { data, error } = await supabase
      .from("goals")
      .insert({
        slp_id: user.id,
        student_id: null,
        area_id: values.areaId,
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
      .from("goals")
      .update({
        area_id: values.areaId,
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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Bank goals</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Add to bank
        </button>
      </div>

      {goals.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No bank goals yet. Add one to start building your reusable goal
          bank.
        </div>
      )}

      {groups.length > 0 && (
        <div className="mt-4 space-y-6">
          {groups.map(([areaName, areaGoals]) => (
            <div key={areaName}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {areaName}
              </h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {areaGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <p className="flex-1 text-sm text-slate-900">
                      {goal.text}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
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
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingGoal(goal)}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
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
          areas={areas}
          responseFormats={responseFormats}
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingGoal && (
        <BankGoalFormModal
          mode="edit"
          areas={areas}
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
