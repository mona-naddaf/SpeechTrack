import { PartyPopper } from "lucide-react";
import type { StudentStreak } from "@/lib/caseload";

type Props = {
  /** Goals that transitioned to "mastered" in the last 30 days — see
   *  goals.mastered_at / teacher_goals.mastered_at. */
  masteredCount: number;
  longestStreak: StudentStreak | null;
  sessionsThisWeek: number;
};

/** A light, celebratory summary near the top of the dashboard — a
 *  handful of stat chips, not a dense analytics block. Renders nothing
 *  at all once there's genuinely nothing to show yet (a brand-new
 *  caseload), rather than an empty/zeroed-out card. */
export default function CaseloadWinsCard({
  masteredCount,
  longestStreak,
  sessionsThisWeek,
}: Props) {
  const hasLongestStreak = longestStreak !== null && longestStreak.streak > 0;
  if (masteredCount === 0 && !hasLongestStreak && sessionsThisWeek === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
        <PartyPopper className="h-3.5 w-3.5" />
        Caseload wins
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {masteredCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1.5 text-sm font-medium text-accent-800">
            🎉 {masteredCount} goal{masteredCount === 1 ? "" : "s"} mastered in
            the last 30 days
          </span>
        )}
        {hasLongestStreak && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 text-sm font-medium text-brand-800">
            🔥 {longestStreak!.name}&apos;s on a {longestStreak!.streak}-streak
          </span>
        )}
        {sessionsThisWeek > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700">
            📅 {sessionsThisWeek} session{sessionsThisWeek === 1 ? "" : "s"}{" "}
            logged this week
          </span>
        )}
      </div>
    </div>
  );
}
