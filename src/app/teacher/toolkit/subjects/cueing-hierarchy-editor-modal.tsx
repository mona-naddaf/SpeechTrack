"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CueingLevel, ResponseFormat } from "@/lib/types";
import LevelsEditorFieldset from "@/components/levels-editor-fieldset";

type Props = {
  format: ResponseFormat;
  onCancel: () => void;
  onSaved: (updated: ResponseFormat) => void;
  /** Overrides for format types whose config is also just a name + a
   *  level scale (e.g. "language_sample") and so reuse this editor as-is. */
  title?: string;
  description?: string;
};

export default function CueingHierarchyEditorModal({
  format,
  onCancel,
  onSaved,
  title = "Edit cueing hierarchy",
  description = "Rename the format, add or remove levels, change colors, or mark a level as an independent response.",
}: Props) {
  const initialLevels = (format.config.levels ?? []) as CueingLevel[];
  const [name, setName] = useState(format.name);
  const [levels, setLevels] = useState<CueingLevel[]>(
    initialLevels.map((l) => ({ ...l }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Please give this format a name.");
      return;
    }
    if (levels.length === 0) {
      setError("Add at least one level.");
      return;
    }
    if (levels.some((l) => !l.name.trim())) {
      setError("Every level needs a name.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("teacher_response_formats")
      .update({ name: name.trim(), config: { ...format.config, levels } })
      .eq("id", format.id)
      .select("id, name, type, config, visibility, created_at")
      .single();

    setLoading(false);

    if (error || !data) {
      setError(error?.message ?? "Something went wrong. Please try again.");
      return;
    }

    onSaved(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">{title}</h2>
        <p className="mt-1 text-sm text-stone-500">{description}</p>

        <div className="mt-4">
          <label
            htmlFor="cueing-format-name"
            className="block text-sm font-medium text-stone-700"
          >
            Format name
          </label>
          <input
            id="cueing-format-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="mt-4">
          <LevelsEditorFieldset levels={levels} onChange={setLevels} />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
