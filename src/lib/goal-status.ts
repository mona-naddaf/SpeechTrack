import type { GoalStatus } from "./types";

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  mastered: "Mastered",
  queued: "Queued",
};

export const GOAL_STATUS_CLASSES: Record<GoalStatus, string> = {
  active: "bg-green-100 text-green-800",
  on_hold: "bg-amber-100 text-amber-800",
  mastered: "bg-accent-100 text-accent-800",
  queued: "bg-stone-100 text-stone-500",
};
