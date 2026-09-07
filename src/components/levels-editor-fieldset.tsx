"use client";

import type { CueingLevel } from "@/lib/types";
import { COLOR_OPTIONS } from "@/lib/colors";

const NEW_LEVEL_COLORS = ["teal", "amber", "clay", "blue", "purple", "grey"];

type Props = {
  levels: CueingLevel[];
  onChange: (levels: CueingLevel[]) => void;
};

/** The add/remove/rename/recolor/mark-independent level editor shared by
 *  every format type that uses a CueingLevel[] scale — originally the
 *  Cueing hierarchy editor's own inline UI, factored out so the Sentence
 *  structure editor (and any future one) can reuse the exact same
 *  interaction rather than a second copy of it. Fully controlled: the
 *  caller owns the `levels` array and just re-renders with whatever
 *  `onChange` hands back. */
export default function LevelsEditorFieldset({ levels, onChange }: Props) {
  function updateLevel(index: number, patch: Partial<CueingLevel>) {
    onChange(levels.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLevel() {
    const color = NEW_LEVEL_COLORS[levels.length % NEW_LEVEL_COLORS.length];
    onChange([...levels, { name: "New level", color, is_independent: false }]);
  }

  function removeLevel(index: number) {
    onChange(levels.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {levels.map((level, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 p-3"
        >
          <input
            type="text"
            value={level.name}
            onChange={(e) => updateLevel(i, { name: e.target.value })}
            className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label={`Level ${i + 1} name`}
          />
          <select
            value={level.color}
            onChange={(e) => updateLevel(i, { color: e.target.value })}
            className="rounded-lg border border-stone-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label={`Level ${i + 1} color`}
          >
            {COLOR_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={level.is_independent}
              onChange={(e) => updateLevel(i, { is_independent: e.target.checked })}
              className="h-4 w-4 rounded border-stone-300"
            />
            Independent
          </label>
          <button
            type="button"
            onClick={() => removeLevel(i)}
            disabled={levels.length <= 1}
            aria-label={`Remove level ${i + 1}`}
            className="rounded-md px-2 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addLevel}
        className="w-full rounded-lg border border-dashed border-stone-300 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-cream-50"
      >
        + Add level
      </button>
    </div>
  );
}
