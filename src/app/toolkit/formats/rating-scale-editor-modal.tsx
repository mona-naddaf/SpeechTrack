"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ResponseFormat } from "@/lib/types";

type Props = {
  format: ResponseFormat;
  onCancel: () => void;
  onSaved: (updated: ResponseFormat) => void;
};

export default function RatingScaleEditorModal({
  format,
  onCancel,
  onSaved,
}: Props) {
  const [name, setName] = useState(format.name);
  const [min, setMin] = useState(String(format.config.min ?? 0));
  const [max, setMax] = useState(String(format.config.max ?? 4));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Please give this format a name.");
      return;
    }

    const minValue = Number(min);
    const maxValue = Number(max);
    if (!Number.isInteger(minValue) || !Number.isInteger(maxValue)) {
      setError("Min and max must be whole numbers.");
      return;
    }
    if (maxValue <= minValue) {
      setError("Max must be greater than min.");
      return;
    }
    if (maxValue - minValue > 20) {
      setError("Keep the range to 20 points or fewer.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("response_formats")
      .update({
        name: name.trim(),
        config: { ...format.config, min: minValue, max: maxValue },
      })
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
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">
          Edit rating scale
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Rename the format or change its number range.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="rs-format-name"
              className="block text-sm font-medium text-stone-700"
            >
              Format name
            </label>
            <input
              id="rs-format-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="rs-min"
                className="block text-sm font-medium text-stone-700"
              >
                Min
              </label>
              <input
                id="rs-min"
                type="number"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label
                htmlFor="rs-max"
                className="block text-sm font-medium text-stone-700"
              >
                Max
              </label>
              <input
                id="rs-max"
                type="number"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
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
