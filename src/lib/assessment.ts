import { formatDate } from "./date";
import type {
  Area,
  AssessmentAnswerValue,
  AssessmentFormality,
  AssessmentKind,
  AssessmentQuestion,
  AssessmentQuestionResponseType,
  AssessmentWithAreas,
} from "./types";

export const ASSESSMENT_RESPONSE_TYPE_LABELS: Record<
  AssessmentQuestionResponseType,
  string
> = {
  right_wrong: "Correct/Incorrect",
  transcription: "Transcription",
  free_text: "Free text",
  custom_choice: "Custom choices",
};

export const ASSESSMENT_KIND_LABELS: Record<AssessmentKind, string> = {
  screening: "Screening",
  assessment: "Assessment",
};

export const ASSESSMENT_FORMALITY_LABELS: Record<AssessmentFormality, string> = {
  formal: "Formal",
  informal: "Informal",
};

/** Raw shape of an `assessments` row selected with a nested
 *  `assessment_areas(areas(id, name))` join. */
export type RawAssessmentWithAreasJoin = {
  id: string;
  name: string;
  description: string | null;
  kind: AssessmentKind | null;
  formality: AssessmentFormality | null;
  created_at: string;
  assessment_areas: { areas: Area | Area[] | null }[] | null;
};

/** Flattens the nested assessment_areas -> areas join into a plain
 *  `areas: Area[]` list. assessment_areas -> areas is a to-one relation
 *  from each join row's perspective, so — same postgrest-js quirk noted
 *  elsewhere in this codebase (no generated Database types) — it may be
 *  typed as an array but come back as a single object at runtime; this
 *  handles both. */
export function flattenAssessmentAreas(
  rows: RawAssessmentWithAreasJoin[]
): AssessmentWithAreas[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    formality: row.formality,
    created_at: row.created_at,
    areas: (row.assessment_areas ?? [])
      .map((join) => (Array.isArray(join.areas) ? join.areas[0] : join.areas))
      .filter((area): area is Area => Boolean(area)),
  }));
}

export const TRANSCRIPTION_TAG_LABELS: Record<
  NonNullable<AssessmentAnswerValue["tag"]>,
  string
> = {
  correct: "Correct",
  approx: "Approximation",
  incorrect: "Incorrect",
};

/** Whether a value counts as "answered" for progress/report purposes — a
 *  transcription with just a tag (no typed text) still counts, but empty
 *  text with no tag doesn't. Used both to decide what to persist (an
 *  answer that stops being "answered" gets deleted, not saved empty) and
 *  to count progress. */
export function isAssessmentAnswered(
  responseType: AssessmentQuestionResponseType,
  value: AssessmentAnswerValue | null | undefined
): boolean {
  if (!value) return false;
  if (responseType === "right_wrong") return typeof value.correct === "boolean";
  if (responseType === "transcription")
    return Boolean(value.tag) || Boolean(value.text?.trim());
  // free_text and custom_choice both just store {text}.
  return Boolean(value.text?.trim());
}

/** Human-readable rendering of one answer, for the report and "Copy report". */
export function formatAssessmentAnswer(
  responseType: AssessmentQuestionResponseType,
  value: AssessmentAnswerValue | null | undefined
): string {
  if (!value || Object.keys(value).length === 0) return "Not answered";

  if (responseType === "right_wrong") {
    if (typeof value.correct !== "boolean") return "Not answered";
    return value.correct ? "Correct" : "Incorrect";
  }

  if (responseType === "transcription") {
    if (!value.text?.trim()) return "Not answered";
    const tag = value.tag ? ` (${TRANSCRIPTION_TAG_LABELS[value.tag]})` : "";
    return `"${value.text.trim()}"${tag}`;
  }

  // free_text and custom_choice
  return value.text?.trim() || "Not answered";
}

export type AnswerForScoring = {
  response_type: AssessmentQuestionResponseType;
  value: AssessmentAnswerValue;
};

export type AssessmentScore = {
  /** Right_wrong answers marked correct, plus transcription answers tagged "correct". */
  correct: number;
  /** Transcription answers tagged "approx" — counted separately, not toward `correct`. */
  approx: number;
  /** Total answers that count toward the score at all (right_wrong answered +
   *  transcription answered with a tag). free_text and custom_choice never count —
   *  they aren't inherently right or wrong. */
  total: number;
};

/** Score summary for a set of recorded answers — see AssessmentScore for what
 *  counts. Only answers actually recorded are considered; unanswered
 *  questions (of any type) are simply excluded, not counted as incorrect. */
export function computeAssessmentScore(answers: AnswerForScoring[]): AssessmentScore {
  let correct = 0;
  let approx = 0;
  let total = 0;

  for (const answer of answers) {
    if (answer.response_type === "right_wrong") {
      if (typeof answer.value.correct !== "boolean") continue;
      total += 1;
      if (answer.value.correct) correct += 1;
    } else if (answer.response_type === "transcription") {
      if (!answer.value.tag) continue;
      total += 1;
      if (answer.value.tag === "correct") correct += 1;
      if (answer.value.tag === "approx") approx += 1;
    }
    // free_text and custom_choice are never scored — not inherently right/wrong.
  }

  return { correct, approx, total };
}

/** Plain-text version of a completed assessment's report, for "Copy report". */
export function buildAssessmentReportText(opts: {
  studentName: string;
  assessmentName: string;
  date: string;
  questions: AssessmentQuestion[];
  answersByQuestionId: Map<
    string,
    { response_type: AssessmentQuestionResponseType; value: AssessmentAnswerValue }
  >;
  score: AssessmentScore;
}): string {
  const { studentName, assessmentName, date, questions, answersByQuestionId, score } =
    opts;

  const lines: string[] = [
    `${assessmentName} — ${studentName}`,
    formatDate(date),
    "",
    score.total > 0
      ? `Score: ${score.correct}/${score.total} correct${
          score.approx > 0 ? ` (${score.approx} approximation${score.approx === 1 ? "" : "s"})` : ""
        }`
      : "Score: no scored questions",
    "",
  ];

  questions.forEach((q, i) => {
    const answer = answersByQuestionId.get(q.id);
    lines.push(
      `${i + 1}. ${q.prompt}`,
      `   Answer: ${formatAssessmentAnswer(q.response_type, answer?.value)}`
    );
    if (q.expected_answer) lines.push(`   Expected: ${q.expected_answer}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}
