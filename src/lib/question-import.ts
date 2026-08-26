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
};

function normalizeResponseType(raw: string): AssessmentQuestionResponseType | null {
  return RESPONSE_TYPE_ALIASES[raw.trim().toLowerCase()] ?? null;
}

export type ParsedQuestionImportRow = {
  rowNumber: number;
  prompt: string;
  responseType: AssessmentQuestionResponseType;
  expectedAnswer: string | null;
  notes: string | null;
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
        }" — must be right_wrong, transcription, or free_text`,
      });
      continue;
    }

    valid.push({
      rowNumber: row.rowNumber,
      prompt,
      responseType,
      expectedAnswer: row.get("Expected Answer", "Expected") || null,
      notes: row.get("Notes") || null,
    });
  }

  return { valid, skipped };
}
