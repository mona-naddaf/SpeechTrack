"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, PlayCircle } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { SessionRecord } from "@/lib/types";
import SectionHeader from "./section-header";
import { useSectionPreferences } from "./section-preferences";
import EditSessionModal from "./edit-session-modal";
import LinkifyText from "./linkify-text";

type Props = {
  sessions: SessionRecord[];
  error: string | null;
  /** `/students/${id}/session/new` on the SLP side, `/teacher/students/${id}/session/new`
   *  on the Teacher side — same list/empty-state markup otherwise. */
  newSessionHref: string;
  /** "sessions" for the SLP side, "teacher_sessions" for Teacher — needed
   *  for the per-row "Edit" modal's update call. */
  sessionsTable: "sessions" | "teacher_sessions";
};

/** Shared by the SLP and Teacher student pages — sessions/teacher_sessions
 *  have the identical shape, so only the "Start session" link and table
 *  name differ. Editing here is deliberately limited to a past session's
 *  note + parent-sharing toggle (via EditSessionModal) — not the trial
 *  data itself, which stays a session/new-only, log-as-you-go flow. */
export default function SessionsSection({
  sessions: initialSessions,
  error,
  newSessionHref,
  sessionsTable,
}: Props) {
  const [sessions, setSessions] = useState<SessionRecord[]>(initialSessions);
  const [editingSession, setEditingSession] = useState<SessionRecord | null>(null);
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("sessions");

  function handleSaved(updated: SessionRecord) {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingSession(null);
  }

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
            data-tour="student-start-session"
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
                <li
                  key={session.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-stone-900">
                        {formatDate(session.date)}
                      </p>
                      {session.visible_to_parent && session.note && (
                        <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-800">
                          Shared with parent
                        </span>
                      )}
                    </div>
                    {session.note ? (
                      <p className="mt-1 text-sm text-stone-600">
                        <LinkifyText text={session.note} />
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-stone-400">No note</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingSession(session)}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                  >
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          sessionsTable={sessionsTable}
          onCancel={() => setEditingSession(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
