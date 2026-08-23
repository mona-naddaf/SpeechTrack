/** Today's date as a local YYYY-MM-DD string, suitable for an <input type="date">
 *  or a Postgres `date` column — avoids the UTC-based off-by-one from
 *  `new Date().toISOString()` in timezones behind UTC. */
export function getTodayLocalDateString(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
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
