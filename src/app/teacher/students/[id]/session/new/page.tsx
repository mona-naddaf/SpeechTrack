import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import type { TeacherSessionGoal } from "@/lib/types";
import AvatarBadge from "@/components/avatar-badge";
import NewSessionForm from "./new-session-form";

export default async function NewTeacherSessionPage({
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

  if (getUserRole(user) !== "teacher") {
    redirect("/dashboard");
  }

  const { data: student } = await supabase
    .from("teacher_students")
    .select("id, name, class, avatar")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  const { data: goals, error } = await supabase
    .from("teacher_goals")
    .select(
      "id, text, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name, type, config)"
    )
    .eq("student_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/teacher/students/${student.id}`}
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {student.name}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-stone-900">
          New session
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <AvatarBadge avatar={student.avatar} size="sm" />
          <p className="text-stone-600">{student.name}</p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load goals: {error.message}
          </p>
        )}

        <div className="mt-6">
          <NewSessionForm
            studentId={student.id}
            goals={(goals ?? []) as unknown as TeacherSessionGoal[]}
          />
        </div>
      </div>
    </main>
  );
}
