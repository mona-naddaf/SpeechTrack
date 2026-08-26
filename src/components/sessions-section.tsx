"use client";

import Link from "next/link";
import { CalendarClock, PlayCircle } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { SessionRecord } from "@/lib/types";
import SectionHeader from "./section-header";
import { useSectionPreferences } from "./section-preferences";

type Props = {
  sessions: SessionRecord[];
  error: string | null;
  /** `/students/${id}/session/new` on the SLP side, `/teacher/students/${id}/session/new`
   *  on the Teacher side — same list/empty-state markup otherwise. */
  newSessionHref: string;
};

/** Shared by the SLP and Teacher student pages — sessions/teacher_sessions
 *  have the identical shape, so only the "Start session" link differs. */
export default function SessionsSection({
  sessions,
  error,
  newSessionHref,
}: Props) {
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("sessions");

  return (
    <div>
      <SectionHeader
        icon={CalendarClock}
        title="Sessions"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        actions={
          <Link
            href={newSessionHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
          >
            <PlayCircle className="h-4 w-4" />
            Start session
          </Link>
        }
      />

      {!collapsed && (
        <>
          {error && (
            <p className="mt-4 text-sm text-red-600">
              Couldn&apos;t load sessions: {error}
            </p>
          )}

          {!error && sessions.length === 0 && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <CalendarClock className="h-6 w-6 text-brand-500" />
              </div>
              <p className="text-stone-500">
                No sessions yet — start one to begin tracking progress.
              </p>
            </div>
          )}

          {sessions.length > 0 && (
            <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              {sessions.map((session) => (
                <li key={session.id} className="px-4 py-3 sm:px-5">
                  <p className="font-medium text-stone-900">
                    {formatDate(session.date)}
                  </p>
                  {session.note ? (
                    <p className="mt-1 text-sm text-stone-600">
                      {session.note}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-stone-400">No note</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
