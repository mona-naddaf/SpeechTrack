"use client";

import { useMemo } from "react";
import { BarChart3, Smile } from "lucide-react";
import { formatDate } from "@/lib/date";
import { getColorOption } from "@/lib/colors";
import { SEVERITY_CLASSES, SEVERITY_LABELS } from "@/lib/behavior";
import type { BehaviorSeverity, BehaviorType } from "@/lib/types";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";

/** Structurally identical between the SLP (SlpBehaviorLogWithType) and
 *  Teacher (BehaviorLogWithType) shapes — see src/lib/types.ts — so one
 *  view works for both without needing the role-specific type name. */
export type SupervisorBehaviorLogDisplay = {
  id: string;
  date: string;
  severity: BehaviorSeverity | null;
  note: string | null;
  behavior_type: { id: string; name: string; color: string } | null;
};

type Props = {
  logs: SupervisorBehaviorLogDisplay[];
  error: string | null;
  behaviorTypes: BehaviorType[];
};

/** Read-only mirror of BehaviorSection — same trend chart and log list,
 *  no "Log behavior" button and no share-with-parent toggle. */
export default function BehaviorView({ logs, error, behaviorTypes }: Props) {
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("behavior");

  const breakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      const key = log.behavior_type?.id ?? "unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const maxCount = Math.max(1, ...counts.values());
    return behaviorTypes
      .map((bt) => ({ behaviorType: bt, count: counts.get(bt.id) ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((entry) => ({ ...entry, percent: Math.round((entry.count / maxCount) * 100) }));
  }, [logs, behaviorTypes]);

  return (
    <div>
      <SectionHeader
        icon={Smile}
        title="Behavior"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />

      {!collapsed && (
        <>
          {error && (
            <p className="mt-4 text-sm text-red-600">
              Couldn&apos;t load behavior logs: {error}
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

          {!error && logs.length === 0 && (
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
                    {log.note && (
                      <p className="mt-1 text-sm text-stone-600">{log.note}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
