import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, MessageCircleHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import SignOutButton from "./sign-out-button";
import GenerateInviteCodeCard from "./generate-invite-code-card";

export default async function SupervisorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route, but a Server Component should
  // never trust that alone — check again before rendering anything.
  if (!user) {
    redirect("/login");
  }

  // This dashboard is Supervisor-only — an SLP or Teacher account belongs
  // on its own dashboard.
  const role = getUserRole(user);
  if (role !== "supervisor") {
    redirect(role === "teacher" ? "/teacher/dashboard" : "/dashboard");
  }

  const [linksResult, latestCodeResult] = await Promise.all([
    supabase
      .from("supervisor_links")
      .select("id, member_id, member_role, member_name, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("supervisor_invite_codes")
      .select("code")
      .is("used_by", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const links = linksResult.data ?? [];

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const displayName = fullName || user.email;

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">
            Welcome, {displayName} <span aria-hidden>👋</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <SignOutButton />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <GenerateInviteCodeCard
            userId={user.id}
            initialCode={latestCodeResult.data?.code ?? null}
          />
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">
              Linked SLPs &amp; Teachers
            </h2>
            <span className="text-sm text-stone-500">
              {links.length} linked
            </span>
          </div>

          {links.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
              No one&apos;s linked yet. Generate an invite code above and
              share it with an SLP or Teacher to get started.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {links.map((link) => {
                const RoleIcon =
                  link.member_role === "teacher" ? GraduationCap : MessageCircleHeart;
                return (
                  <li key={link.id}>
                    <Link
                      href={`/supervisor/members/${link.member_id}`}
                      className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100">
                        <RoleIcon className="h-5 w-5 text-brand-600" />
                      </div>
                      <span className="flex-1">
                        <span className="block font-semibold text-stone-900">
                          {link.member_name}
                        </span>
                        <span className="block text-sm capitalize text-stone-500">
                          {link.member_role} · Linked{" "}
                          {new Date(link.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
