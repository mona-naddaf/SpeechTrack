import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import { formatDate } from "./date";
import { EXPECTED_FREQUENCY_LABELS } from "./streaks";
import { ATTENDANCE_REASON_LABELS } from "./attendance";
import {
  buildLevelBreakdownSvg,
  buildTrendChartSvg,
  renderSvgToPng,
} from "./report-charts";
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
const HEADING_COLOR = "A32F16"; // brand-800
const BRAND_COLOR = "CC3B1A"; // brand-700
const RULE_COLOR = "D6D3D1"; // stone-300

// Chart SVGs are authored at 320x{140 or dynamic} (see report-charts.ts) —
// displayed here at 1.25x so they read clearly on a printed page without
// dominating it. renderSvgToPng always rasterizes well above this display
// size (4x density) so the embedded PNG stays crisp either way.
const CHART_SCALE = 1.25;
const TREND_DISPLAY = { width: Math.round(320 * CHART_SCALE), height: Math.round(140 * CHART_SCALE) };

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE_COLOR, space: 4 },
    },
    children: [new TextRun({ text, bold: true, color: HEADING_COLOR })],
  });
}

function goalHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 },
    children: [new TextRun({ text, bold: true, color: BODY_COLOR })],
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

function chartCaption(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 60 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        size: 15,
        bold: true,
        color: MUTED_COLOR,
        characterSpacing: 12,
      }),
    ],
  });
}

async function chartImage(
  svg: string,
  display: { width: number; height: number }
): Promise<Paragraph> {
  const { buffer } = await renderSvgToPng(svg, display);
  return new Paragraph({
    spacing: { after: 160 },
    children: [
      new ImageRun({
        type: "png",
        data: buffer,
        transformation: display,
      }),
    ],
  });
}

/** Builds the .docx report as a Buffer — a polished but plain-enough
 *  layout (title block, bordered section headings, embedded progress
 *  charts, footer with page numbers) that still won't fight a parent
 *  editing it afterward in Word. */
export async function buildStudentReportDocx(
  data: StudentReportData
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // ---- Title block ----
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: "BLOOMTRACK",
          bold: true,
          size: 20,
          color: BRAND_COLOR,
          characterSpacing: 24,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 40 },
      children: [new TextRun({ text: "Progress Report", bold: true, color: BODY_COLOR })],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: data.studentName, bold: true, size: 28, color: BODY_COLOR })],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND_COLOR, space: 8 },
      },
      children: [
        new TextRun({
          text: `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`,
          color: MUTED_COLOR,
          italics: true,
        }),
      ],
    })
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
      const { report } = entry;
      children.push(goalHeading(report.goal.text));
      children.push(
        bodyLine(
          `Area: ${entry.areaName}` +
            (entry.targetPercent !== null
              ? ` · Target: ${entry.targetPercent}%`
              : "")
        )
      );
      children.push(bodyLine(`Trend: ${TREND_LABELS[report.trendDirection]}`));

      if (report.totalTrials > 0) {
        if (report.isCueing && report.levelBreakdown.length > 0) {
          const levelSvg = buildLevelBreakdownSvg(report.levelBreakdown);
          const levelHeight = Math.round(
            (report.levelBreakdown.length * 34 + 4) * CHART_SCALE
          );
          children.push(chartCaption("Level breakdown"));
          children.push(
            await chartImage(levelSvg, { width: TREND_DISPLAY.width, height: levelHeight })
          );
        }

        if (report.isSentenceStructure) {
          for (const component of report.componentBreakdown) {
            if (component.levelBreakdown.length === 0) continue;
            const componentSvg = buildLevelBreakdownSvg(component.levelBreakdown);
            const componentHeight = Math.round(
              (component.levelBreakdown.length * 34 + 4) * CHART_SCALE
            );
            children.push(
              chartCaption(`${component.name} (${component.independentPercent}% independent)`)
            );
            children.push(
              await chartImage(componentSvg, { width: TREND_DISPLAY.width, height: componentHeight })
            );
          }
        }

        children.push(
          chartCaption(
            `${report.isSentenceStructure ? "Combined " : ""}${report.metricLabel} over time`
          )
        );
        children.push(
          await chartImage(buildTrendChartSvg(report.trend), TREND_DISPLAY)
        );
      }

      children.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [new TextRun({ text: report.summary, color: BODY_COLOR, italics: true })],
        })
      );
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

  const generatedOn = formatDate(new Date().toISOString().slice(0, 10));
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: RULE_COLOR, space: 6 },
        },
        children: [
          new TextRun({ text: `BloomTrack · Generated ${generatedOn} · Page `, size: 16, color: MUTED_COLOR }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED_COLOR }),
          new TextRun({ text: " of ", size: 16, color: MUTED_COLOR }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED_COLOR }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: BODY_COLOR },
        },
      },
    },
    sections: [{ footers: { default: footer }, children }],
  });

  return Packer.toBuffer(doc);
}
