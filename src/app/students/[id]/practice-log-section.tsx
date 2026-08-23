"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";
import { getHowItWentOption } from "@/lib/practice";
import type { PracticeLogWithPraise } from "@/lib/types";

type Props = {
  initialLogs: PracticeLogWithPraise[];
  initialError: string | null;
};

export default function PracticeLogSection({
  initialLogs,
  initialError,
}: Props) {
  const [logs, setLogs] = useState<PracticeLogWithPraise[]>(initialLogs);
  const [listError] = useState<string | null>(initialError);
  const [draftByLog, setDraftByLog] = useState<Record<string, string>>({});
  const [submittingLogId, setSubmittingLogId] = useState<string | null>(null);
  const [errorByLog, setErrorByLog] = useState<Record<string, string>>({});

  async function handleAddPraise(logId: string) {
    const message = (draftByLog[logId] ?? "").trim();
    if (!message) return;

    setSubmittingLogId(logId);
    setErrorByLog((prev) => ({ ...prev, [logId]: "" }));

    const supabase = createClient();
    const { data, error } = await supabase
      .from("praise")
      .insert({ practice_log_id: logId, message })
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
      <h2 className="text-lg font-semibold text-slate-900">Practice log</h2>
      <p className="mt-1 text-sm text-slate-500">
        Logged by the parent from home — leave a quick note of praise on any
        entry.
      </p>

      {listError && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load the practice log: {listError}
        </p>
      )}

      {!listError && logs.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No home practice logged yet.
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-4 space-y-3">
          {logs.map((log) => {
            const mood = getHowItWentOption(log.how_it_went);
            return (
              <div
                key={log.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    {formatDate(log.date)}
                  </p>
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    <span className="text-base">{mood.emoji}</span>
                    {mood.label}
                  </span>
                </div>

                {log.activities.length > 0 && (
                  <p className="mt-2 text-sm text-slate-600">
                    {log.activities.map((a) => a.text).join(", ")}
                  </p>
                )}

                {log.note && (
                  <p className="mt-2 text-sm text-slate-600">{log.note}</p>
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
                    className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddPraise(log.id)}
                    disabled={
                      submittingLogId === log.id ||
                      !(draftByLog[log.id] ?? "").trim()
                    }
                    className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
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
    </div>
  );
}
