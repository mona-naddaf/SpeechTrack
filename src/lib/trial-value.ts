function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Human-readable rendering of a trial's jsonb `value` — used in CSV
 *  exports and anywhere else a trial needs to show up as plain text. */
export function formatTrialValue(value: Record<string, unknown>): string {
  if (typeof value.level === "string") return value.level;
  if (typeof value.rating === "number") return String(value.rating);
  if (typeof value.correct === "boolean") return value.correct ? "Correct" : "Incorrect";

  // "sentence_structure": {components: [{name, level}], extras: [{label, level}]}
  if (Array.isArray(value.components) || Array.isArray(value.extras)) {
    const parts: string[] = [];
    for (const c of Array.isArray(value.components) ? value.components : []) {
      if (isRecord(c) && typeof c.name === "string" && typeof c.level === "string") {
        parts.push(`${c.name}: ${c.level}`);
      }
    }
    for (const e of Array.isArray(value.extras) ? value.extras : []) {
      if (isRecord(e) && typeof e.label === "string" && typeof e.level === "string") {
        parts.push(`${e.label} (extra): ${e.level}`);
      }
    }
    if (parts.length > 0) return parts.join(", ");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
