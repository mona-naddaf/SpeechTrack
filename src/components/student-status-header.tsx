"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StudentStatus, StudentTag } from "@/lib/types";
import { StudentStatusBadge, StudentTagChips } from "./student-tag-chips";

type Props = {
  studentId: string;
  status: StudentStatus;
  archivedAt: string | null;
  tags: StudentTag[];
  /** Omit for the supervisor's read-only page: badge + chips only. */
  studentsTable?: "students" | "teacher_students";
};

/** Status badge + tag chips under the student page title, plus Archive
 *  (Stopped students only) / Restore (archived students, back to Active)
 *  for the SLP/Teacher. Archiving only sets archived_at — every session,
 *  goal, attendance record and package stays exactly as it was. */
export default function StudentStatusHeader({
  studentId,
  status,
  archivedAt,
  tags,
  studentsTable,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(patch: { archived_at: string | null; status?: StudentStatus }) {
    if (!studentsTable) return;
    setLoading(true);
    setError(null);
    const { data, error } = await createClient()
      .from(studentsTable)
      .update(patch)
      .eq("id", studentId)
      .select("id");
    setLoading(false);
    if (error || !data || data.length === 0) {
      setError(error?.message ?? "Couldn't update the student.");
      return;
    }
    router.refresh();
  }

  if (status === "active" && !archivedAt && tags.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="student-status-header">
      <StudentStatusBadge status={status} archived={Boolean(archivedAt)} />
      <StudentTagChips tags={tags} />
      {studentsTable && status === "stopped" && !archivedAt && (
        <button
          type="button"
          onClick={() => update({ archived_at: new Date().toISOString() })}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-50"
        >
          <Archive className="h-3.5 w-3.5" />
          Archive
        </button>
      )}
      {studentsTable && archivedAt && (
        <button
          type="button"
          onClick={() => update({ archived_at: null, status: "active" })}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restore
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
