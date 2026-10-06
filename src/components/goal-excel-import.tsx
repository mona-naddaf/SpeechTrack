"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { downloadXlsxTemplate, parseXlsxFile, type ImportSkip } from "@/lib/xlsx-import";
import { parseGoalImportRows } from "@/lib/goal-import";
import { normalizeGoalText } from "@/lib/goal-duplicates";

type Category = { id: string; name: string };

/** A freshly-inserted bank goal row in the goal bank's normalized shape
 *  (category_id/category aliases — see bankGoalSelect in
 *  goal-bank-section.tsx), typed loosely on this generic component's side. */
export type ImportedBankGoal = Record<string, unknown>;

type Props = {
  /** "Area" for the SLP goal bank, "Subject" for the Teacher one — drives
   *  the template header and which column name rows are matched against. */
  categoryLabel: "Area" | "Subject";
  categories: Category[];
  goalsTable: "goals" | "teacher_goals";
  categoryTable: "areas" | "teacher_subjects";
  categoryIdColumn: "area_id" | "subject_id";
  formatsTable: "response_formats" | "teacher_response_formats";
  ownerColumn: "slp_id" | "teacher_id";
  /** Her current bank goals, to flag imported rows that duplicate one. */
  existingGoals: { text: string; categoryName: string }[];
  /** The account default format, used for every imported goal (the
   *  spreadsheet has no format column); null = none, as before. */
  defaultFormat: { id: string; name: string } | null;
  onImported: (newGoals: ImportedBankGoal[], newCategories: Category[]) => void;
};

type ImportSummary = {
  addedCount: number;
  skipped: ImportSkip[];
  /** Imported anyway, but matching a goal already in the bank. */
  duplicates: { rowNumber: number; text: string; existingIn: string }[];
  formatName: string | null;
};

const EXAMPLES: Record<"Area" | "Subject", (string | number)[]> = {
  Area: [
    "Articulation",
    "Will produce /r/ in initial position of words with 80% accuracy",
    80,
    "Currently at 40% accuracy in structured tasks",
  ],
  Subject: [
    "Reading",
    "Will identify the main idea of a grade-level passage with 80% accuracy",
    80,
    "Currently identifies main idea 2/5 trials",
  ],
};

/** "Download template" + "Upload from Excel" for a goal bank — shared by
 *  the SLP (/toolkit/goals) and Teacher (/teacher/toolkit/goals) pages,
 *  which differ only in table/column names, passed in as props. Creates
 *  any area/subject a row references but doesn't find yet, rather than
 *  failing the row. */
export default function GoalExcelImport({
  categoryLabel,
  categories,
  goalsTable,
  categoryTable,
  categoryIdColumn,
  formatsTable,
  ownerColumn,
  existingGoals,
  defaultFormat,
  onImported,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleDownloadTemplate() {
    await downloadXlsxTemplate(
      "goal-bank-template.xlsx",
      [categoryLabel, "Goal Text", "Target %", "Baseline"],
      [EXAMPLES[categoryLabel]]
    );
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after a fix
    if (!file) return;

    setImporting(true);
    setError(null);
    setSummary(null);

    try {
      const rows = await parseXlsxFile(file);
      const { valid, skipped } = parseGoalImportRows(rows, categoryLabel);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You need to be signed in.");
        return;
      }

      const categoryIdByName = new Map(
        categories.map((c) => [c.name.trim().toLowerCase(), c.id])
      );
      const newCategories: Category[] = [];
      const finalSkipped = [...skipped];
      const insertRows: Record<string, unknown>[] = [];
      const existingByKey = new Map<string, string>();
      for (const g of existingGoals) {
        const key = normalizeGoalText(g.text);
        if (key && !existingByKey.has(key)) existingByKey.set(key, g.categoryName);
      }
      const duplicates: ImportSummary["duplicates"] = [];

      for (const row of valid) {
        const key = row.categoryName.trim().toLowerCase();
        let categoryId = categoryIdByName.get(key);

        if (!categoryId) {
          const { data, error: categoryError } = await supabase
            .from(categoryTable)
            .insert({ [ownerColumn]: user.id, name: row.categoryName.trim() })
            .select("id, name")
            .single();

          if (categoryError || !data) {
            finalSkipped.push({
              rowNumber: row.rowNumber,
              reason: `Couldn't create ${categoryLabel.toLowerCase()} "${row.categoryName}": ${
                categoryError?.message ?? "unknown error"
              }`,
            });
            continue;
          }

          // `categoryTable` is a variable, not a literal, so postgrest-js
          // can't infer this row's shape — same as the join-result casts
          // used throughout the rest of the app.
          const created = data as unknown as { id: string; name: string };
          categoryId = created.id;
          categoryIdByName.set(key, categoryId);
          newCategories.push({ id: created.id, name: created.name });
        }

        const existingIn = existingByKey.get(normalizeGoalText(row.text));
        if (existingIn) duplicates.push({ rowNumber: row.rowNumber, text: row.text, existingIn });

        insertRows.push({
          [ownerColumn]: user.id,
          student_id: null,
          [categoryIdColumn]: categoryId,
          text: row.text,
          target_percent: row.targetPercent,
          baseline: row.baseline,
          response_format_id: defaultFormat?.id ?? null,
        });
      }

      let insertedGoals: ImportedBankGoal[] = [];
      if (insertRows.length > 0) {
        // `goalsTable`/`categoryIdColumn`/etc. are variables, not literals,
        // so postgrest-js's compile-time select-string parser can't verify
        // this query — cast away the generic like the rest of this
        // component already does for the same underlying reason.
        const { data, error: goalsError } = await (supabase.from(goalsTable) as any)
          .insert(insertRows)
          .select(
            `id, category_id:${categoryIdColumn}, text, response_format_id, target_percent, visibility, created_at, category:${categoryTable}(id, name), response_format:${formatsTable}(id, name)`
          );

        if (goalsError) {
          setError(goalsError.message);
          return;
        }
        insertedGoals = (data ?? []) as ImportedBankGoal[];
      }

      onImported(insertedGoals, newCategories);
      setSummary({
        addedCount: insertedGoals.length,
        skipped: finalSkipped,
        duplicates: insertedGoals.length > 0 ? duplicates : [],
        formatName: insertedGoals.length > 0 ? defaultFormat?.name ?? null : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
        Bulk import from Excel
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-600 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
        >
          <Download className="h-4 w-4" />
          Download template
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-600 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <Upload className="h-4 w-4" />
          {importing ? "Importing…" : "Upload from Excel"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="mt-2 rounded-lg bg-white p-3 text-sm text-stone-700">
          <p className="font-medium">
            {summary.addedCount} goal{summary.addedCount === 1 ? "" : "s"} added
          </p>
          {summary.formatName && (
            <p className="mt-0.5 text-stone-500" data-testid="import-format-note">
              Response format: {summary.formatName} (your default)
            </p>
          )}
          {summary.duplicates.length > 0 && (
            <div className="mt-2 rounded-md bg-amber-50 p-2 text-amber-900" data-testid="import-duplicates">
              <p className="font-medium">
                {summary.duplicates.length} imported{" "}
                {summary.duplicates.length === 1 ? "row duplicates a goal" : "rows duplicate goals"} already in
                your bank — imported anyway, so nothing was lost:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {summary.duplicates.map((d) => (
                  <li key={d.rowNumber}>
                    Row {d.rowNumber}: &ldquo;{d.text}&rdquo; (already in {d.existingIn})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.skipped.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-stone-500">
              {summary.skipped.map((s, i) => (
                <li key={i}>
                  Row {s.rowNumber}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
