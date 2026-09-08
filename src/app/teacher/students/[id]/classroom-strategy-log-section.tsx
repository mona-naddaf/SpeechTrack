"use client";

import { useState } from "react";
import { BookOpenText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";
import { getHowItWentOption } from "@/lib/practice";
import type { ClassroomStrategyLogWithPraise } from "@/lib/types";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";

type Props = {
  initialLogs: ClassroomStrategyLogWithPraise[];
  initialError: string | null;
};

// Mirrors PracticeLogSection exactly — same praise mechanic, pointed at
// teacher_classroom_strategy_praise instead of teacher_praise.
export default function ClassroomStrategyLogSection({
  initialLogs,
  initialError,
}: Props) {
  const [logs, setLogs] = useState<ClassroomStrategyLogWithPraise[]>(initialLogs);
  const [listError] = useState<string | null>(initialError);
  const [draftByLog, setDraftByLog] = useState<Record<string, string>>({});
  const [submittingLogId, setSubmittingLogId] = useState<string | null>(null);
  const [errorByLog, setErrorByLog] = useState<Record<string, string>>({});
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("classroom_strategy_log");

  async function handleAddPraise(logId: string) {
    const message = (draftByLog[logId] ?? "").trim();
    if (!message) return;

    setSubmittingLogId(logId);
    setErrorByLog((prev) => ({ ...prev, [logId]: "" }));

    const supabase = createClient();
    const { data, error } = await supabase
      .from("teacher_classroom_strategy_praise")
      .insert({ classroom_strategy_log_id: logId, message })
      .select("id, message, created_at")
      .single();

    setSubmittingLogId(null);

    if (error || !data) {
      setErrorByLog((prev) => ({
        ...prev,
        [logId]: error?.message ?? "Could not save praise.",
      }));
      return;
    }

    setLogs((prev) =>
      prev.map((log) =>
        log.id === logId ? { ...log, praise: [...log.praise, data] } : log
      )
    );
    setDraftByLog((prev) => ({ ...prev, [logId]: "" }));
  }

  return (
    <div>
      <SectionHeader
        icon={BookOpenText}
        title="Classroom strategy log"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />

      {!collapsed && (
        <>
      <p className="mt-1 text-sm text-stone-500">
        Logged by the classroom contact — leave a quick note of praise on
        any entry.
      </p>

      {listError && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load the classroom strategy log: {listError}
        </p>
      )}

      {!listError && logs.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <BookOpenText className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">No classroom strategies logged yet.</p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-4 space-y-3">
          {logs.map((log) => {
            const mood = getHowItWentOption(log.how_it_went);
            return (
              <div
                key={log.id}
                className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4"
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
                        className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
                      >
                        🌟 {p.message}
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={draftByLog[log.id] ?? ""}
                    onChange={(e) =>
                      setDraftByLog((prev) => ({
                        ...prev,
                        [log.id]: e.target.value,
                      }))
                    }
                    placeholder="Leave a quick praise note…"
                    className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddPraise(log.id)}
                    disabled={
                      submittingLogId === log.id ||
                      !(draftByLog[log.id] ?? "").trim()
                    }
                    className="shrink-0 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50"
                  >
                    {submittingLogId === log.id ? "Saving…" : "Send praise"}
                  </button>
                </div>
                {errorByLog[log.id] && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorByLog[log.id]}
                  </p>
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
