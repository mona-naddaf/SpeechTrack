import type { AssessmentQuestionResponseType } from "./types";
import type { ImportSkip, XlsxRow } from "./xlsx-import";

/** Accepted spellings for each response type, matched case/whitespace-
 *  insensitively — includes the enum values themselves plus the labels
 *  shown in the UI (ASSESSMENT_RESPONSE_TYPE_LABELS), since a template
 *  filled out by eye is more likely to have "Correct/Incorrect" than
 *  "right_wrong" typed into it. */
const RESPONSE_TYPE_ALIASES: Record<string, AssessmentQuestionResponseType> = {
  right_wrong: "right_wrong",
  "right wrong": "right_wrong",
  "right/wrong": "right_wrong",
  "correct/incorrect": "right_wrong",
  correct_incorrect: "right_wrong",
  "correct incorrect": "right_wrong",
  transcription: "transcription",
  free_text: "free_text",
  "free text": "free_text",
  custom_choice: "custom_choice",
  "custom choice": "custom_choice",
  "custom choices": "custom_choice",
};

function normalizeResponseType(raw: string): AssessmentQuestionResponseType | null {
  return RESPONSE_TYPE_ALIASES[raw.trim().toLowerCase()] ?? null;
}

const MIN_CHOICES = 2;
const MAX_CHOICES = 4;

/** Splits a "Choices" cell into individual option labels. Accepts either
 *  a comma or a semicolon as the separator (whichever reads cleaner for a
 *  given set of labels — e.g. options that themselves contain commas can
 *  use semicolons instead), trims each one, and drops empties. */
function parseChoicesCell(raw: string): string[] {
  const separator = raw.includes(";") ? ";" : ",";
  return raw
    .split(separator)
    .map((c) => c.trim())
    .filter(Boolean);
}

export type ParsedQuestionImportRow = {
  rowNumber: number;
  prompt: string;
  responseType: AssessmentQuestionResponseType;
  expectedAnswer: string | null;
  notes: string | null;
  /** Only set (2-4 labels) when responseType is "custom_choice". */
  choices: string[] | null;
};

export type QuestionImportParseResult = {
  valid: ParsedQuestionImportRow[];
  skipped: ImportSkip[];
};

/** Validates and shapes the rows of an uploaded assessment-question
 *  spreadsheet. Row order is preserved in `valid` so questions get
 *  appended in file order. */
export function parseQuestionImportRows(rows: XlsxRow[]): QuestionImportParseResult {
  const valid: ParsedQuestionImportRow[] = [];
  const skipped: ImportSkip[] = [];

  for (const row of rows) {
    const prompt = row.get("Prompt", "Question");
    if (!prompt) {
      skipped.push({ rowNumber: row.rowNumber, reason: "Missing prompt" });
      continue;
    }

    const rawType = row.get("Response Type", "Type");
    const responseType = normalizeResponseType(rawType);
    if (!responseType) {
      skipped.push({
        rowNumber: row.rowNumber,
        reason: `Invalid response type "${
          rawType || "(blank)"
        }" — must be right_wrong, transcription, free_text, or custom_choice`,
      });
      continue;
    }

    let choices: string[] | null = null;
    if (responseType === "custom_choice") {
      choices = parseChoicesCell(row.get("Choices"));
      if (choices.length < MIN_CHOICES) {
        skipped.push({
          rowNumber: row.rowNumber,
          reason: `Custom choice questions need a "Choices" column with at least ${MIN_CHOICES} options, separated by commas or semicolons`,
        });
        continue;
      }
      if (choices.length > MAX_CHOICES) {
        choices = choices.slice(0, MAX_CHOICES);
      }
    }

    valid.push({
      rowNumber: row.rowNumber,
      prompt,
      responseType,
      expectedAnswer: row.get("Expected Answer", "Expected") || null,
      notes: row.get("Notes") || null,
      choices,
    });
  }

  return { valid, skipped };
}
