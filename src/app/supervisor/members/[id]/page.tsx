import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, GraduationCap, MessageCircleHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";

/** Placeholder detail view for a linked SLP/Teacher — the read-only
 *  caseload view itself is a later step. For now this just confirms the
 *  link exists (RLS-scoped to the current supervisor) and shows who it's
 *  for. */
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

  const { data: link } = await supabase
    .from("supervisor_links")
    .select("member_id, member_role, member_name, created_at")
    .eq("member_id", id)
    .maybeSingle();

  if (!link) {
    notFound();
  }

  const RoleIcon = link.member_role === "teacher" ? GraduationCap : MessageCircleHeart;

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/supervisor/dashboard"
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100">
            <RoleIcon className="h-6 w-6 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">
              {link.member_name}
            </h1>
            <p className="text-sm capitalize text-stone-500">
              {link.member_role}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="font-semibold text-stone-900">
            Full view coming soon
          </p>
          <p className="mt-1 text-sm text-stone-500">
            A read-only view of {link.member_name}&apos;s caseload will live
            here.
          </p>
        </div>
      </div>
    </main>
  );
}
