import { computeCadenceStreak, isStreakAtRisk } from "./streaks";
import type { ExpectedFrequency } from "./types";

export type CaseloadStudent = {
  id: string;
  name: string;
  expected_frequency: ExpectedFrequency;
};

export type StudentStreak = {
  studentId: string;
  name: string;
  streak: number;
};

/** Per-student streaks (each student's own sessions, excused absences,
 *  and their own expected_frequency), sorted longest-first. Shared by the
 *  SLP and Teacher dashboards — both the "longest streak" caseload-wins
 *  stat and the "at risk" nudge list are built from this one pass over
 *  the caseload, so the cadence math runs once per dashboard load.
 *
 *  absentDatesByStudentId defaults to an empty map so existing callers
 *  that don't track attendance still work unchanged. */
export function computeCaseloadStreaks(
  students: CaseloadStudent[],
  sessionDatesByStudentId: Map<string, string[]>,
  today: string,
  absentDatesByStudentId: Map<string, string[]> = new Map()
): StudentStreak[] {
  return students
    .map((s) => ({
      studentId: s.id,
      name: s.name,
      streak: computeCadenceStreak(
        sessionDatesByStudentId.get(s.id) ?? [],
        s.expected_frequency,
        today,
        absentDatesByStudentId.get(s.id) ?? []
      ),
    }))
    .sort((a, b) => b.streak - a.streak);
}

/** Students whose active streak is genuinely about to break (see
 *  isStreakAtRisk in streaks.ts), longest streak first and capped to
 *  `limit` — the dashboard nudge should never pile on more than a couple
 *  at once, even if a large caseload has many at risk the same day. */
export function findAtRiskStreaks(
  students: CaseloadStudent[],
  sessionDatesByStudentId: Map<string, string[]>,
  today: string,
  absentDatesByStudentId: Map<string, string[]> = new Map(),
  limit = 2
): StudentStreak[] {
  return students
    .filter((s) =>
      isStreakAtRisk(
        sessionDatesByStudentId.get(s.id) ?? [],
        s.expected_frequency,
        today,
        absentDatesByStudentId.get(s.id) ?? []
      )
    )
    .map((s) => ({
      studentId: s.id,
      name: s.name,
      streak: computeCadenceStreak(
        sessionDatesByStudentId.get(s.id) ?? [],
        s.expected_frequency,
        today,
        absentDatesByStudentId.get(s.id) ?? []
      ),
    }))
    .sort((a, b) => b.streak - a.streak)
    .slice(0, limit);
}

/** Adds the same shared set of dates (the practice's holidays) onto
 *  every student's own per-student date list, producing the combined
 *  shape computeCaseloadStreaks()/findAtRiskStreaks() expect for
 *  absentDatesByStudentId. A holiday isn't specific to one student the
 *  way an excused attendance_records absence is -- it protects every
 *  student's streak on that same calendar day -- so this is the one
 *  place that folds "this student's own excused absences" and "the
 *  practice's holidays" into a single list, rather than each caller
 *  re-deriving that merge itself. Students with no individual absences
 *  yet still get the holiday dates (that's the whole point), which is
 *  why this builds a fresh map from `studentIds` rather than just
 *  mutating whatever's already in `datesByStudentId`. */
export function addSharedDatesToEveryStudent(
  datesByStudentId: Map<string, string[]>,
  studentIds: string[],
  sharedDates: string[]
): Map<string, string[]> {
  const merged = new Map<string, string[]>();
  for (const id of studentIds) {
    merged.set(id, [...(datesByStudentId.get(id) ?? []), ...sharedDates]);
  }
  return merged;
}

/** Groups a flat list of {student_id, date} rows into a
 *  Map<student_id, date[]> — the shape computeCaseloadStreaks() and
 *  findAtRiskStreaks() both expect, for either sessions or attendance
 *  records. */
export function groupDatesByStudent(
  rows: { student_id: string; date: string }[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.student_id) ?? [];
    list.push(row.date);
    map.set(row.student_id, list);
  }
  return map;
}
