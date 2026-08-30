import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { computeAge } from "@/lib/date";
import { buildGoalReport, type ProgressGoal, type ProgressTrial } from "@/lib/progress";
import { buildStudentReportDocx, type ReportGoalEntry } from "@/lib/report";
import type { AttendanceReason, ExpectedFrequency, GoalStatus } from "@/lib/types";

export const runtime = "nodejs";

// Which tables to read from, keyed by the signed-in account's role — the
// single place this route needs to know about both schemas. attendance_records
// is deliberately absent: it's one shared table for both sides (see
// AttendanceRecord in src/lib/types.ts), scoped to "my own records" by RLS.
const TABLES = {
  slp: {
    students: "students",
    goals: "goals",
    responseFormats: "response_formats",
    sessions: "sessions",
    trials: "trials",
    behaviorLogs: "slp_behavior_logs",
    behaviorTypes: "behavior_types",
  },
  teacher: {
    students: "teacher_students",
    goals: "teacher_goals",
    responseFormats: "teacher_response_formats",
    sessions: "teacher_sessions",
    trials: "teacher_trials",
    behaviorLogs: "behavior_logs",
    behaviorTypes: "teacher_behavior_types",
  },
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type RequestBody = {
  studentId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
};

type RawGoalRow = {
  id: string;
  text: string;
  status: GoalStatus;
  target_percent: number | null;
  area?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  response_format: ProgressGoal["response_format"];
};

type RawTrialRow = {
  id: string;
  goal_id: string;
  value: Record<string, unknown>;
  session: { id: string; date: string; student_id: string } | null;
};

type RawBehaviorRow = {
  id: string;
  behavior_type: { id: string; name: string; color: string } | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";

  if (
    !studentId ||
    !DATE_RE.test(startDate) ||
    !DATE_RE.test(endDate) ||
    startDate > endDate
  ) {
    return NextResponse.json(
      { error: "Please choose a valid date range." },
      { status: 400 }
    );
  }

  // The account's role — never trust a client-provided role, since RLS on
  // the teacher_*/slp tables is what actually keeps the two sides apart.
  const role = getUserRole(user);
  const tables = TABLES[role];
  const areaSelect =
    role === "teacher" ? "subject:teacher_subjects(id, name)" : "area:areas(id, name)";

  const { data: student } = await supabase
    .from(tables.students)
    .select("id, name, class, expected_frequency, date_of_birth, homeroom_teacher")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const [
    goalsResult,
    trialsResult,
    sessionsInRangeResult,
    attendanceResult,
    behaviorResult,
  ] = await Promise.all([
    supabase
      .from(tables.goals)
      .select(
        `id, text, status, target_percent, ${areaSelect}, response_format:${tables.responseFormats}(id, name, type, config)`
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from(tables.trials)
      .select(
        `id, goal_id, value, created_at, session:${tables.sessions}!inner(id, date, student_id)`
      )
      .eq("session.student_id", studentId)
      .order("created_at", { ascending: true }),
    supabase
      .from(tables.sessions)
      .select("id")
      .eq("student_id", studentId)
      .gte("date", startDate)
      .lte("date", endDate),
    supabase
      .from("attendance_records")
      .select("id, date, reason, reason_note")
      .eq("student_id", studentId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true }),
    supabase
      .from(tables.behaviorLogs)
      .select(`id, behavior_type:${tables.behaviorTypes}(id, name, color)`)
      .eq("student_id", studentId)
      .gte("date", startDate)
      .lte("date", endDate),
  ]);

  const firstError =
    goalsResult.error ||
    trialsResult.error ||
    sessionsInRangeResult.error ||
    attendanceResult.error ||
    behaviorResult.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  // buildGoalReport only cares about a goal's text/status/response_format —
  // "subject" fills the same slot "area" does on the SLP side (same
  // normalization the Teacher progress page does).
  const rawGoals = (goalsResult.data ?? []) as unknown as RawGoalRow[];
  const goals: (ProgressGoal & { target_percent: number | null })[] = rawGoals.map(
    (g) => ({
      id: g.id,
      text: g.text,
      status: g.status,
      area: role === "teacher" ? g.subject ?? null : g.area ?? null,
      response_format: g.response_format,
      target_percent: g.target_percent,
    })
  );

  const rawTrials = (trialsResult.data ?? []) as unknown as RawTrialRow[];
  const trials: ProgressTrial[] = rawTrials
    .filter((t) => t.session !== null)
    .map((t) => ({
      id: t.id,
      goal_id: t.goal_id,
      value: t.value,
      session_date: t.session!.date,
    }));

  // "Had activity in the range" is decided from trials, but each included
  // goal's report is still built from its *full* trial history — same
  // "currently at X%, trending up, since ..." wording the Progress page shows.
  const goalIdsWithActivity = new Set(
    trials
      .filter((t) => t.session_date >= startDate && t.session_date <= endDate)
      .map((t) => t.goal_id)
  );

  const goalEntries: ReportGoalEntry[] = goals
    .filter((g) => goalIdsWithActivity.has(g.id))
    .map((g) => ({
      report: buildGoalReport(g, trials),
      areaName: g.area?.name ?? "—",
      targetPercent: g.target_percent,
    }));

  const absences = (attendanceResult.data ?? []).map((a) => ({
    date: a.date as string,
    reason: a.reason as AttendanceReason | null,
    reasonNote: a.reason_note as string | null,
  }));

  const rawBehaviors = (behaviorResult.data ?? []) as unknown as RawBehaviorRow[];
  const behaviorCounts = new Map<string, number>();
  for (const row of rawBehaviors) {
    const name = row.behavior_type?.name ?? "Deleted type";
    behaviorCounts.set(name, (behaviorCounts.get(name) ?? 0) + 1);
  }
  const behaviorEntries = Array.from(behaviorCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const buffer = await buildStudentReportDocx({
    studentName: student.name,
    studentClass: student.class,
    age: student.date_of_birth ? computeAge(student.date_of_birth) : null,
    homeroomTeacher: student.homeroom_teacher,
    startDate,
    endDate,
    expectedFrequency: student.expected_frequency as ExpectedFrequency,
    actualSessionCount: sessionsInRangeResult.data?.length ?? 0,
    goalEntries,
    absenceCount: absences.length,
    absences,
    behaviorEntries,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="report.docx"',
    },
  });
}
