"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CueingLevel, ResponseFormat } from "@/lib/types";
import { COLOR_OPTIONS } from "@/lib/colors";

type Props = {
  format: ResponseFormat;
  onCancel: () => void;
  onSaved: (updated: ResponseFormat) => void;
};

export default function CueingHierarchyEditorModal({
  format,
  onCancel,
  onSaved,
}: Props) {
  const initialLevels = (format.config.levels ?? []) as CueingLevel[];
  const [levels, setLevels] = useState<CueingLevel[]>(
    initialLevels.map((l) => ({ ...l }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLevel(index: number, patch: Partial<CueingLevel>) {
    setLevels((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
  }

  async function handleSave() {
    if (levels.some((l) => !l.name.trim())) {
      setError("Every level needs a name.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("response_formats")
      .update({ config: { ...format.config, levels } })
      .eq("id", format.id)
      .select("id, name, type, config, created_at")
      .single();

    setLoading(false);

    if (error || !data) {
      setError(error?.message ?? "Something went wrong. Please try again.");
      return;
    }

    onSaved(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-slate-900">
          Edit cueing hierarchy
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Rename each level, change its color, or mark it as an independent
          response.
        </p>

        <div className="mt-4 space-y-3">
          {levels.map((level, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3"
            >
              <input
                type="text"
                value={level.name}
                onChange={(e) => updateLevel(i, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                aria-label={`Level ${i + 1} name`}
              />
              <select
                value={level.color}
                onChange={(e) => updateLevel(i, { color: e.target.value })}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                aria-label={`Level ${i + 1} color`}
              >
                {COLOR_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={level.is_independent}
                  onChange={(e) =>
                    updateLevel(i, { is_independent: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Independent
              </label>
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
