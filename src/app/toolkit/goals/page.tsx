import Link from "next/link";
import { ArrowLeft, ClipboardList, Library, ListTree, Sliders, Smile, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Area, ResponseFormatOption } from "@/lib/types";
import GoalBankSection, { type BankGoalWithRelations } from "./goal-bank-section";

export default async function GoalBankPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [bankGoalsResult, areasResult, formatsResult] = await Promise.all([
    // Explicit slp_id filter, not just RLS: since 0025_community_sharing_browse.sql
    // added a second permissive SELECT policy allowing *any* account's
    // visibility='shared' rows, RLS alone would also let another SLP's
    // shared bank goals leak into her own goal bank here.
    supabase
      .from("goals")
      .select(
        "id, student_id, area_id, text, response_format_id, target_percent, visibility, created_at, area:areas(id, name), response_format:response_formats(id, name)"
      )
      .eq("slp_id", user.id)
      .is("student_id", null)
      .order("created_at", { ascending: false }),
    supabase.from("areas").select("id, name").order("name", { ascending: true }),
    // Same reasoning — this feeds the response-format dropdown on the
    // bank-goal form, which must only ever offer her own formats.
    supabase
      .from("response_formats")
      .select("id, name")
      .eq("slp_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

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
              href="/toolkit/formats"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Sliders className="h-4 w-4" />
              Response formats
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
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">Goal bank</h1>
          <p className="mt-1 text-stone-600">
            Goals here aren&apos;t tied to a student yet. Add them here once,
            then pick from the bank whenever you set a goal on a student.
          </p>
        </div>

        {bankGoalsResult.error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load the goal bank: {bankGoalsResult.error.message}
          </p>
        )}

        <div className="mt-6">
          <GoalBankSection
            initialGoals={
              (bankGoalsResult.data ?? []) as unknown as BankGoalWithRelations[]
            }
            areas={(areasResult.data ?? []) as Area[]}
            responseFormats={(formatsResult.data ?? []) as ResponseFormatOption[]}
          />
        </div>
      </div>
    </main>
  );
}
