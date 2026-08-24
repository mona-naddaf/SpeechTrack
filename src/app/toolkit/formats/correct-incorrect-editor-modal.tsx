"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ResponseFormat } from "@/lib/types";

type Props = {
  format: ResponseFormat;
  onCancel: () => void;
  onSaved: (updated: ResponseFormat) => void;
};

export default function CorrectIncorrectEditorModal({
  format,
  onCancel,
  onSaved,
}: Props) {
  const [name, setName] = useState(format.name);
  const [correctLabel, setCorrectLabel] = useState(
    format.config.correctLabel ?? "Correct"
  );
  const [incorrectLabel, setIncorrectLabel] = useState(
    format.config.incorrectLabel ?? "Incorrect"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Please give this format a name.");
      return;
    }
    if (!correctLabel.trim() || !incorrectLabel.trim()) {
      setError("Both labels are required.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("response_formats")
      .update({
        name: name.trim(),
        config: {
          ...format.config,
          correctLabel: correctLabel.trim(),
          incorrectLabel: incorrectLabel.trim(),
        },
      })
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
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-slate-900">
          Edit correct/incorrect format
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Rename the format or customize what the two buttons are labeled.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="ci-format-name"
              className="block text-sm font-medium text-slate-700"
            >
              Format name
            </label>
            <input
              id="ci-format-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ci-correct-label"
                className="block text-sm font-medium text-slate-700"
              >
                &quot;Correct&quot; label
              </label>
              <input
                id="ci-correct-label"
                type="text"
                value={correctLabel}
                onChange={(e) => setCorrectLabel(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <div>
              <label
                htmlFor="ci-incorrect-label"
                className="block text-sm font-medium text-slate-700"
              >
                &quot;Incorrect&quot; label
              </label>
              <input
                id="ci-incorrect-label"
                type="text"
                value={incorrectLabel}
                onChange={(e) => setIncorrectLabel(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
