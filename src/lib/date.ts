/** Today's date as a local YYYY-MM-DD string, suitable for an <input type="date">
 *  or a Postgres `date` column — avoids the UTC-based off-by-one from
 *  `new Date().toISOString()` in timezones behind UTC. */
export function getTodayLocalDateString(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Local date N days before today, as a YYYY-MM-DD string — same
 *  UTC-offset care as getTodayLocalDateString(), for "recent" cutoffs
 *  like the parent-facing behavior summary's rolling window. */
export function daysAgoLocalDateString(days: number): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  local.setDate(local.getDate() - days);
  return local.toISOString().slice(0, 10);
}

/** Formats a YYYY-MM-DD date string for display, without shifting the day
 *  due to UTC parsing. */
export function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Whole days from `today` to `dateStr` — positive if `dateStr` is in
 *  the future, negative if it's in the past, 0 if they're the same day.
 *  Both plain YYYY-MM-DD strings parsed at local midnight, so this is a
 *  clean calendar-day difference regardless of DST — the countdowns
 *  widget's "X days until ..." is exactly this. */
export function daysUntil(dateStr: string, today: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const from = new Date(`${today}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - from.getTime()) / msPerDay);
}

/** Compact form for chart axis labels, e.g. "Jan 5" (no year). */
export function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** "Jan 5" or "Jan 5 – Feb 10, 2026" for a first/last session date pair. */
export function formatDateRange(first: string, last: string): string {
  return first === last
    ? formatDate(first)
    : `${formatDate(first)} – ${formatDate(last)}`;
}

/** Every YYYY-MM-DD date from `start` to `end` inclusive -- expands a
 *  holiday's date range (see 0033_holiday_date_ranges.sql) into the
 *  individual days it should mark/protect, since every caller
 *  downstream (the calendar's amber tint, streak protection) still just
 *  wants a flat list of dates, not a range to reason about itself. Both
 *  ends parsed at local midnight, same as the rest of this file, so
 *  this is immune to the UTC-parsing off-by-one a plain `new
 *  Date(dateStr)` would risk. Returns an empty array if `end` is before
 *  `start` (never happens for a real row -- the DB CHECK constraint
 *  guarantees end_date >= start_date -- but harmless either way, not an
 *  infinite loop, since the cursor only ever walks forward). */
export function eachDateInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor.getTime() <= last.getTime()) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Age in whole years, computed live from a YYYY-MM-DD date of birth
 *  against today's local date — deliberately never stored, so it's
 *  always correct without a birthday-crossing background job. */
export function computeAge(dateOfBirth: string): number {
  const today = new Date(`${getTodayLocalDateString()}T00:00:00`);
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) {
    age--;
  }
  return age;
}
