import type { GoalStatus } from "./types";

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  mastered: "Mastered",
};

export const GOAL_STATUS_CLASSES: Record<GoalStatus, string> = {
  active: "bg-green-100 text-green-800",
  on_hold: "bg-amber-100 text-amber-800",
  mastered: "bg-blue-100 text-blue-800",
};
