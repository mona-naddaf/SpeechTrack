import type { ImportSkip, XlsxRow } from "./xlsx-import";

/** One row of an uploaded goal-bank spreadsheet that passed validation.
 *  `categoryName` is the raw "Area"/"Subject" text as typed — matching it
 *  (or creating it) against the account's existing areas/subjects happens
 *  where the row actually gets inserted, not here. */
export type ParsedGoalImportRow = {
  rowNumber: number;
  categoryName: string;
  text: string;
  targetPercent: number | null;
  baseline: string | null;
};

export type GoalImportParseResult = {
  valid: ParsedGoalImportRow[];
  skipped: ImportSkip[];
};

/** Validates and shapes the rows of an uploaded goal-bank spreadsheet.
 *  `categoryLabel` is "Area" (SLP) or "Subject" (Teacher) — whichever
 *  header the account's template uses; "Area"/"Subject" are both accepted
 *  regardless, so a file from either template parses the same way. */
export function parseGoalImportRows(
  rows: XlsxRow[],
  categoryLabel: string
): GoalImportParseResult {
  const valid: ParsedGoalImportRow[] = [];
  const skipped: ImportSkip[] = [];

  for (const row of rows) {
    const text = row.get("Goal Text", "Goal", "Text");
    if (!text) {
      skipped.push({ rowNumber: row.rowNumber, reason: "Missing goal text" });
      continue;
    }

    const categoryName = row.get(categoryLabel, "Area", "Subject");
    if (!categoryName) {
      skipped.push({
        rowNumber: row.rowNumber,
        reason: `Missing ${categoryLabel.toLowerCase()}`,
      });
      continue;
    }

    const targetRaw = row.get("Target %", "Target Percent", "Target");
    let targetPercent: number | null = null;
    if (targetRaw !== "") {
      const parsed = Number(targetRaw);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        skipped.push({
          rowNumber: row.rowNumber,
          reason: `Target % must be a number between 0 and 100 (got "${targetRaw}")`,
        });
        continue;
      }
      targetPercent = parsed;
    }

    valid.push({
      rowNumber: row.rowNumber,
      categoryName,
      text,
      targetPercent,
      baseline: row.get("Baseline") || null,
    });
  }

  return { valid, skipped };
}
