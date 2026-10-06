"use client";

import { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import Link from "next/link";
import type { Countdown } from "@/lib/types";
import { daysUntil, formatDate } from "@/lib/date";

type Props = {
  countdowns: Countdown[];
  today: string;
  /** Read-only summary mode (the dashboard): a link out to the Schedule
   *  page, which owns the actual add/edit/delete UI. Mutually exclusive
   *  with onAdd/onEdit — pass exactly one "mode" of props depending on
   *  where this renders. */
  manageHref?: string;
  /** Interactive mode (the Schedule page): rows open for editing, plus
   *  an "+ Add countdown" affordance. */
  onAdd?: () => void;
  onEdit?: (countdown: Countdown) => void;
};

/** "X days until [title]" — shared by the dashboard (a one-line strip of
 *  the next two upcoming countdowns, `manageHref` set) and the Schedule
 *  page (the full, interactive list, `onAdd`/`onEdit` set). On the
 *  Schedule page, upcoming countdowns (target_date >= today) show first,
 *  soonest-first; passed ones are collapsed behind a "N passed" toggle
 *  rather than just gone, since a passed countdown still needs to be
 *  reachable to delete. That page always renders (with its own empty
 *  state) so "+ Add countdown" is always reachable there. */
export default function CountdownsWidget({
  countdowns,
  today,
  manageHref,
  onAdd,
  onEdit,
}: Props) {
  const [showPassed, setShowPassed] = useState(false);
  const interactive = onAdd !== undefined;

  const upcoming = countdowns
    .filter((c) => daysUntil(c.target_date, today) >= 0)
    .sort((a, b) => a.target_date.localeCompare(b.target_date));
  const passed = countdowns
    .filter((c) => daysUntil(c.target_date, today) < 0)
    .sort((a, b) => b.target_date.localeCompare(a.target_date));

  // Dashboard (read-only) mode: one thin strip with at most the two
  // soonest upcoming countdowns and "Manage" on the same line. Passed
  // countdowns aren't mentioned here at all (they're still listed, and
  // deletable, on the Schedule page). Nothing upcoming → no strip.
  if (!interactive) {
    const soonest = upcoming.slice(0, 2);
    if (soonest.length === 0) return null;
    return (
      <div
        data-testid="countdowns-strip"
        className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
      >
        <CalendarClock className="h-4 w-4 shrink-0 text-stone-400" />
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
          {soonest.map((c) => {
            const days = daysUntil(c.target_date, today);
            return (
              <span key={c.id} className="min-w-0 truncate text-stone-700">
                {c.title}
                <span className={`ml-1.5 font-semibold ${days <= 7 ? "text-brand-700" : "text-stone-500"}`}>
                  · {days === 0 ? "Today!" : days === 1 ? "1 day" : `${days} days`}
                </span>
              </span>
            );
          })}
        </span>
        {manageHref && (
          <Link
            href={manageHref}
            className="shrink-0 text-xs font-medium text-stone-400 transition-colors hover:text-brand-700"
          >
            Manage
          </Link>
        )}
      </div>
    );
  }


  function row(countdown: Countdown, isPassed: boolean) {
    const days = daysUntil(countdown.target_date, today);
    const label = isPassed
      ? `${formatDate(countdown.target_date)} — passed`
      : days === 0
        ? "Today!"
        : days === 1
          ? "1 day"
          : `${days} days`;

    const content = (
      <>
        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            isPassed ? "text-stone-400 line-through" : "text-stone-800"
          }`}
        >
          {countdown.title}
        </span>
        <span
          className={`shrink-0 text-xs font-semibold ${
            isPassed
              ? "text-stone-400"
              : days <= 7
                ? "text-brand-700"
                : "text-stone-500"
          }`}
        >
          {label}
        </span>
      </>
    );

    return (
      <button
        key={countdown.id}
        type="button"
        onClick={() => onEdit?.(countdown)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-cream-50"
      >
        {content}
      </button>
    );
  }

  const cardBody = (
    <>
      {upcoming.length === 0 && passed.length === 0 && (
        <p className="px-2 py-1 text-sm text-stone-400">
          No countdowns yet.
        </p>
      )}
      {upcoming.map((c) => row(c, false))}
      {passed.length > 0 && (
        <div className="mt-1 border-t border-stone-100 pt-1">
          <button
            type="button"
            onClick={() => setShowPassed((s) => !s)}
            className="px-2 py-1 text-xs font-medium text-stone-400 hover:text-stone-600"
          >
            {showPassed ? "Hide" : `${passed.length} passed`}
          </button>
          {showPassed && passed.map((c) => row(c, true))}
        </div>
      )}
    </>
  );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
          <CalendarClock className="h-3.5 w-3.5" />
          Countdowns
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add countdown
        </button>
      </div>
      <div className="mt-2 space-y-0.5">{cardBody}</div>
    </div>
  );
}
