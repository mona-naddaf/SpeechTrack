"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, PartyPopper } from "lucide-react";
import type { StudentStreak } from "@/lib/caseload";

type Props = {
  /** Goals that transitioned to "mastered" in the last 30 days — see
   *  goals.mastered_at / teacher_goals.mastered_at. */
  masteredCount: number;
  longestStreak: StudentStreak | null;
  sessionsThisWeek: number;
};

/** Shared across both dashboards: the expanded/collapsed choice is a
 *  global UI preference, persisted the same way as the student page's
 *  section preferences and the student list's sort/filters. */
const STORAGE_KEY = "bloomtrack:caseload-wins-expanded";

/** A slim, collapsible summary near the top of the dashboard. Collapsed
 *  (the default) it's one line — "Caseload wins: 3 goals mastered ·
 *  5-streak · 2 sessions this week" — so the student list stays above the
 *  fold; expanded it shows the full stat chips. Renders nothing at all
 *  once there's genuinely nothing to show yet (a brand-new caseload). */
export default function CaseloadWinsCard({
  masteredCount,
  longestStreak,
  sessionsThisWeek,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  // Server and first client render are collapsed (no hydration mismatch);
  // a saved "expanded" applies right after mount.
  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // localStorage unavailable — collapsed is fine.
    }
  }, []);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Private browsing — just won't survive a reload.
      }
      return next;
    });
  }

  const hasLongestStreak = longestStreak !== null && longestStreak.streak > 0;
  if (masteredCount === 0 && !hasLongestStreak && sessionsThisWeek === 0) {
    return null;
  }

  const summary = [
    masteredCount > 0 && `${masteredCount} goal${masteredCount === 1 ? "" : "s"} mastered`,
    hasLongestStreak && `${longestStreak!.streak}-streak`,
    sessionsThisWeek > 0 &&
      `${sessionsThisWeek} session${sessionsThisWeek === 1 ? "" : "s"} this week`,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm" data-testid="caseload-wins">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
        )}
        <PartyPopper className="h-4 w-4 shrink-0 text-brand-500" />
        <span className="shrink-0 font-semibold text-stone-700">Caseload wins</span>
        {!expanded && (
          <span className="min-w-0 truncate text-stone-500">{summary.join(" · ")}</span>
        )}
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-2 px-3 pb-3">
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
      )}
    </div>
  );
}
