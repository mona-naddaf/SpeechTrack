"use client";

import { Target } from "lucide-react";
import type { GoalStatus, MaterialChip } from "@/lib/types";
import { GOAL_STATUS_CLASSES, GOAL_STATUS_LABELS } from "@/lib/goal-status";
import MaterialChips from "@/components/material-chips";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";

/** Role-agnostic display shape — the page normalizes the SLP's `area`
 *  and the Teacher's `subject` into `category` before handing goals
 *  here, the same way the progress pages normalize subject into the
 *  `area` slot for buildGoalReport (see
 *  src/app/teacher/students/[id]/progress/page.tsx). */
export type SupervisorGoalDisplay = {
  id: string;
  category: { id: string; name: string } | null;
  text: string;
  target_percent: number | null;
  status: GoalStatus;
  visible_to_parent: boolean;
};

type Props = {
  goals: SupervisorGoalDisplay[];
  error: string | null;
  materialsByGoalId: Record<string, MaterialChip[]>;
};

/** Read-only mirror of GoalsSection — same cards, no "Set a goal" /
 *  Edit / Delete, and "Show progress to parent" is inert (a disabled
 *  checkbox reflecting the stored value, not a live toggle). */
export default function GoalsView({ goals, error, materialsByGoalId }: Props) {
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("goals");

  return (
    <div>
      <SectionHeader
        icon={Target}
        title="Goals"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />

      {!collapsed && (
        <>
          {error && (
            <p className="mt-4 text-sm text-red-600">
              Couldn&apos;t load goals: {error}
            </p>
          )}

          {!error && goals.length === 0 && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <Target className="h-6 w-6 text-brand-500" />
              </div>
              <p className="text-stone-500">No goals set yet.</p>
            </div>
          )}

          {goals.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                      {goal.category?.name ?? "Uncategorized"}
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
                      disabled
                      readOnly
                      className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600"
                    />
                    Visible to parent
                  </label>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
