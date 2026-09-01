import type { DayOfWeek, ScheduledDayTime } from "./types";
import { formatDate } from "./date";

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

/** "14:30" -> "2:30pm" — scheduled_days stores 24h "HH:MM" (an
 *  <input type="time">'s native value), so every display spot converts
 *  through here rather than each re-deriving am/pm math. */
export function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(":");
  const hour = parseInt(hStr, 10);
  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${mStr}${period}`;
}

/** "Mon 2:30pm, Wed 2:30pm" in calendar order regardless of how
 *  scheduled_days was stored. */
export function formatScheduledDays(days: ScheduledDayTime[]): string {
  const timeByDay = new Map(days.map((entry) => [entry.day, entry.time]));
  return DAYS_OF_WEEK.filter((d) => timeByDay.has(d))
    .map((d) => `${DAY_LABELS[d]} ${formatTime12h(timeByDay.get(d)!)}`)
    .join(", ");
}

/** The full "Scheduled: ..." line contents, e.g.
 *  "Mon 2:30pm, Wed 2:30pm — through Jun 15, 2026" — used by every
 *  "Scheduled: {...}" spot (the student page, its Teacher and
 *  supervisor read-only equivalents). Callers still gate on
 *  `scheduled_days.length > 0` themselves before rendering the line at
 *  all, same as before this had an end date to also consider. */
export function formatSchedule(
  days: ScheduledDayTime[],
  endDate: string | null
): string {
  const daysPart = formatScheduledDays(days);
  return endDate ? `${daysPart} — through ${formatDate(endDate)}` : daysPart;
}
