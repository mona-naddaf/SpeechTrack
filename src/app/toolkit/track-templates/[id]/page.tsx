import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Area, ResponseFormatOption, TrackTemplateStepWithRelations, TrackTemplateWithArea } from "@/lib/types";
import TrackTemplateEditor from "./track-template-editor";

export default async function TrackTemplateEditorPage({
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

  // RLS scopes this to templates owned by the signed-in SLP, so a
  // template that exists but belongs to someone else comes back as no
  // row, not an error.
  const { data: template } = await supabase
    .from("track_templates")
    .select("id, slp_id, name, area_id, created_at, area:areas(id, name)")
    .eq("id", id)
    .maybeSingle();

  if (!template) {
    notFound();
  }

  const [stepsResult, areasResult, formatsResult] = await Promise.all([
    supabase
      .from("track_template_steps")
      .select(
        "id, template_id, order_index, goal_text, response_format_id, target_percent, created_at, response_format:response_formats(id, name)"
      )
      .eq("template_id", id)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("areas").select("id, name").order("name", { ascending: true }),
    // Explicit slp_id filter, not just RLS — same reasoning as every other
    // response-format dropdown in this app (0025_community_sharing_browse.sql).
    supabase
      .from("response_formats")
      .select("id, name")
      .eq("slp_id", user.id)
      .order("created_at", { ascending: true }),
  ]);
  const { data: steps, error } = stepsResult;

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/toolkit/track-templates"
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to track templates
        </Link>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load steps: {error.message}
          </p>
        )}

        <div className="mt-6">
          <TrackTemplateEditor
            template={template as unknown as TrackTemplateWithArea}
            initialSteps={(steps ?? []) as unknown as TrackTemplateStepWithRelations[]}
            areas={(areasResult.data ?? []) as Area[]}
            responseFormats={(formatsResult.data ?? []) as ResponseFormatOption[]}
          />
        </div>
      </div>
    </main>
  );
}
