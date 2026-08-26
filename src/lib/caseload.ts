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

/** Per-student streaks (each student's own sessions + their own
 *  expected_frequency), sorted longest-first. Shared by the SLP and
 *  Teacher dashboards — both the "longest streak" caseload-wins stat and
 *  the "at risk" nudge list are built from this one pass over the
 *  caseload, so the cadence math runs once per dashboard load. */
export function computeCaseloadStreaks(
  students: CaseloadStudent[],
  sessionDatesByStudentId: Map<string, string[]>,
  today: string
): StudentStreak[] {
  return students
    .map((s) => ({
      studentId: s.id,
      name: s.name,
      streak: computeCadenceStreak(
        sessionDatesByStudentId.get(s.id) ?? [],
        s.expected_frequency,
        today
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
  limit = 2
): StudentStreak[] {
  return students
    .filter((s) =>
      isStreakAtRisk(
        sessionDatesByStudentId.get(s.id) ?? [],
        s.expected_frequency,
        today
      )
    )
    .map((s) => ({
      studentId: s.id,
      name: s.name,
      streak: computeCadenceStreak(
        sessionDatesByStudentId.get(s.id) ?? [],
        s.expected_frequency,
        today
      ),
    }))
    .sort((a, b) => b.streak - a.streak)
    .slice(0, limit);
}

/** Groups a flat list of {student_id, date} session rows into a
 *  Map<student_id, date[]> — the shape computeCaseloadStreaks() and
 *  findAtRiskStreaks() both expect. */
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
