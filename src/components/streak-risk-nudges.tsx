"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { StudentStreak } from "@/lib/caseload";

type Props = {
  atRiskStudents: StudentStreak[];
  /** e.g. (id) => `/students/${id}` on the SLP side, `/teacher/students/${id}`
   *  on the Teacher side — the two dashboards link into different trees. */
  studentHref: (studentId: string) => string;
};

/** Warm, easy-to-ignore nudges for streaks that are about to break (see
 *  isStreakAtRisk in src/lib/streaks.ts) — already capped to at most a
 *  couple of students by findAtRiskStreaks(), and each one can be
 *  dismissed on the spot if it's not useful right now. Nothing is
 *  persisted: dismissing just clears it from this page view, and it'll
 *  reappear next visit if the streak is still at risk then. */
export default function StreakRiskNudges({ atRiskStudents, studentHref }: Props) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visible = atRiskStudents.filter((s) => !dismissedIds.has(s.studentId));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((student) => (
        <div
          key={student.studentId}
          className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 px-4 py-2.5 text-sm text-stone-700"
        >
          <Link
            href={studentHref(student.studentId)}
            className="flex-1 hover:underline"
          >
            Don&apos;t forget {student.name} today to keep their{" "}
            {student.streak}-streak going! 💛
          </Link>
          <button
            type="button"
            onClick={() =>
              setDismissedIds((prev) => new Set(prev).add(student.studentId))
            }
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
