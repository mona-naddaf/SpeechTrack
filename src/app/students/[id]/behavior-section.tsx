"use client";

import { useMemo, useState } from "react";
import { BarChart3, ClipboardPlus, Smile } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";
import { getColorOption } from "@/lib/colors";
import { SEVERITY_CLASSES, SEVERITY_LABELS } from "@/lib/behavior";
import type { BehaviorType, SlpBehaviorLogWithType } from "@/lib/types";
import LogBehaviorModal, { type LogBehaviorValues } from "./log-behavior-modal";
import ShareBehaviorToggle from "./share-behavior-toggle";

type Props = {
  studentId: string;
  initialLogs: SlpBehaviorLogWithType[];
  initialLogsError: string | null;
  behaviorTypes: BehaviorType[];
  shareBehaviorWithParent: boolean;
};

export default function BehaviorSection({
  studentId,
  initialLogs,
  initialLogsError,
  behaviorTypes,
  shareBehaviorWithParent,
}: Props) {
  const [logs, setLogs] = useState<SlpBehaviorLogWithType[]>(initialLogs);
  const [listError] = useState<string | null>(initialLogsError);
  const [showLogModal, setShowLogModal] = useState(false);

  const breakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      const key = log.behavior_type?.id ?? "unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const maxCount = Math.max(1, ...counts.values());
    return behaviorTypes
      .map((bt) => ({
        behaviorType: bt,
        count: counts.get(bt.id) ?? 0,
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((entry) => ({ ...entry, percent: Math.round((entry.count / maxCount) * 100) }));
  }, [logs, behaviorTypes]);

  async function handleLog(values: LogBehaviorValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { data, error } = await supabase
      .from("slp_behavior_logs")
      .insert({
        slp_id: user.id,
        student_id: studentId,
        date: values.date,
        behavior_type_id: values.behaviorTypeId,
        severity: values.severity,
        note: values.note || null,
      })
      .select("id, student_id, date, behavior_type_id, severity, note, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    const behaviorType = behaviorTypes.find((bt) => bt.id === data.behavior_type_id);
    const fullLog: SlpBehaviorLogWithType = {
      ...data,
      behavior_type: behaviorType ?? null,
    };

    setLogs((prev) =>
      [...prev, fullLog].sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.created_at.localeCompare(a.created_at)
      )
    );
    setShowLogModal(false);
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Smile className="h-5 w-5 text-brand-500" />
          Behavior
        </h2>
        <div className="flex items-center gap-3">
          <ShareBehaviorToggle
            studentId={studentId}
            initialShared={shareBehaviorWithParent}
          />
          <button
            onClick={() => setShowLogModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
          >
            <ClipboardPlus className="h-4 w-4" />
            Log behavior
          </button>
        </div>
      </div>

      {listError && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load behavior logs: {listError}
        </p>
      )}

      {breakdown.length > 0 && (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
            <BarChart3 className="h-3.5 w-3.5" />
            Behavior trends
          </p>
          <div className="space-y-2">
            {breakdown.map(({ behaviorType, count, percent }) => {
              const color = getColorOption(behaviorType.color);
              return (
                <div key={behaviorType.id}>
                  <div className="flex items-center justify-between text-xs text-stone-600">
                    <span className="font-medium">{behaviorType.name}</span>
                    <span>{count}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${color.swatchClass}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!listError && logs.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Smile className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No behavior logged yet for this student.
          </p>
        </div>
      )}

      {logs.length > 0 && (
        <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {logs.map((log) => {
            const color = getColorOption(log.behavior_type?.color ?? "grey");
            return (
              <li key={log.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-900">
                      {formatDate(log.date)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${color.badgeClass}`}
                    >
                      {log.behavior_type?.name ?? "Deleted type"}
                    </span>
                    {log.severity && (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${SEVERITY_CLASSES[log.severity]}`}
                      >
                        {SEVERITY_LABELS[log.severity]}
                      </span>
                    )}
                  </div>
                </div>
                {log.note && (
                  <p className="mt-1 text-sm text-stone-600">{log.note}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showLogModal && (
        <LogBehaviorModal
          behaviorTypes={behaviorTypes}
          onCancel={() => setShowLogModal(false)}
          onSubmit={handleLog}
        />
      )}
    </div>
  );
}
