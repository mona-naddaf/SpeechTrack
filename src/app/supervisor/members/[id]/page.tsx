import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Archive, ChevronRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { verifySupervisorLink } from "@/lib/supervisor";
import AvatarBadge from "@/components/avatar-badge";
import SupervisorViewingBanner from "@/components/supervisor-viewing-banner";
import { StudentStatusBadge, StudentTagChips } from "@/components/student-tag-chips";
import { sortStudents } from "@/lib/student-list";
import type { StudentStatus, StudentTag } from "@/lib/types";

type SupervisorListStudent = {
  id: string;
  name: string;
  class: string | null;
  avatar: string | null;
  status: StudentStatus;
  archived_at: string | null;
  started_on: string | null;
  scheduled_days: [];
  tags: StudentTag[];
  tagIds: string[];
};

/** A linked member's caseload, read-only — the supervisor-side mirror of
 *  /dashboard and /teacher/dashboard's student list. RLS (the
 *  "Supervisors can view linked members' ..." policies added in
 *  0023_supervisor_readonly_access.sql) is what makes any of this
 *  readable at all, but it alone isn't enough to scope the students
 *  query to *this one* member — see the explicit .eq() filter below. */
export default async function SupervisorMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = getUserRole(user);
  if (role !== "supervisor") {
    redirect(role === "teacher" ? "/teacher/dashboard" : "/dashboard");
  }

  // Never trust the `id` route param on its own — this only returns a
  // row when the signed-in supervisor is actually linked to it.
  const link = await verifySupervisorLink(supabase, id);
  if (!link) {
    notFound();
  }

  // Explicit owner filter, not just RLS: 0023's is_supervisor_of()
  // policy makes every one of the supervisor's *linked members'* rows on
  // this table visible, not just this one member's -- without this
  // filter, a supervisor linked to more than one Teacher/SLP would see
  // every linked member's students combined on what's supposed to be
  // this one member's own caseload page. Same category of bug as the
  // behavior_types leak on the student detail page, found while
  // verifying that fix.
  const { data: students, error } =
    link.member_role === "teacher"
      ? await supabase
          .from("teacher_students")
          .select("id, name, class, avatar, created_at, status, archived_at, started_on")
          .eq("teacher_id", id)
          .order("created_at", { ascending: false })
      : await supabase
          .from("students")
          .select("id, name, class, avatar, created_at, status, archived_at, started_on")
          .eq("slp_id", id)
          .order("created_at", { ascending: false });

  // Tags: explicit owner filter for the same reason as the students
  // query above (is_supervisor_of() exposes every linked member's tags).
  // Links are narrowed to this member's students.
  const isTeacher = link.member_role === "teacher";
  const studentIds = (students ?? []).map((s) => s.id);
  const [tagsResult, linksResult] = await Promise.all([
    isTeacher
      ? supabase.from("teacher_student_tags").select("id, name, color").eq("teacher_id", id)
      : supabase.from("student_tags").select("id, name, color").eq("slp_id", id),
    studentIds.length === 0
      ? Promise.resolve({ data: [] as { student_id: string; tag_id: string }[] })
      : isTeacher
        ? supabase.from("teacher_student_tag_links").select("student_id, tag_id").in("student_id", studentIds)
        : supabase.from("student_tag_links").select("student_id, tag_id").in("student_id", studentIds),
  ]);
  const tagsById = new Map(
    ((tagsResult.data ?? []) as StudentTag[]).map((t) => [t.id, t])
  );
  const tagIdsByStudent: Record<string, string[]> = {};
  for (const l of linksResult.data ?? []) (tagIdsByStudent[l.student_id] ??= []).push(l.tag_id);

  const listed: SupervisorListStudent[] = (students ?? []).map((s) => {
    const tagIds = tagIdsByStudent[s.id] ?? [];
    return {
      ...s,
      scheduled_days: [],
      tagIds,
      tags: tagIds
        .map((tid) => tagsById.get(tid))
        .filter((t): t is StudentTag => Boolean(t))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
  const current = sortStudents(listed.filter((s) => !s.archived_at), "name_asc");
  const archived = sortStudents(listed.filter((s) => s.archived_at), "name_asc");

  function renderRow(student: SupervisorListStudent) {
    return (
      <li key={student.id} data-testid="student-row" data-student-name={student.name}>
        <Link
          href={`/supervisor/members/${id}/students/${student.id}`}
          className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cream-50 sm:px-5 ${
            student.status === "stopped" ? "opacity-50" : ""
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
            {student.tags.length > 0 && (
              <div className="mt-1">
                <StudentTagChips tags={student.tags} />
              </div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
        </Link>
      </li>
    );
  }

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <SupervisorViewingBanner memberName={link.member_name} />

        <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">
          {link.member_name}&apos;s caseload
        </h1>
        <p className="mt-1 text-sm capitalize text-stone-500">
          {link.member_role}
        </p>

        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
            <Users className="h-5 w-5 text-brand-500" />
            Students
          </h2>

          {error && (
            <p className="mt-4 text-sm text-red-600">
              Couldn&apos;t load students: {error.message}
            </p>
          )}

          {!error && (students ?? []).length === 0 && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <Users className="h-6 w-6 text-brand-500" />
              </div>
              <p className="text-stone-500">No students yet.</p>
            </div>
          )}

          {current.length > 0 && (
            <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              {current.map(renderRow)}
            </ul>
          )}

          {archived.length > 0 && (
            <details className="mt-6" data-testid="supervisor-archived">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-stone-700">
                <Archive className="h-4 w-4 text-stone-400" />
                Archived ({archived.length})
              </summary>
              <ul className="mt-3 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                {archived.map(renderRow)}
              </ul>
            </details>
          )}
        </div>
      </div>
    </main>
  );
}
