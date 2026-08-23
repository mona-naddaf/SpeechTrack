import { getColorOption } from "@/lib/colors";
import type { LevelBreakdownEntry } from "@/lib/progress";

type Props = {
  entries: LevelBreakdownEntry[];
};

export default function LevelBreakdownBars({ entries }: Props) {
  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const color = getColorOption(entry.color);
        return (
          <div key={entry.name}>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">
                {entry.name}
                {entry.isIndependent && (
                  <span className="ml-1 text-slate-400">(independent)</span>
                )}
              </span>
              <span>
                {entry.percent}% ({entry.count})
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${color.swatchClass}`}
                style={{ width: `${entry.percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
