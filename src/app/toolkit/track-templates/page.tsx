import Link from "next/link";
import { ArrowLeft, ClipboardList, Gamepad2, Library, Sliders, Smile, Target, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Area, TrackTemplateWithArea } from "@/lib/types";
import TrackTemplatesList from "./track-templates-list";

export default async function TrackTemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [templatesResult, stepCountsResult, areasResult] = await Promise.all([
    supabase
      .from("track_templates")
      .select("id, slp_id, name, area_id, created_at, area:areas(id, name)")
      .order("created_at", { ascending: false }),
    supabase.from("track_template_steps").select("template_id"),
    supabase.from("areas").select("id, name").order("name", { ascending: true }),
  ]);
  const { error } = templatesResult;

  const stepCountByTemplateId = new Map<string, number>();
  for (const row of stepCountsResult.data ?? []) {
    stepCountByTemplateId.set(
      row.template_id,
      (stepCountByTemplateId.get(row.template_id) ?? 0) + 1
    );
  }

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
          <h1 className="text-2xl font-bold text-stone-900">Track templates</h1>
          <p className="mt-1 text-stone-600">
            Reusable, ordered step sequences for a treatment-plan track.
            Build one from scratch here, or save one from an existing
            student&apos;s track — either way, apply it to any student to
            create a new track with all its steps assigned in order.
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load track templates: {error.message}
          </p>
        )}

        <div className="mt-6">
          <TrackTemplatesList
            initialTemplates={
              (templatesResult.data ?? []) as unknown as TrackTemplateWithArea[]
            }
            stepCountByTemplateId={Object.fromEntries(stepCountByTemplateId)}
            areas={(areasResult.data ?? []) as Area[]}
          />
        </div>
      </div>
    </main>
  );
}
