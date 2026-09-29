"use client";

import { BookOpenText } from "lucide-react";
import { formatDate } from "@/lib/date";
import { getHowItWentOption } from "@/lib/practice";
import type { PracticeLogWithPraise } from "@/lib/types";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";
import LinkifyText from "@/components/linkify-text";

type Props = {
  logs: PracticeLogWithPraise[];
  error: string | null;
};

/** Read-only mirror of PracticeLogSection — same log entries and praise
 *  notes, no "Send praise" input. */
export default function PracticeLogView({ logs, error }: Props) {
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("practice_log");

  return (
    <div>
      <SectionHeader
        icon={BookOpenText}
        title="Practice log"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />

      {!collapsed && (
        <>
          <p className="mt-1 text-sm text-stone-500">Logged by the parent from home.</p>

          {error && (
            <p className="mt-4 text-sm text-red-600">
              Couldn&apos;t load the practice log: {error}
            </p>
          )}

          {!error && logs.length === 0 && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <BookOpenText className="h-6 w-6 text-brand-500" />
              </div>
              <p className="text-stone-500">No home practice logged yet.</p>
            </div>
          )}

          {logs.length > 0 && (
            <div className="mt-4 space-y-3">
              {logs.map((log) => {
                const mood = getHowItWentOption(log.how_it_went);
                return (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-stone-200 bg-white shadow-sm p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-stone-900">
                        {formatDate(log.date)}
                      </p>
                      <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
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
                            className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
                          >
                            🌟 <LinkifyText text={p.message} />
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
