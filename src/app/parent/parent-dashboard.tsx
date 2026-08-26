import {
  BookOpenCheck,
  ClipboardList,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/date";
import { getHowItWentOption } from "@/lib/practice";
import type { GoalProgressReport } from "@/lib/progress";
import type { HomePracticeItem, HowItWent, PracticeLogWithPraise } from "@/lib/types";
import StreakBadge from "@/components/streak-badge";
import LogPracticeForm from "./log-practice-form";
import LogoutButton from "./logout-button";
import ProgressSection from "./progress-section";
import BehaviorSection, { type BehaviorBreakdownEntry } from "./behavior-section";

type Props = {
  studentId: string;
  studentName: string;
  items: HomePracticeItem[];
  logs: PracticeLogWithPraise[];
  itemsError: string | null;
  logsError: string | null;
  /** Consecutive calendar days with at least one practice log — today can
   *  still be "pending" without breaking it (see computeCadenceStreak()
   *  in src/lib/streaks.ts). 0 means nothing's been logged yet, or the
   *  streak already broke; the badge just doesn't render in that case. */
  practiceStreak: number;
  /** Only goals the SLP/Teacher has toggled visible_to_parent on. Empty
   *  when nothing's been shared yet — the section is hidden entirely
   *  rather than rendered empty, so nothing changes for existing parents
   *  until their SLP/Teacher opts a goal in. */
  progressReports: GoalProgressReport[];
  /** Whether the SLP/Teacher has turned behavior sharing on for this
   *  student. Kept separate from behaviorBreakdown below because "shared,
   *  but nothing logged recently" should still show the section (with a
   *  friendly empty state) rather than hide it — only an actual false
   *  here hides it. */
  showBehaviorSection: boolean;
  behaviorBreakdown: BehaviorBreakdownEntry[];
};

// Warm, distinct mood badge colors — matches the mood-picker in LogPracticeForm.
const MOOD_BADGE_CLASSES: Record<HowItWent, string> = {
  great: "bg-green-100 text-green-800",
  okay: "bg-amber-100 text-amber-800",
  tricky: "bg-brand-100 text-brand-800",
};

export default function ParentDashboard({
  studentId,
  studentName,
  items,
  logs,
  itemsError,
  logsError,
  practiceStreak,
  progressReports,
  showBehaviorSection,
  behaviorBreakdown,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">
          Hi! Here&apos;s {studentName}&apos;s home practice.{" "}
          <span aria-hidden>🏡</span>
        </h1>
        <LogoutButton />
      </div>

      {practiceStreak > 0 && (
        <StreakBadge
          streak={practiceStreak}
          storageKey={`parent-practice-streak:${studentId}`}
          label={`${practiceStreak} day streak!`}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-100 to-accent-100 px-4 py-2.5 text-base font-bold text-stone-900 shadow-sm"
        />
      )}

      {itemsError && (
        <p className="text-sm text-red-600">
          Couldn&apos;t load practice items: {itemsError}
        </p>
      )}

      {items.length === 0 && !itemsError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100">
            <ClipboardList className="h-5 w-5 text-brand-500" />
          </div>
          <p className="text-stone-500">
            Your child&apos;s therapist hasn&apos;t added any practice items
            yet.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
            <ClipboardList className="h-5 w-5 text-brand-500" />
            What to practice
          </h2>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="font-medium text-stone-900">
                  {item.what_to_practice}
                </p>
                {item.how_to_practice && (
                  <p className="mt-1 text-sm text-stone-600">
                    {item.how_to_practice}
                  </p>
                )}
                {item.last_worked_date && (
                  <p className="mt-2 text-xs text-stone-400">
                    Last worked on {formatDate(item.last_worked_date)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Sparkles className="h-5 w-5 text-brand-500" />
          Log today&apos;s practice
        </h2>
        <div className="mt-3">
          <LogPracticeForm items={items} />
        </div>
      </div>

      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <BookOpenCheck className="h-5 w-5 text-brand-500" />
          Practice history
        </h2>

        {logsError && (
          <p className="mt-3 text-sm text-red-600">
            Couldn&apos;t load practice history: {logsError}
          </p>
        )}

        {logs.length === 0 && !logsError && (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100">
              <BookOpenCheck className="h-5 w-5 text-brand-500" />
            </div>
            <p className="text-stone-500">
              No practice logged yet — log today&apos;s to get started!
            </p>
          </div>
        )}

        {logs.length > 0 && (
          <div className="mt-3 space-y-3">
            {logs.map((log) => {
              const mood = getHowItWentOption(log.how_it_went);
              const celebrated = log.praise.length > 0;
              return (
                <div
                  key={log.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
                    celebrated ? "border-amber-200" : "border-stone-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-stone-900">
                      {formatDate(log.date)}
                    </p>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${MOOD_BADGE_CLASSES[log.how_it_went]}`}
                    >
                      <span className="text-base">{mood.emoji}</span>
                      {mood.label}
                    </span>
                  </div>

                  {log.activities.length > 0 && (
                    <p className="mt-2 text-sm text-stone-600">
                      {log.activities.map((a) => a.text).join(", ")}
                    </p>
                  )}

                  {log.note && (
                    <p className="mt-2 text-sm text-stone-600">{log.note}</p>
                  )}

                  {log.praise.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {log.praise.map((p) => (
                        <p
                          key={p.id}
                          className="flex items-start gap-2 rounded-xl bg-gradient-to-r from-amber-50 to-brand-50 px-3 py-2.5 text-sm font-medium text-amber-900"
                        >
                          <PartyPopper className="h-4 w-4 shrink-0 text-amber-500" />
                          {p.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {progressReports.length > 0 && (
        <ProgressSection reports={progressReports} />
      )}

      {showBehaviorSection && (
        <BehaviorSection breakdown={behaviorBreakdown} />
      )}
    </div>
  );
}
