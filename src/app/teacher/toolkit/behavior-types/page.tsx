import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ListChecks, Sliders } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import type { TeacherBehaviorType } from "@/lib/types";
import BehaviorTypesSection from "./behavior-types-section";

export default async function TeacherBehaviorTypesPage() {
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

  const { data: behaviorTypes, error } = await supabase
    .from("teacher_behavior_types")
    .select("id, name, color")
    .order("name", { ascending: true });

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
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">
            Behavior types
          </h1>
          <p className="mt-1 text-stone-600">
            These are the tags you can log against a student&apos;s
            behavior, each with its own color.
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load behavior types: {error.message}
          </p>
        )}

        <div className="mt-6">
          <BehaviorTypesSection
            initialBehaviorTypes={(behaviorTypes ?? []) as TeacherBehaviorType[]}
          />
        </div>
      </div>
    </main>
  );
}
