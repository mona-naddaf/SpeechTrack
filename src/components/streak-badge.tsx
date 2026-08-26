"use client";

import { useEffect, useState } from "react";
import { fireCelebrationConfetti } from "@/lib/confetti";
import { getMilestoneEmoji, isMilestoneStreak } from "@/lib/streaks";
import CelebrationToast from "./celebration-toast";

type Props = {
  streak: number;
  /** Unique per student + context (e.g. "slp-session-streak:<studentId>",
   *  "parent-practice-streak:<studentId>") so different streak badges
   *  never share or clobber each other's "already celebrated" memory. */
  storageKey: string;
  /** The badge's visible text, e.g. "12-week streak" or "5 day streak!" —
   *  this component only owns the emoji + one-time celebration, not the
   *  wording, since the SLP/Teacher and parent sides want a different tone. */
  label: string;
  className?: string;
};

const STORAGE_PREFIX = "bloomtrack:streak-milestone:";

/** A small streak badge (emoji + label) shared by the SLP/Teacher student
 *  page and the parent dashboard. Fires the app's confetti celebration
 *  exactly once per newly-reached milestone — remembered per `storageKey`
 *  in localStorage, so a page reload at the same streak count doesn't
 *  replay it, but growing past the next threshold does. */
export default function StreakBadge({
  streak,
  storageKey,
  label,
  className,
}: Props) {
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (!isMilestoneStreak(streak)) return;
    try {
      const key = `${STORAGE_PREFIX}${storageKey}`;
      const lastCelebrated = Number(localStorage.getItem(key) ?? "0");
      if (streak > lastCelebrated) {
        localStorage.setItem(key, String(streak));
        setCelebrating(true);
        fireCelebrationConfetti();
      }
    } catch {
      // localStorage can be unavailable (private browsing, etc.) — the
      // badge/emoji still render fine, just skip the one-time celebration.
    }
  }, [streak, storageKey]);

  const emoji = getMilestoneEmoji(streak);

  return (
    <>
      <span
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1.5 text-sm font-semibold text-accent-800"
        }
      >
        {emoji && <span aria-hidden>{emoji}</span>}
        {label}
      </span>
      {celebrating && (
        <CelebrationToast
          message={`${emoji ?? "🎉"} ${streak}-streak milestone!`}
          onDone={() => setCelebrating(false)}
        />
      )}
    </>
  );
}
