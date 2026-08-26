import type { ExpectedFrequency } from "./types";

export const EXPECTED_FREQUENCY_LABELS: Record<ExpectedFrequency, string> = {
  daily: "Daily",
  few_times_week: "A few times a week",
  weekly: "Weekly",
};

/** The unit a streak count is expressed in for a given cadence — "day"
 *  for daily (the streak counts consecutive days), "week" for the other
 *  two (the streak counts consecutive qualifying weeks). */
function getStreakUnitLabel(frequency: ExpectedFrequency): "day" | "week" {
  return frequency === "daily" ? "day" : "week";
}

/** e.g. "12-week streak" / "5-day streak" — the plain label both the SLP
 *  and Teacher student pages show next to the streak badge. The parent
 *  dashboard writes its own warmer phrasing instead (see parent-dashboard.tsx). */
export function formatCadenceStreakLabel(
  streak: number,
  frequency: ExpectedFrequency
): string {
  return `${streak}-${getStreakUnitLabel(frequency)} streak`;
}

function toDateStr(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** Monday of the calendar week containing `dateStr`, as a YYYY-MM-DD string
 *  — used as a stable per-week grouping key. Exported for the "sessions
 *  logged this week" caseload stat (src/lib/caseload.ts), which needs the
 *  exact same week boundary the streak math uses. */
export function weekStartOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return toDateStr(d);
}

/**
 * The single shared streak calculation, used by:
 * - the SLP/Teacher student page, with that student's logged session dates
 *   and their chosen `expected_frequency`
 * - the parent dashboard, with practice-log dates and a fixed "daily"
 *   cadence (see src/app/parent/page.tsx) — "daily" here means exactly
 *   the same thing either caller means: a qualifying entry every
 *   calendar day.
 *
 * "daily": counts consecutive calendar days with at least one entry,
 * walking backward from `today`. `today` itself is allowed to have no
 * entry yet ("pending") without breaking the streak, since the day isn't
 * over — but every day before that must have one, or the walk stops.
 *
 * "weekly" / "few_times_week": the same idea, one calendar week
 * (Monday–Sunday) at a time, requiring 1 or 2 entries in that week
 * respectively. The current week is likewise allowed to be pending.
 *
 * Returns 0 if the currently-pending period doesn't count on its own and
 * the period before it already fails the cadence.
 */
export function computeCadenceStreak(
  dates: string[],
  frequency: ExpectedFrequency,
  today: string
): number {
  const daySet = new Set(dates);

  if (frequency === "daily") {
    let streak = 0;
    let cursor = daySet.has(today) ? today : addDays(today, -1);
    while (daySet.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  const requiredPerWeek = frequency === "few_times_week" ? 2 : 1;
  const countsByWeek = new Map<string, number>();
  for (const date of daySet) {
    const weekStart = weekStartOf(date);
    countsByWeek.set(weekStart, (countsByWeek.get(weekStart) ?? 0) + 1);
  }

  let streak = 0;
  let cursorWeek = weekStartOf(today);
  if ((countsByWeek.get(cursorWeek) ?? 0) < requiredPerWeek) {
    cursorWeek = addDays(cursorWeek, -7);
  }
  while ((countsByWeek.get(cursorWeek) ?? 0) >= requiredPerWeek) {
    streak++;
    cursorWeek = addDays(cursorWeek, -7);
  }
  return streak;
}

// ============================================================
// Milestone emoji tiers — shared by every streak badge in the app.
// 5 → ❤️, 10 → ⭐, 15 → 🔥, 20 → 🏆, 25 → 🌈, 30 → 👑, then every +10
// after that (40, 50, 60, ...) → 🎉.
// ============================================================

/** The emoji for the highest milestone this streak has reached, or null
 *  if it hasn't hit the first tier (5) yet. */
export function getMilestoneEmoji(streak: number): string | null {
  if (streak < 5) return null;
  if (streak < 10) return "❤️";
  if (streak < 15) return "⭐";
  if (streak < 20) return "🔥";
  if (streak < 25) return "🏆";
  if (streak < 30) return "🌈";
  if (streak < 40) return "👑";
  return "🎉";
}

const NAMED_MILESTONES = [5, 10, 15, 20, 25, 30];

/** True exactly when `streak` lands on a milestone threshold (5, 10, 15,
 *  20, 25, 30, then every 10 after: 40, 50, 60, ...) — used to fire a
 *  celebration only once, right as a streak crosses into a new tier. */
export function isMilestoneStreak(streak: number): boolean {
  if (NAMED_MILESTONES.includes(streak)) return true;
  return streak > 30 && streak % 10 === 0;
}

/** Monday = 1 ... Sunday = 7, so "days left in the week after today"
 *  is a simple subtraction from 7. */
function daysRemainingInWeek(today: string): number {
  const day = new Date(`${today}T00:00:00`).getDay(); // 0 = Sunday
  const isoDay = day === 0 ? 7 : day;
  return 7 - isoDay;
}

/**
 * True when a student has an active streak that's genuinely about to
 * break if nothing is logged soon — the basis for the dashboard's
 * "streak at risk" nudge. Requires a real streak to protect (streak 0
 * is never "at risk", there's nothing to lose yet):
 *
 * - "daily": today hasn't been logged yet. A whole day is urgent enough
 *   on its own — this cadence is checked every day by definition.
 * - "weekly" / "few_times_week": this calendar week hasn't met its quota
 *   yet, AND there are 2 or fewer days left in it (Friday through
 *   Sunday) — flagging every Monday a weekly-cadence student hasn't
 *   logged yet would be noise, not a nudge.
 */
export function isStreakAtRisk(
  dates: string[],
  frequency: ExpectedFrequency,
  today: string
): boolean {
  if (computeCadenceStreak(dates, frequency, today) === 0) return false;

  if (frequency === "daily") {
    return !new Set(dates).has(today);
  }

  const requiredPerWeek = frequency === "few_times_week" ? 2 : 1;
  const currentWeekStart = weekStartOf(today);
  // Distinct days, same as computeCadenceStreak's own per-week counting —
  // two sessions on the same day still only count as one qualifying day.
  const uniqueDatesThisWeek = new Set(
    dates.filter((date) => weekStartOf(date) === currentWeekStart)
  );
  if (uniqueDatesThisWeek.size >= requiredPerWeek) return false;

  return daysRemainingInWeek(today) <= 2;
}
