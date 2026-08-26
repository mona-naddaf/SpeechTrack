"use client";

import { useState } from "react";
import { CalendarX, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";
import { ATTENDANCE_REASON_LABELS } from "@/lib/attendance";
import type { AttendanceRecord } from "@/lib/types";
import SectionHeader from "./section-header";
import { useSectionPreferences } from "./section-preferences";
import MarkAbsentModal, { type MarkAbsentValues } from "./mark-absent-modal";

type Props = {
  studentId: string;
  /** The signed-in SLP's or Teacher's own id — written into whichever of
   *  attendance_records.slp_id / teacher_id `ownerField` names, since
   *  that's the one shared table both sides write to (see
   *  0015_schedule_and_attendance.sql). */
  ownerId: string;
  ownerField: "slp_id" | "teacher_id";
  initialRecords: AttendanceRecord[];
  initialError: string | null;
};

/** "Mark absent" + a small attendance history list — shared by the SLP
 *  and Teacher student pages, since attendance_records is one table for
 *  both. Marking an absence here is also what src/lib/streaks.ts treats
 *  as a "protected" day: it doesn't count as a session, but it doesn't
 *  break a streak either. */
export default function AttendanceSection({
  studentId,
  ownerId,
  ownerField,
  initialRecords,
  initialError,
}: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [listError] = useState<string | null>(initialError);
  const [showModal, setShowModal] = useState(false);
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("attendance");

  async function handleAdd(values: MarkAbsentValues) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("attendance_records")
      .insert({
        [ownerField]: ownerId,
        student_id: studentId,
        date: values.date,
        reason: values.reason,
        reason_note: values.reasonNote || null,
      })
      .select("id, student_id, date, reason, reason_note, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setRecords((prev) =>
      [...prev, data].sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.created_at.localeCompare(a.created_at)
      )
    );
    setShowModal(false);
    return null;
  }

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
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Mark absent
          </button>
        }
      />

      {!collapsed && (
        <>
      {listError && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load attendance: {listError}
        </p>
      )}

      {!listError && records.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <CalendarX className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">No absences logged.</p>
        </div>
      )}

      {records.length > 0 && (
        <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
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

      {showModal && (
        <MarkAbsentModal
          onCancel={() => setShowModal(false)}
          onSubmit={handleAdd}
        />
      )}
    </div>
  );
}
