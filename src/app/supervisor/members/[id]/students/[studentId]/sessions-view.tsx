"use client";

import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { SessionRecord } from "@/lib/types";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";

type Props = {
  sessions: SessionRecord[];
  error: string | null;
};

/** Read-only mirror of SessionsSection — same session list, no "Start
 *  session" link (there's nowhere for it to go: starting a session is a
 *  pure mutation flow with no read-only equivalent, see
 *  session/new/page.tsx on the SLP/Teacher side). Trial-level detail
 *  was never shown standalone anywhere in the app even for the
 *  SLP/Teacher themselves — it only ever surfaces aggregated, via the
 *  Progress page's charts. */
export default function SessionsView({ sessions, error }: Props) {
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
              <p className="text-stone-500">No sessions logged yet.</p>
            </div>
          )}

          {sessions.length > 0 && (
            <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
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
