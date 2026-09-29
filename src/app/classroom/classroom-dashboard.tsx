import {
  BookOpenCheck,
  GraduationCap,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/date";
import { getHowItWentOption } from "@/lib/practice";
import type { GoalProgressReport } from "@/lib/progress";
import type {
  ClassroomStrategy,
  ClassroomStrategyLogWithPraise,
  HowItWent,
} from "@/lib/types";
// Reused verbatim from the parent-facing dashboard, not duplicated — same
// content a parent would see for whatever the SLP/Teacher has shared
// (visible_to_parent / share_behavior_with_parent), so it must stay the
// exact same component rather than a classroom-flavored copy.
import ProgressSection from "@/app/parent/progress-section";
import BehaviorSection, {
  type BehaviorBreakdownEntry,
} from "@/app/parent/behavior-section";
import SessionNotesSection, {
  type ParentSessionNote,
} from "@/app/parent/session-notes-section";
import LinkifyText from "@/components/linkify-text";
import LogStrategyForm from "./log-strategy-form";
import LogoutButton from "./logout-button";

type Props = {
  studentName: string;
  items: ClassroomStrategy[];
  logs: ClassroomStrategyLogWithPraise[];
  itemsError: string | null;
  logsError: string | null;
  /** Only goals the SLP/Teacher has toggled visible_to_parent on — the
   *  exact same set (and the exact same GoalProgressReport shape) a
   *  parent sees, since it's the same toggle. */
  progressReports: GoalProgressReport[];
  showBehaviorSection: boolean;
  behaviorBreakdown: BehaviorBreakdownEntry[];
  sessionNotes: ParentSessionNote[];
};

const MOOD_BADGE_CLASSES: Record<HowItWent, string> = {
  great: "bg-green-100 text-green-800",
  okay: "bg-amber-100 text-amber-800",
  tricky: "bg-brand-100 text-brand-800",
};

export default function ClassroomDashboard({
  studentName,
  items,
  logs,
  itemsError,
  logsError,
  progressReports,
  showBehaviorSection,
  behaviorBreakdown,
  sessionNotes,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-brand-800">
            Teacher view
          </span>
          <h1 className="mt-2 text-xl font-bold text-stone-900 sm:text-2xl">
            Hi! Here&apos;s {studentName}&apos;s classroom strategies.
          </h1>
        </div>
        <LogoutButton />
      </div>

      {itemsError && (
        <p className="text-sm text-red-600">
          Couldn&apos;t load classroom strategies: {itemsError}
        </p>
      )}

      {items.length === 0 && !itemsError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100">
            <GraduationCap className="h-5 w-5 text-brand-500" />
          </div>
          <p className="text-stone-500">
            This student&apos;s therapist or teacher hasn&apos;t added any
            classroom strategies yet.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
            <GraduationCap className="h-5 w-5 text-brand-500" />
            Assigned strategies
          </h2>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="font-medium text-stone-900">
                  <LinkifyText text={item.what_to_do} />
                </p>
                {item.how_to_do_it && (
                  <p className="mt-1 text-sm text-stone-600">
                    <LinkifyText text={item.how_to_do_it} />
                  </p>
                )}
                {item.last_used_date && (
                  <p className="mt-2 text-xs text-stone-400">
                    Last used {formatDate(item.last_used_date)}
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
          Log today&apos;s strategies
        </h2>
        <div className="mt-3">
          <LogStrategyForm items={items} />
        </div>
      </div>

      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <BookOpenCheck className="h-5 w-5 text-brand-500" />
          Log history
        </h2>

        {logsError && (
          <p className="mt-3 text-sm text-red-600">
            Couldn&apos;t load the log history: {logsError}
          </p>
        )}

        {logs.length === 0 && !logsError && (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100">
              <BookOpenCheck className="h-5 w-5 text-brand-500" />
            </div>
            <p className="text-stone-500">
              Nothing logged yet — log today&apos;s to get started!
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
                      {log.activities.map((a, i) => (
                        <span key={a.id}>
                          {i > 0 && ", "}
                          <LinkifyText text={a.text} />
                        </span>
                      ))}
                    </p>
                  )}

                  {log.note && (
                    <p className="mt-2 text-sm text-stone-600">
                      <LinkifyText text={log.note} />
                    </p>
                  )}

                  {log.praise.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {log.praise.map((p) => (
                        <p
                          key={p.id}
                          className="flex items-start gap-2 rounded-xl bg-gradient-to-r from-amber-50 to-brand-50 px-3 py-2.5 text-sm font-medium text-amber-900"
                        >
                          <PartyPopper className="h-4 w-4 shrink-0 text-amber-500" />
                          <LinkifyText text={p.message} />
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
        <ProgressSection reports={progressReports} studentName={studentName} />
      )}

      {showBehaviorSection && (
        <BehaviorSection breakdown={behaviorBreakdown} />
      )}

      {sessionNotes.length > 0 && (
        <SessionNotesSection notes={sessionNotes} />
      )}
    </div>
  );
}
