import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SessionGoal } from "@/lib/types";
import NewSessionForm from "./new-session-form";

export default async function NewSessionPage({
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

  const { data: student } = await supabase
    .from("students")
    .select("id, name, class")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  const { data: goals, error } = await supabase
    .from("goals")
    .select(
      "id, text, area:areas(id, name), response_format:response_formats(id, name, type, config)"
    )
    .eq("student_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/students/${student.id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Back to {student.name}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          New session
        </h1>
        <p className="mt-1 text-slate-600">{student.name}</p>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load goals: {error.message}
          </p>
        )}

        <div className="mt-6">
          <NewSessionForm
            studentId={student.id}
            goals={(goals ?? []) as unknown as SessionGoal[]}
          />
        </div>
      </div>
    </main>
  );
}
