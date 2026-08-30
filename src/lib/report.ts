import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { formatDate } from "./date";
import { EXPECTED_FREQUENCY_LABELS } from "./streaks";
import { ATTENDANCE_REASON_LABELS } from "./attendance";
import type { GoalProgressReport, TrendDirection } from "./progress";
import type { AttendanceReason, ExpectedFrequency } from "./types";

/** One goal's section in the generated report — the same GoalProgressReport
 *  shape the in-app Progress page renders (so the summary text/percentage
 *  match exactly), plus the couple of fields buildGoalReport doesn't carry
 *  (area/subject name, target %) that the report also needs. */
export type ReportGoalEntry = {
  report: GoalProgressReport;
  areaName: string;
  targetPercent: number | null;
};

export type ReportAbsence = {
  date: string;
  reason: AttendanceReason | null;
  reasonNote: string | null;
};

export type ReportBehaviorEntry = {
  name: string;
  count: number;
};

/** Fully-normalized, role-agnostic input to buildStudentReportDocx — the
 *  API route is the one place that knows whether the data came from the
 *  SLP or Teacher tables; by the time it gets here, everything reads the
 *  same regardless of which side asked for it. */
export type StudentReportData = {
  studentName: string;
  studentClass: string | null;
  /** Pre-computed via computeAge() — null when date_of_birth isn't set. */
  age: number | null;
  homeroomTeacher: string | null;
  startDate: string;
  endDate: string;
  expectedFrequency: ExpectedFrequency;
  /** Sessions logged within [startDate, endDate]. */
  actualSessionCount: number;
  /** Only goals with at least one trial logged within the date range —
   *  each report itself is still built from the goal's full trial history,
   *  matching the "currently at X%, trending up, since ..." wording shown
   *  elsewhere in the app. */
  goalEntries: ReportGoalEntry[];
  absenceCount: number;
  absences: ReportAbsence[];
  /** Behaviour type counts within the date range — empty when nothing was
   *  logged, in which case the whole section is left out of the document. */
  behaviorEntries: ReportBehaviorEntry[];
};

const TREND_LABELS: Record<TrendDirection, string> = {
  up: "Improving",
  down: "Declining",
  flat: "Stable",
};

const BODY_COLOR = "3F3B36";
const MUTED_COLOR = "78716C";

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, bold: true })],
  });
}

function goalHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true })],
  });
}

function bodyLine(text: string, options?: { muted?: boolean }): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({
        text,
        color: options?.muted ? MUTED_COLOR : BODY_COLOR,
        italics: options?.muted,
      }),
    ],
  });
}

function bulletLine(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, color: BODY_COLOR })],
  });
}

/** Builds the .docx report as a Buffer — plain, professional formatting
 *  (title, section headings, readable body text) with no styling clever
 *  enough to fight a parent editing it afterward in Word. */
export async function buildStudentReportDocx(
  data: StudentReportData
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // ---- Title ----
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text: "BloomTrack Progress Report", bold: true })],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: data.studentName, bold: true, size: 28 })],
    })
  );
  children.push(
    bodyLine(
      `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`,
      { muted: true }
    )
  );

  // ---- Student information ----
  children.push(sectionHeading("Student Information"));
  children.push(bodyLine(`Name: ${data.studentName}`));
  if (data.age !== null) {
    children.push(bodyLine(`Age: ${data.age} years old`));
  }
  children.push(bodyLine(`Class: ${data.studentClass || "—"}`));
  if (data.homeroomTeacher) {
    children.push(bodyLine(`Homeroom teacher: ${data.homeroomTeacher}`));
  }

  // ---- Goals ----
  children.push(sectionHeading("Goals"));
  if (data.goalEntries.length === 0) {
    children.push(bodyLine("No activity recorded in this period.", { muted: true }));
  } else {
    for (const entry of data.goalEntries) {
      children.push(goalHeading(entry.report.goal.text));
      children.push(
        bodyLine(
          `Area: ${entry.areaName}` +
            (entry.targetPercent !== null
              ? ` · Target: ${entry.targetPercent}%`
              : "")
        )
      );
      children.push(bodyLine(entry.report.summary));
      children.push(bodyLine(`Trend: ${TREND_LABELS[entry.report.trendDirection]}`));
    }
  }

  // ---- Session frequency ----
  children.push(sectionHeading("Session Frequency"));
  children.push(
    bodyLine(`Expected frequency: ${EXPECTED_FREQUENCY_LABELS[data.expectedFrequency]}`)
  );
  children.push(
    bodyLine(
      `Sessions logged in this period: ${data.actualSessionCount}`
    )
  );

  // ---- Attendance ----
  children.push(sectionHeading("Attendance"));
  children.push(
    bodyLine(
      data.absenceCount === 0
        ? "No absences recorded in this period."
        : `${data.absenceCount} absence${data.absenceCount === 1 ? "" : "s"} recorded in this period:`
    )
  );
  for (const absence of data.absences) {
    const reasonLabel = absence.reason
      ? ATTENDANCE_REASON_LABELS[absence.reason]
      : "No reason given";
    const note = absence.reasonNote ? ` — ${absence.reasonNote}` : "";
    children.push(bulletLine(`${formatDate(absence.date)}: ${reasonLabel}${note}`));
  }

  // ---- Behaviour summary (omitted entirely when nothing was logged) ----
  if (data.behaviorEntries.length > 0) {
    children.push(sectionHeading("Behaviour Summary"));
    for (const entry of data.behaviorEntries) {
      children.push(bulletLine(`${entry.name}: ${entry.count}`));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: BODY_COLOR },
        },
      },
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
