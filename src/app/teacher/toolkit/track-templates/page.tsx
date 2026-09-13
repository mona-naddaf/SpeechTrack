import Link from "next/link";
import { ArrowLeft, Library, ListChecks, Sliders, Smile, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import type { TeacherSubject, TeacherTrackTemplateWithSubject } from "@/lib/types";
import TrackTemplatesList from "./track-templates-list";

export default async function TeacherTrackTemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (getUserRole(user) !== "teacher") {
    redirect("/dashboard");
  }

  const [templatesResult, stepCountsResult, subjectsResult] = await Promise.all([
    supabase
      .from("teacher_track_templates")
      .select("id, teacher_id, name, subject_id, created_at, subject:teacher_subjects(id, name)")
      .order("created_at", { ascending: false }),
    supabase.from("teacher_track_template_steps").select("template_id"),
    supabase.from("teacher_subjects").select("id, name").order("name", { ascending: true }),
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
            href="/teacher/dashboard"
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/teacher/toolkit/goals"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ListChecks className="h-4 w-4" />
              Goal bank
            </Link>
            <Link
              href="/teacher/toolkit/subjects"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Sliders className="h-4 w-4" />
              Subjects &amp; formats
            </Link>
            <Link
              href="/teacher/toolkit/behavior-types"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Smile className="h-4 w-4" />
              Behavior types
            </Link>
            <Link
              href="/teacher/toolkit/materials"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Library className="h-4 w-4" />
              Materials
            </Link>
            <Link
              href="/teacher/toolkit/community"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Users className="h-4 w-4" />
              Community
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
              (templatesResult.data ?? []) as unknown as TeacherTrackTemplateWithSubject[]
            }
            stepCountByTemplateId={Object.fromEntries(stepCountByTemplateId)}
            subjects={(subjectsResult.data ?? []) as TeacherSubject[]}
          />
        </div>
      </div>
    </main>
  );
}
