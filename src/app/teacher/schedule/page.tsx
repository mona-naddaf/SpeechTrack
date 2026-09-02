import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { getTodayLocalDateString } from "@/lib/date";
import ScheduleView, {
  type CommonScheduleStudent,
} from "@/components/schedule-view";

export default async function TeacherSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (getUserRole(user) !== "teacher") {
    redirect("/schedule");
  }

  const { data, error } = await supabase
    .from("teacher_students")
    .select("id, name, avatar, scheduled_days, schedule_end_date");

  const students: CommonScheduleStudent[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    scheduledDays: row.scheduled_days,
    scheduleEndDate: row.schedule_end_date,
  }));

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">Schedule</h1>
          <p className="mt-1 text-stone-600">
            Your caseload&apos;s scheduled sessions, from each student&apos;s
            scheduled days and times.
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load the schedule: {error.message}
          </p>
        )}

        <div className="mt-6">
          <ScheduleView
            students={students}
            studentBasePath="/teacher/students"
            initialToday={getTodayLocalDateString()}
          />
        </div>
      </div>
    </main>
  );
}
