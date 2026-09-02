import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/role";
import { getTodayLocalDateString } from "@/lib/date";
import ScheduleView, {
  type CommonScheduleStudent,
} from "@/components/schedule-view";

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (getUserRole(user) === "teacher") {
    redirect("/teacher/schedule");
  }

  const { data, error } = await supabase
    .from("students")
    .select("id, name, avatar, scheduled_days, schedule_end_date");

  const students: CommonScheduleStudent[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    scheduledDays: row.scheduled_days,
    scheduleEndDate: row.schedule_end_date,
  }));

  // schedule_events/holidays/countdowns are each one shared table for
  // both the SLP and Teacher sides (0031_schedule_events.sql,
  // 0032_holidays_and_countdowns.sql) -- RLS already scopes each to only
  // this SLP's own rows, same as the unfiltered `students` select above.
  const [
    { data: eventsData, error: eventsError },
    { data: holidaysData, error: holidaysError },
    { data: countdownsData, error: countdownsError },
  ] = await Promise.all([
    supabase
      .from("schedule_events")
      .select("id, title, date, start_time, duration_minutes, note, color, created_at"),
    supabase.from("holidays").select("id, title, date, created_at"),
    supabase
      .from("countdowns")
      .select("id, title, target_date, created_at")
      .order("target_date", { ascending: true }),
  ]);

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
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

        {(error || eventsError || holidaysError || countdownsError) && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load the schedule:{" "}
            {(error ?? eventsError ?? holidaysError ?? countdownsError)!.message}
          </p>
        )}

        <div className="mt-6">
          <ScheduleView
            students={students}
            studentBasePath="/students"
            initialToday={getTodayLocalDateString()}
            initialEvents={eventsData ?? []}
            initialHolidays={holidaysData ?? []}
            initialCountdowns={countdownsData ?? []}
            ownerId={user.id}
            ownerField="slp_id"
          />
        </div>
      </div>
    </main>
  );
}
