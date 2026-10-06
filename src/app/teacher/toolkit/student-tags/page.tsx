import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import type { StudentTag } from "@/lib/types";
import StudentTagsManager from "@/components/student-tags-manager";

export default async function TeacherStudentTagsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (getUserRole(user) !== "teacher") {
    redirect("/toolkit/student-tags");
  }

  const { data: tags, error } = await supabase
    .from("teacher_student_tags")
    .select("id, name, color")
    .eq("teacher_id", user.id)
    .order("name", { ascending: true });

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">Student tags</h1>
          <p className="mt-1 text-stone-600">
            Your own labels for grouping students, like &ldquo;Mainstream&rdquo; or
            &ldquo;Paid&rdquo;. Only you see them — never parents or classroom contacts.
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load tags: {error.message}
          </p>
        )}

        <div className="mt-6">
          <StudentTagsManager
            ownerId={user.id}
            ownerField="teacher_id"
            tagsTable="teacher_student_tags"
            tagLinksTable="teacher_student_tag_links"
            initialTags={(tags ?? []) as StudentTag[]}
          />
        </div>
      </div>
    </main>
  );
}
