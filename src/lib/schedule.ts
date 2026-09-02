import type { DayOfWeek, ScheduledDayTime } from "./types";
import { formatDate } from "./date";
import { weekStartOf } from "./streaks";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/** New scheduled days start at this length, and it's the backfilled
 *  value migration 0030 gave every pre-existing entry — shared so the
 *  picker's "new day" default and the calendar's defensive fallback
 *  (for any entry that somehow lacks the field) never disagree. */
export const DEFAULT_DURATION_MINUTES = 30;

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

// ============================================================
// Schedule page (step 2) — date/time math for the Week and Day views
// in src/components/schedule-view.tsx. Everything here is pure client-
// side math over the recurring weekly pattern already fetched once by
// the page — there's no per-week/per-day server round trip, since
// scheduled_days has no notion of individual session instances yet
// (that's a later step; for now "every Monday at 2:30pm" applies to
// every Monday, subject only to schedule_end_date).
// ============================================================

/** Same "shift by the local UTC offset, then take the date portion"
 *  idiom as toDateStr() in src/lib/streaks.ts — converts a Date back to
 *  a YYYY-MM-DD string without the UTC-conversion day-shift that a
 *  plain toISOString() would risk. Duplicated rather than exported from
 *  streaks.ts because it's a private helper there; weekStartOf() below
 *  it *is* exported and reused directly instead of reimplemented. */
function toDateStr(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** dateStr + n days (n may be negative), as YYYY-MM-DD. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** The 7 dates (Mon..Sun) of the week containing dateStr — Monday-start,
 *  same convention weekStartOf() (src/lib/streaks.ts) already uses for
 *  every other "this week" calculation in the app (e.g. the dashboard's
 *  sessionsThisWeek count), so the Schedule page's week doesn't disagree
 *  with what "this week" means anywhere else. */
export function datesForWeekOf(dateStr: string): string[] {
  const monday = weekStartOf(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDaysToDateString(monday, i));
}

/** Which DayOfWeek a YYYY-MM-DD date string falls on. getDay() is
 *  0=Sunday..6=Saturday; DAYS_OF_WEEK is Monday-first, so Sunday (0)
 *  maps to the last index and everything else shifts back by one. */
export function dayOfWeekOf(dateStr: string): DayOfWeek {
  const jsDay = new Date(`${dateStr}T00:00:00`).getDay();
  return DAYS_OF_WEEK[(jsDay + 6) % 7];
}

/** "14:30" -> 870 (minutes since midnight) — for positioning a block
 *  within the timeline and for range/sort math. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 9 -> "9 AM", 13 -> "1 PM", 0 -> "12 AM" — the timeline's hour-axis
 *  labels (distinct from formatTime12h, which formats a stored "HH:MM"
 *  and always includes minutes; an axis label is always on the hour). */
export function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12} ${period}`;
}

// Both date labels below pin the locale to "en-US" explicitly, unlike
// formatDate()/formatShortDate() above (which pass `undefined` and let
// the runtime's default locale decide). That's safe for those two only
// because every caller today renders them from a Server Component;
// these two are read inside ScheduleView, a client component, which
// Next still renders once on the server for the initial HTML before
// hydrating in the browser -- `undefined` there let the *server's* OS
// locale (e.g. "31 Aug") and the *browser's* locale (e.g. "Aug 31")
// disagree on word order, which is a real hydration-mismatch bug this
// project hit while building this page (React discards and
// re-renders the tree when that happens). Pinning the locale keeps the
// server- and client-rendered text identical regardless of either
// machine's OS settings.

/** "Sep 1 – Sep 7, 2026" for the Week view header — the year is shown
 *  once, at the end, same as formatDateRange() (src/lib/date.ts) does
 *  for a session date range. */
export function formatWeekRangeLabel(monday: string): string {
  const sunday = addDaysToDateString(monday, 6);
  const start = new Date(`${monday}T00:00:00`);
  const end = new Date(`${sunday}T00:00:00`);
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

/** "Tuesday, Sep 2, 2026" for the Day view header. */
export function formatFullDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Whether a scheduled occurrence falling on `dateStr` should still show,
 *  given an optional schedule_end_date. Inclusive of the end date itself
 *  — "scheduled through Jun 15" still shows the Jun 15 occurrence.
 *  Both are YYYY-MM-DD strings, so plain string comparison is already
 *  chronological order; no Date parsing needed. */
export function isWithinScheduleEndDate(
  dateStr: string,
  endDate: string | null
): boolean {
  return endDate === null || dateStr <= endDate;
}
