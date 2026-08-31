import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import DisplayNameSection from "./display-name-section";

/** Account settings — a single shared route (not mirrored per role, unlike
 *  almost everything else in this app) because display_name lives on the
 *  one shared auth.users table, same reasoning as /login, /forgot-password,
 *  /reset-password not being role-specific either. */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = getUserRole(user);
  const backHref =
    role === "teacher"
      ? "/teacher/dashboard"
      : role === "supervisor"
        ? "/supervisor/dashboard"
        : "/dashboard";

  const displayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">Settings</h1>
        </div>

        <div className="mt-6">
          <DisplayNameSection initialDisplayName={displayName} />
        </div>
      </div>
    </main>
  );
}
