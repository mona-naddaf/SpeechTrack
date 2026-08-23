/** Human-readable rendering of a trial's jsonb `value` — used in CSV
 *  exports and anywhere else a trial needs to show up as plain text. */
export function formatTrialValue(value: Record<string, unknown>): string {
  if (typeof value.level === "string") return value.level;
  if (typeof value.correct === "boolean") return value.correct ? "Correct" : "Incorrect";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
