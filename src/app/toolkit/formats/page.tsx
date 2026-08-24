import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormatsList from "./formats-list";

export default async function ResponseFormatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: formats, error } = await supabase
    .from("response_formats")
    .select("id, name, type, config, created_at")
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            &larr; Back to dashboard
          </Link>
          <Link
            href="/toolkit/goals"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Goal bank
          </Link>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Response formats
          </h1>
          <p className="mt-1 text-slate-600">
            These are the ways you can score a student&apos;s response during
            a session. Build your own from scratch, or edit the defaults.
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load response formats: {error.message}
          </p>
        )}

        <div className="mt-6">
          <FormatsList initialFormats={formats ?? []} />
        </div>
      </div>
    </main>
  );
}
