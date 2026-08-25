import type { BehaviorSeverity } from "./types";

export const SEVERITY_LABELS: Record<BehaviorSeverity, string> = {
  1: "Mild",
  2: "Moderate",
  3: "Significant",
};

/** Escalating badge colors — mild reads as a caution, significant as urgent. */
export const SEVERITY_CLASSES: Record<BehaviorSeverity, string> = {
  1: "bg-amber-100 text-amber-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-red-100 text-red-800",
};
