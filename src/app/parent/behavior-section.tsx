import { Smile } from "lucide-react";
import { getColorOption } from "@/lib/colors";

export type BehaviorBreakdownEntry = {
  id: string;
  name: string;
  color: string;
  count: number;
  percent: number;
};

type Props = {
  breakdown: BehaviorBreakdownEntry[];
};

// Parent-facing behavior summary — a friendly count/breakdown by type
// only. No severity, no notes, no raw log list: that detail stays on the
// SLP/Teacher side. Only rendered at all when the SLP/Teacher has turned
// sharing on for this student (see share_behavior_with_parent).
export default function BehaviorSection({ breakdown }: Props) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
        <Smile className="h-5 w-5 text-brand-500" />
        Behavior
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        A quick look at how things have been going lately.
      </p>

      {breakdown.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100">
            <Smile className="h-5 w-5 text-brand-500" />
          </div>
          <p className="text-stone-500">Nothing logged recently.</p>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            {breakdown.map((entry) => {
              const color = getColorOption(entry.color);
              return (
                <div key={entry.id}>
                  <div className="flex items-center justify-between text-sm text-stone-600">
                    <span className="font-medium">{entry.name}</span>
                    <span>{entry.count}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${color.swatchClass}`}
                      style={{ width: `${entry.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
