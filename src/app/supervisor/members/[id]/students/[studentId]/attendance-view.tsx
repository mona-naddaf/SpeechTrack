"use client";

import { CalendarX } from "lucide-react";
import { formatDate } from "@/lib/date";
import { ATTENDANCE_REASON_LABELS } from "@/lib/attendance";
import type { AttendanceRecord } from "@/lib/types";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";

type Props = {
  records: AttendanceRecord[];
  error: string | null;
};

/** Read-only mirror of AttendanceSection — same history list, no "Mark
 *  absent" button. */
export default function AttendanceView({ records, error }: Props) {
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("attendance");

  return (
    <div>
      <SectionHeader
        icon={CalendarX}
        title="Attendance"
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
              Couldn&apos;t load attendance: {error}
            </p>
          )}

          {!error && records.length === 0 && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <CalendarX className="h-6 w-6 text-brand-500" />
              </div>
              <p className="text-stone-500">No absences logged.</p>
            </div>
          )}

          {records.length > 0 && (
            <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              {records.map((record) => (
                <li key={record.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-900">
                      {formatDate(record.date)}
                    </span>
                    {record.reason && (
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                        {ATTENDANCE_REASON_LABELS[record.reason]}
                      </span>
                    )}
                  </div>
                  {record.reason_note && (
                    <p className="mt-1 text-sm text-stone-600">
                      {record.reason_note}
                    </p>
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
