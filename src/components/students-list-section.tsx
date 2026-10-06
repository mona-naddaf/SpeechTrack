"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ChevronRight, RotateCcw, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DayOfWeek, Student, StudentStatus, StudentTag } from "@/lib/types";
import { DAYS_OF_WEEK, DAY_LABELS } from "@/lib/schedule";
import { getColorOption } from "@/lib/colors";
import {
  DEFAULT_LIST_PREFS,
  EMPTY_FILTERS,
  STUDENT_SORT_LABELS,
  STUDENT_STATUSES,
  STUDENT_STATUS_LABELS,
  computeCounts,
  hasActiveFilters,
  matchesFilters,
  parseListPrefs,
  sortStudents,
  type StudentListPrefs,
  type StudentSort,
} from "@/lib/student-list";
import AvatarBadge from "./avatar-badge";
import StudentFormModal, { type StudentFormValues } from "./student-form-modal";
import DeleteStudentConfirmModal from "./delete-student-confirm-modal";
import { StudentStatusBadge, StudentTagChips } from "./student-tag-chips";

/** students and teacher_students have the identical shape (TeacherStudent
 *  is structurally the same type), so one row type serves both. */
type ListStudent = Student;

const STUDENT_COLUMNS =
  "id, name, class, expected_frequency, avatar, scheduled_days, schedule_end_date, created_at, status, archived_at, started_on";

type Props = {
  ownerId: string;
  ownerField: "slp_id" | "teacher_id";
  studentsTable: "students" | "teacher_students";
  tagLinksTable: "student_tag_links" | "teacher_student_tag_links";
  /** "/students" or "/teacher/students". */
  studentBasePath: string;
  /** localStorage key for the saved sort + filters, per role. */
  prefsStorageKey: string;
  initialStudents: ListStudent[];
  initialError: string | null;
  tags: StudentTag[];
  tagLinks: { student_id: string; tag_id: string }[];
  /** Logged sessions per student, for the count strip. */
  sessionCountByStudentId: Record<string, number>;
};

function groupTagIds(links: { student_id: string; tag_id: string }[]) {
  const map: Record<string, string[]> = {};
  for (const l of links) (map[l.student_id] ??= []).push(l.tag_id);
  return map;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** The dashboard student list, shared by the SLP and Teacher sides:
 *  status/tag display, quick status change, archive/restore, sorting,
 *  filtering and the Active-only count strip. Status and archive changes
 *  router.refresh() the page so the server-computed caseload wins and
 *  streak nudges (which leave out Stopped/Archived students) follow. */
export default function StudentsListSection({
  ownerId,
  ownerField,
  studentsTable,
  tagLinksTable,
  studentBasePath,
  prefsStorageKey,
  initialStudents,
  initialError,
  tags,
  tagLinks,
  sessionCountByStudentId,
}: Props) {
  const router = useRouter();
  const [students, setStudents] = useState<ListStudent[]>(initialStudents);
  const [tagIdsByStudent, setTagIdsByStudent] = useState(() => groupTagIds(tagLinks));
  const [prefs, setPrefs] = useState<StudentListPrefs>(DEFAULT_LIST_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<ListStudent | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<ListStudent | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  // Same approach as SectionPreferencesProvider: server and first client
  // render use the defaults (no hydration mismatch), then the saved
  // choice is applied right after mount.
  useEffect(() => {
    try {
      setPrefs(parseListPrefs(localStorage.getItem(prefsStorageKey), new Set(tagsById.keys())));
    } catch {
      // localStorage unavailable — defaults are fine.
    }
    setPrefsLoaded(true);
    // Only on mount, per storage key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsStorageKey]);

  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem(prefsStorageKey, JSON.stringify(prefs));
    } catch {
      // Private browsing — the choice just won't survive a reload.
    }
  }, [prefs, prefsLoaded, prefsStorageKey]);

  const listable = useMemo(
    () => students.map((s) => ({ ...s, tagIds: tagIdsByStudent[s.id] ?? [] })),
    [students, tagIdsByStudent]
  );
  const { filters, sort } = prefs;
  const visible = sortStudents(
    listable.filter((s) => Boolean(s.archived_at) === showArchived && matchesFilters(s, filters)),
    sort
  );
  const counts = computeCounts(listable, filters, sessionCountByStudentId);
  const archivedTotal = students.filter((s) => s.archived_at).length;
  const filtersOn = hasActiveFilters(filters);

  function setFilters(next: Partial<typeof filters>) {
    setPrefs((p) => ({ ...p, filters: { ...p.filters, ...next } }));
  }

  function replaceStudent(updated: ListStudent) {
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  /** Adds/removes link rows so the student ends up with exactly `next`. */
  async function syncTags(studentId: string, next: string[]) {
    const supabase = createClient();
    const current = tagIdsByStudent[studentId] ?? [];
    const removed = current.filter((id) => !next.includes(id));
    const added = next.filter((id) => !current.includes(id));
    if (removed.length > 0) {
      const { error } = await supabase
        .from(tagLinksTable)
        .delete()
        .eq("student_id", studentId)
        .in("tag_id", removed);
      if (error) return error.message;
    }
    if (added.length > 0) {
      const { error } = await supabase
        .from(tagLinksTable)
        .insert(added.map((tag_id) => ({ student_id: studentId, tag_id })));
      if (error) return error.message;
    }
    setTagIdsByStudent((prev) => ({ ...prev, [studentId]: next }));
    return null;
  }

  async function handleAdd(values: StudentFormValues) {
    const { data, error } = await createClient()
      .from(studentsTable)
      .insert({
        [ownerField]: ownerId,
        name: values.name,
        class: values.className || null,
        expected_frequency: values.expectedFrequency,
        avatar: values.avatar,
        scheduled_days: values.scheduledDays,
        schedule_end_date: values.scheduleEndDate,
        status: values.status,
        started_on: values.startedOn,
      })
      .select(STUDENT_COLUMNS)
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }
    setStudents((prev) => [data as ListStudent, ...prev]);
    const tagError = await syncTags(data.id, values.tagIds);
    if (tagError) return `Student added, but tags couldn't be saved: ${tagError}`;
    setShowAddModal(false);
    router.refresh();
    return null;
  }

  async function handleEdit(values: StudentFormValues) {
    if (!editingStudent) return null;
    const { data, error } = await createClient()
      .from(studentsTable)
      .update({
        name: values.name,
        class: values.className || null,
        expected_frequency: values.expectedFrequency,
        avatar: values.avatar,
        scheduled_days: values.scheduledDays,
        schedule_end_date: values.scheduleEndDate,
        // An archived student's status is locked to Stopped (DB CHECK);
        // restoring is the way back.
        ...(editingStudent.archived_at ? {} : { status: values.status }),
        started_on: values.startedOn,
      })
      .eq("id", editingStudent.id)
      .select(STUDENT_COLUMNS)
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }
    replaceStudent(data as ListStudent);
    const tagError = await syncTags(data.id, values.tagIds);
    if (tagError) return `Saved, but tags couldn't be updated: ${tagError}`;
    setEditingStudent(null);
    router.refresh();
    return null;
  }

  async function updateStudent(id: string, patch: Partial<ListStudent>) {
    setRowError(null);
    const { data, error } = await createClient()
      .from(studentsTable)
      .update(patch)
      .eq("id", id)
      .select(STUDENT_COLUMNS)
      .single();
    if (error || !data) {
      setRowError(error?.message ?? "Couldn't update the student.");
      return;
    }
    replaceStudent(data as ListStudent);
    router.refresh();
  }

  async function handleDelete() {
    if (!deletingStudent) return null;
    const { error } = await createClient()
      .from(studentsTable)
      .delete()
      .eq("id", deletingStudent.id);
    if (error) return error.message;
    setStudents((prev) => prev.filter((s) => s.id !== deletingStudent.id));
    setDeletingStudent(null);
    router.refresh();
    return null;
  }

  const notCounted = [
    counts.trial > 0 && `${counts.trial} trial`,
    counts.stopped > 0 && `${counts.stopped} stopped`,
    counts.archived > 0 && `${counts.archived} archived`,
  ].filter(Boolean);

  const pill = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
      active
        ? "bg-brand-700 text-white"
        : "bg-white text-stone-600 ring-1 ring-stone-300 hover:bg-stone-50"
    }`;

  return (
    <div data-tour="dashboard-students">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Users className="h-5 w-5 text-brand-500" />
          {showArchived ? "Archived students" : "Students"}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-pressed={showArchived}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
          >
            <Archive className="h-4 w-4" />
            {showArchived ? "Back to students" : `Archived (${archivedTotal})`}
          </button>
          {!showArchived && (
            <button
              data-tour="dashboard-add-student"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
            >
              <UserPlus className="h-4 w-4" />
              Add student
            </button>
          )}
        </div>
      </div>

      {students.length > 0 && (
        <>
          <div
            data-testid="student-counts"
            className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl bg-accent-50 px-4 py-2.5 text-sm"
          >
            <span className="font-semibold text-accent-800" data-testid="count-active-students">
              {counts.activeStudents} active {counts.activeStudents === 1 ? "student" : "students"}
            </span>
            <span className="text-accent-800" data-testid="count-active-sessions">
              {counts.activeSessions} logged {counts.activeSessions === 1 ? "session" : "sessions"}
            </span>
            {notCounted.length > 0 && (
              <span className="text-xs text-stone-500" data-testid="count-not-counted">
                {notCounted.join(", ")} (not counted)
              </span>
            )}
          </div>

          <div className="mt-3 space-y-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="student-sort" className="text-xs font-medium text-stone-500">
                Sort
              </label>
              <select
                id="student-sort"
                value={sort}
                onChange={(e) => setPrefs((p) => ({ ...p, sort: e.target.value as StudentSort }))}
                className="rounded-lg border border-stone-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {(Object.keys(STUDENT_SORT_LABELS) as StudentSort[]).map((key) => (
                  <option key={key} value={key}>
                    {STUDENT_SORT_LABELS[key]}
                  </option>
                ))}
              </select>
              {filtersOn && (
                <button
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, filters: EMPTY_FILTERS }))}
                  className="ml-auto rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  Clear filters
                </button>
              )}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by tag">
                <span className="w-14 text-xs font-medium text-stone-500">Tags</span>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={filters.tagIds.includes(tag.id)}
                    onClick={() => setFilters({ tagIds: toggle(filters.tagIds, tag.id) })}
                    className={
                      filters.tagIds.includes(tag.id)
                        ? `rounded-full px-2.5 py-1 text-xs font-medium ring-2 ring-stone-900 ${getColorOption(tag.color).badgeClass}`
                        : pill(false)
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by scheduled day">
              <span className="w-14 text-xs font-medium text-stone-500">Days</span>
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={filters.days.includes(day)}
                  onClick={() => setFilters({ days: toggle<DayOfWeek>(filters.days, day) })}
                  className={pill(filters.days.includes(day))}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
              <span className="w-14 text-xs font-medium text-stone-500">Status</span>
              {STUDENT_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  aria-pressed={filters.statuses.includes(st)}
                  onClick={() => setFilters({ statuses: toggle<StudentStatus>(filters.statuses, st) })}
                  className={pill(filters.statuses.includes(st))}
                >
                  {STUDENT_STATUS_LABELS[st]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {initialError && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load students: {initialError}
        </p>
      )}
      {rowError && <p className="mt-4 text-sm text-red-600">{rowError}</p>}

      {!initialError && students.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Users className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No students yet — add your first one to start tracking progress.
          </p>
        </div>
      )}

      {students.length > 0 && visible.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
          {showArchived
            ? filtersOn
              ? "No archived students match these filters."
              : "No archived students."
            : "No students match these filters."}
        </p>
      )}

      {visible.length > 0 && (
        <ul
          data-testid="student-list"
          className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          {visible.map((student) => {
            const stopped = student.status === "stopped";
            const studentTags = student.tagIds
              .map((id) => tagsById.get(id))
              .filter((t): t is StudentTag => Boolean(t));
            return (
              <li
                key={student.id}
                data-testid="student-row"
                data-student-name={student.name}
                data-status={student.status}
                className="flex flex-wrap items-center justify-between gap-x-3 px-4 py-1 transition-colors hover:bg-cream-50 sm:px-5"
              >
                <Link
                  href={`${studentBasePath}/${student.id}`}
                  className={`flex min-w-0 flex-1 items-center gap-3 py-3 ${
                    stopped ? "opacity-50" : ""
                  }`}
                >
                  <AvatarBadge avatar={student.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-medium text-stone-900">{student.name}</span>
                      <StudentStatusBadge status={student.status} archived={Boolean(student.archived_at)} />
                    </p>
                    <p className="truncate text-sm text-stone-500">
                      {student.class || "No class"}
                    </p>
                    {studentTags.length > 0 && (
                      <div className="mt-1">
                        <StudentTagChips tags={studentTags} />
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  {student.archived_at ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateStudent(student.id, { archived_at: null, status: "active" })
                      }
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </button>
                  ) : (
                    <>
                      <select
                        aria-label={`Status for ${student.name}`}
                        value={student.status}
                        onChange={(e) =>
                          updateStudent(student.id, { status: e.target.value as StudentStatus })
                        }
                        className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600 focus:border-brand-500 focus:outline-none"
                      >
                        {STUDENT_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {STUDENT_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                      {stopped && (
                        <button
                          type="button"
                          onClick={() =>
                            updateStudent(student.id, { archived_at: new Date().toISOString() })
                          }
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                        >
                          Archive
                        </button>
                      )}
                      <button
                        onClick={() => setEditingStudent(student)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingStudent(student)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showAddModal && (
        <StudentFormModal
          mode="add"
          availableTags={tags}
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingStudent && (
        <StudentFormModal
          mode="edit"
          initialStudent={editingStudent}
          initialTagIds={tagIdsByStudent[editingStudent.id] ?? []}
          availableTags={tags}
          onCancel={() => setEditingStudent(null)}
          onSubmit={handleEdit}
        />
      )}

      {deletingStudent && (
        <DeleteStudentConfirmModal
          student={deletingStudent}
          onCancel={() => setDeletingStudent(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
