"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { downloadXlsxTemplate, parseXlsxFile, type ImportSkip } from "@/lib/xlsx-import";
import { parseGoalImportRows } from "@/lib/goal-import";

type Category = { id: string; name: string };

/** A freshly-inserted bank goal row, already joined with its category and
 *  (always-null-here) response format — same shape the two goal-bank
 *  pages' own insert/refetch queries produce, but genuinely typed as
 *  `unknown` on this generic component's side since it doesn't know
 *  whether it's dealing with `area`/`response_format` or
 *  `subject`/`response_format`. */
export type ImportedBankGoal = Record<string, unknown>;

type Props = {
  /** "Area" for the SLP goal bank, "Subject" for the Teacher one — drives
   *  the template header and which column name rows are matched against. */
  categoryLabel: "Area" | "Subject";
  categories: Category[];
  goalsTable: "goals" | "teacher_goals";
  categoryTable: "areas" | "teacher_subjects";
  categoryIdColumn: "area_id" | "subject_id";
  ownerColumn: "slp_id" | "teacher_id";
  onImported: (newGoals: ImportedBankGoal[], newCategories: Category[]) => void;
};

type ImportSummary = { addedCount: number; skipped: ImportSkip[] };

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
  ownerColumn,
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

        insertRows.push({
          [ownerColumn]: user.id,
          student_id: null,
          [categoryIdColumn]: categoryId,
          text: row.text,
          target_percent: row.targetPercent,
          baseline: row.baseline,
        });
      }

      let insertedGoals: ImportedBankGoal[] = [];
      if (insertRows.length > 0) {
        const categoryAlias = categoryLabel.toLowerCase();
        const responseFormatTable =
          goalsTable === "goals" ? "response_formats" : "teacher_response_formats";

        // `goalsTable`/`categoryIdColumn`/etc. are variables, not literals,
        // so postgrest-js's compile-time select-string parser can't verify
        // this query — cast away the generic like the rest of this
        // component already does for the same underlying reason.
        const { data, error: goalsError } = await (supabase.from(goalsTable) as any)
          .insert(insertRows)
          .select(
            `id, student_id, ${categoryIdColumn}, text, response_format_id, target_percent, created_at, ${categoryAlias}:${categoryTable}(id, name), response_format:${responseFormatTable}(id, name)`
          );

        if (goalsError) {
          setError(goalsError.message);
          return;
        }
        insertedGoals = (data ?? []) as ImportedBankGoal[];
      }

      onImported(insertedGoals, newCategories);
      setSummary({ addedCount: insertedGoals.length, skipped: finalSkipped });
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
