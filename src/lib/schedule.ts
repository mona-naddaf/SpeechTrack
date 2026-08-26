import type { DayOfWeek } from "./types";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** "Mon, Wed, Fri" in calendar order regardless of how scheduled_days was
 *  stored — used by the "Scheduled: ..." line on the student page. */
export function formatScheduledDays(days: DayOfWeek[]): string {
  const set = new Set(days);
  return DAYS_OF_WEEK.filter((d) => set.has(d))
    .map((d) => DAY_LABELS[d])
    .join(", ");
}
