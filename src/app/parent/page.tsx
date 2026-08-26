import { cookies } from "next/headers";
import { HeartHandshake } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { PARENT_COOKIE_NAME, verifyParentSessionToken } from "@/lib/parent-session";
import type { HomePracticeItem, PracticeLogWithPraise } from "@/lib/types";
import ParentLoginForm from "./parent-login-form";
import ParentDashboard from "./parent-dashboard";

function LoginScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 shadow-sm">
            <HeartHandshake className="h-7 w-7 text-brand-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">
            SpeechTrack
          </h1>
          <p className="mt-1 text-stone-600">Home practice, made easy</p>
        </div>
        <div className="mt-6">
          <ParentLoginForm />
        </div>
      </div>
    </main>
  );
}

export default async function ParentPage() {
  const cookieStore = await cookies();
  const session = verifyParentSessionToken(
    cookieStore.get(PARENT_COOKIE_NAME)?.value
  );

  if (!session) {
    return <LoginScreen />;
  }

  const supabase = createServiceClient();

  // Which set of tables to read from depends on which kind of student this
  // code belongs to (see ParentStudentType) — the UI below is identical
  // either way, only the source tables differ.
  const isTeacherStudent = session.studentType === "teacher";
  const studentsTable = isTeacherStudent ? "teacher_students" : "students";
  const itemsTable = isTeacherStudent
    ? "teacher_home_practice_items"
    : "home_practice_items";
  const logsTable = isTeacherStudent
    ? "teacher_practice_logs"
    : "practice_logs";
  // teacher_practice_logs' praise rows live in teacher_praise — aliased
  // back to "praise" so both branches produce the same PracticeLogWithPraise shape.
  const praiseEmbed = isTeacherStudent
    ? "praise:teacher_praise(id, message, created_at)"
    : "praise(id, message, created_at)";

  const { data: student } = await supabase
    .from(studentsTable)
    .select("id, name")
    .eq("id", session.studentId)
    .maybeSingle();

  // Cookie pointed at a student that no longer exists — treat as logged out.
  if (!student) {
    return <LoginScreen />;
  }

  const [itemsResult, logsResult] = await Promise.all([
    supabase
      .from(itemsTable)
      .select("id, what_to_practice, how_to_practice, last_worked_date, created_at")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false }),
    supabase
      .from(logsTable)
      .select(`id, date, activities, how_it_went, note, created_at, ${praiseEmbed}`)
      .eq("student_id", student.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <ParentDashboard
          studentName={student.name}
          items={(itemsResult.data ?? []) as unknown as HomePracticeItem[]}
          logs={(logsResult.data ?? []) as unknown as PracticeLogWithPraise[]}
          itemsError={itemsResult.error?.message ?? null}
          logsError={logsResult.error?.message ?? null}
        />
      </div>
    </main>
  );
}
