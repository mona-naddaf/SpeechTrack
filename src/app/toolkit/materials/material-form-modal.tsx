"use client";

import { useState, type FormEvent } from "react";
import type {
  Area,
  MaterialGoalOption,
  MaterialVisibility,
  MaterialWithRelations,
} from "@/lib/types";
import {
  MATERIAL_VISIBILITY_COMING_SOON,
  MATERIAL_VISIBILITY_LABELS,
  MATERIAL_VISIBILITY_OPTIONS,
  formatGoalOptionLabel,
  isLikelyHttpUrl,
} from "@/lib/materials";
import VisibilityField from "@/components/visibility-field";

const VISIBILITY_FIELD_OPTIONS = MATERIAL_VISIBILITY_OPTIONS.map((value) => ({
  value,
  label: MATERIAL_VISIBILITY_LABELS[value],
  comingSoon: MATERIAL_VISIBILITY_COMING_SOON[value],
}));

export type MaterialFormValues = {
  title: string;
  url: string;
  description: string | null;
  areaId: string;
  goalIds: string[];
  visibility: MaterialVisibility;
};

type Props = {
  mode: "add" | "edit";
  areas: Area[];
  goalOptions: MaterialGoalOption[];
  initialMaterial?: MaterialWithRelations | null;
  onCancel: () => void;
  onSubmit: (values: MaterialFormValues) => Promise<string | null>;
};

export default function MaterialFormModal({
  mode,
  areas,
  goalOptions,
  initialMaterial,
  onCancel,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState(initialMaterial?.title ?? "");
  const [url, setUrl] = useState(initialMaterial?.url ?? "");
  const [description, setDescription] = useState(
    initialMaterial?.description ?? ""
  );
  const [areaId, setAreaId] = useState(
    initialMaterial?.area_id ?? areas[0]?.id ?? ""
  );
  const [goalIds, setGoalIds] = useState<Set<string>>(
    new Set(initialMaterial?.goal_ids ?? [])
  );
  const [visibility, setVisibility] = useState<MaterialVisibility>(
    initialMaterial?.visibility ?? "private"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGoal(goalId: string) {
    setGoalIds((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle) {
      setError("Please give this material a title.");
      return;
    }
    if (!trimmedUrl || !isLikelyHttpUrl(trimmedUrl)) {
      setError(
        "Please enter a valid link starting with http:// or https://"
      );
      return;
    }
    if (!areaId) {
      setError("Please choose a category.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({
      title: trimmedTitle,
      url: trimmedUrl,
      description: description.trim() || null,
      areaId,
      goalIds: Array.from(goalIds),
      visibility,
    });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">
          {mode === "add" ? "Add material" : "Edit material"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="material-title"
              className="block text-sm font-medium text-stone-700"
            >
              Title
            </label>
            <input
              id="material-title"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. /r/ initial position worksheet"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="material-url"
              className="block text-sm font-medium text-stone-700"
            >
              Link
            </label>
            <input
              id="material-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="material-description"
              className="block text-sm font-medium text-stone-700"
            >
              Description <span className="text-stone-400">(optional)</span>
            </label>
            <textarea
              id="material-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="material-area"
              className="block text-sm font-medium text-stone-700"
            >
              Category
            </label>
            <select
              id="material-area"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {areas.length === 0 && <option value="">No categories yet</option>}
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          {goalOptions.length > 0 && (
            <div>
              <span className="block text-sm font-medium text-stone-700">
                Link to goals <span className="text-stone-400">(optional)</span>
              </span>
              <div className="mt-1 flex max-h-32 flex-col gap-1.5 overflow-y-auto rounded-lg border border-stone-200 p-2 text-sm text-stone-600">
                {goalOptions.map((goal) => (
                  <label key={goal.id} className="flex items-start gap-1.5">
                    <input
                      type="checkbox"
                      checked={goalIds.has(goal.id)}
                      onChange={() => toggleGoal(goal.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300"
                    />
                    <span>{formatGoalOptionLabel(goal)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <VisibilityField
            value={visibility}
            onChange={setVisibility}
            options={VISIBILITY_FIELD_OPTIONS}
            gatedValue="shared"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading
                ? "Saving…"
                : mode === "add"
                  ? "Add material"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
