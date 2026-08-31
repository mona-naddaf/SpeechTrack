import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { verifySupervisorLink } from "@/lib/supervisor";
import AvatarBadge from "@/components/avatar-badge";
import SupervisorViewingBanner from "@/components/supervisor-viewing-banner";

/** A linked member's caseload, read-only — the supervisor-side mirror of
 *  /dashboard and /teacher/dashboard's student list. Every query here is
 *  scoped by the "Supervisors can view linked members' ..." RLS policies
 *  added in 0023_supervisor_readonly_access.sql, not by anything this
 *  page filters client-side. */
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

  const { data: students, error } =
    link.member_role === "teacher"
      ? await supabase
          .from("teacher_students")
          .select("id, name, class, avatar, created_at")
          .order("created_at", { ascending: false })
      : await supabase
          .from("students")
          .select("id, name, class, avatar, created_at")
          .order("created_at", { ascending: false });

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

          {(students ?? []).length > 0 && (
            <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              {(students ?? []).map((student) => (
                <li key={student.id}>
                  <Link
                    href={`/supervisor/members/${id}/students/${student.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cream-50 sm:px-5"
                  >
                    <AvatarBadge avatar={student.avatar} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-stone-900">
                        {student.name}
                      </p>
                      <p className="truncate text-sm text-stone-500">
                        {student.class || "No class"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
