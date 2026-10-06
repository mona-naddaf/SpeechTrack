import Link from "next/link";
import { ArrowLeft, ClipboardList, Gamepad2, Library, ListTree, Smile, Target, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormatsList from "./formats-list";
import { resolveDefaultFormatId } from "@/lib/default-format";

export default async function ResponseFormatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Explicit slp_id filter, not just RLS: since
  // 0025_community_sharing_browse.sql added a second permissive SELECT
  // policy allowing *any* account's visibility='shared' rows, RLS alone
  // would also let another SLP's shared formats leak into this list.
  const { data: formats, error } = await supabase
    .from("response_formats")
    .select("id, name, type, config, visibility, created_at")
    .eq("slp_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/toolkit/assessments"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ClipboardList className="h-4 w-4" />
              Assessments
            </Link>
            <Link
              href="/toolkit/goals"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Target className="h-4 w-4" />
              Goal bank
            </Link>
            <Link
              href="/toolkit/behavior-types"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Smile className="h-4 w-4" />
              Behavior types
            </Link>
            <Link
              href="/toolkit/materials"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Library className="h-4 w-4" />
              Materials
            </Link>
            <Link
              href="/toolkit/track-templates"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ListTree className="h-4 w-4" />
              Track templates
            </Link>
            <Link
              href="/toolkit/community"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Users className="h-4 w-4" />
              Community
            </Link>
            <Link
              href="/toolkit/reinforcement-boards"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Gamepad2 className="h-4 w-4" />
              Reinforcement bank
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">
            Response formats
          </h1>
          <p className="mt-1 text-stone-600">
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
          <FormatsList
            initialFormats={formats ?? []}
            initialDefaultFormatId={resolveDefaultFormatId(user, formats ?? [])}
          />
        </div>
      </div>
    </main>
  );
}
