import { Trophy } from "lucide-react";

type Props = {
  masteredCount: number;
  totalCount: number;
};

/** "N of M goals mastered — P%" across every one of a student's goals —
 *  every track step plus every standalone goal alike. Purely
 *  presentational; goals-section.tsx owns the one-time celebration when
 *  this reaches 100% (same fireCelebrationConfetti()/CelebrationToast
 *  pairing used for a single goal reaching "mastered"). Renders nothing
 *  when there are no goals yet — the section's own empty state covers
 *  that. */
export default function TreatmentPlanProgress({ masteredCount, totalCount }: Props) {
  if (totalCount === 0) return null;

  const percent = Math.round((masteredCount / totalCount) * 100);
  const complete = percent === 100;

  return (
    <div
      className={`mb-4 rounded-2xl border p-4 transition-colors ${
        complete
          ? "border-accent-200 bg-accent-50"
          : "border-stone-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy
            className={`h-4 w-4 shrink-0 ${complete ? "text-accent-600" : "text-brand-500"}`}
          />
          <span className="text-sm font-semibold text-stone-900">
            Treatment Plan Progress
          </span>
        </div>
        <span
          className={`shrink-0 text-sm font-semibold ${complete ? "text-accent-700" : "text-stone-600"}`}
        >
          {masteredCount} of {totalCount} goals mastered — {percent}%
        </span>
      </div>

      <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            complete
              ? "bg-accent-500"
              : "bg-gradient-to-r from-brand-400 to-brand-600"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
