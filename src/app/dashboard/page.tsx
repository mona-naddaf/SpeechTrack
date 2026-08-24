import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";
import StudentsSection from "./students-section";
import NamePromptModal from "./name-prompt-modal";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route, but a Server Component should
  // never trust that alone — check again before rendering anything.
  if (!user) {
    redirect("/login");
  }

  const { data: students, error } = await supabase
    .from("students")
    .select("id, name, class, created_at")
    .order("created_at", { ascending: false });

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const displayName = fullName || user.email;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Welcome, {displayName}
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/toolkit/goals"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Goal bank
            </Link>
            <Link
              href="/toolkit/formats"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Response formats
            </Link>
            <SignOutButton />
          </div>
        </div>

        <div className="mt-8">
          <StudentsSection
            userId={user.id}
            initialStudents={students ?? []}
            initialError={error?.message ?? null}
          />
        </div>
      </div>

      {!fullName && <NamePromptModal userId={user.id} />}
    </main>
  );
}
