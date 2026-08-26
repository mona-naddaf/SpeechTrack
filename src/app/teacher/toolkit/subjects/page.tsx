import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ListChecks, Smile } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import type { ResponseFormat, TeacherSubject } from "@/lib/types";
import SubjectsSection from "./subjects-section";
import FormatsList from "./formats-list";

export default async function TeacherSubjectsPage() {
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

  const [subjectsResult, formatsResult] = await Promise.all([
    supabase
      .from("teacher_subjects")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("teacher_response_formats")
      .select("id, name, type, config, created_at")
      .order("created_at", { ascending: true }),
  ]);

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
              href="/teacher/toolkit/behavior-types"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Smile className="h-4 w-4" />
              Behavior types
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">
            Subjects &amp; response formats
          </h1>
          <p className="mt-1 text-stone-600">
            Subjects group goals by classwork area. Response formats are the
            ways you can score a student&apos;s response — build your own
            from scratch, or edit the default.
          </p>
        </div>

        {subjectsResult.error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load subjects: {subjectsResult.error.message}
          </p>
        )}

        <div className="mt-6">
          <SubjectsSection
            initialSubjects={(subjectsResult.data ?? []) as TeacherSubject[]}
          />
        </div>

        {formatsResult.error && (
          <p className="mt-8 text-sm text-red-600">
            Couldn&apos;t load response formats: {formatsResult.error.message}
          </p>
        )}

        <div className="mt-8">
          <FormatsList
            initialFormats={(formatsResult.data ?? []) as ResponseFormat[]}
          />
        </div>
      </div>
    </main>
  );
}
