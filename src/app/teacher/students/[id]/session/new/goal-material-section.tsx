"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { isLikelyHttpUrl } from "@/lib/materials";
import { formatDate } from "@/lib/date";
import type { MaterialChip } from "@/lib/types";
import type { MaterialUsageSummary } from "@/lib/progress";

export type AddMaterialResult = { material: MaterialChip } | { error: string };

type Props = {
  materials: MaterialChip[];
  activeMaterialId: string | null;
  lastUsedStats: MaterialUsageSummary | null;
  onSelect: (materialId: string | null) => void;
  onAddMaterial: (title: string, url: string) => Promise<AddMaterialResult>;
};

/** The small "which material am I using for this goal right now" widget
 *  on a session-logging goal card. Stays out of the way when there's
 *  nothing to pick from yet — just a quiet "+ Add material" link, not an
 *  empty dropdown — and expands into a real picker once there's at least
 *  one linked material or she starts adding one. */
export default function GoalMaterialSection({
  materials,
  activeMaterialId,
  lastUsedStats,
  onSelect,
  onAddMaterial,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const activeMaterial = materials.find((m) => m.id === activeMaterialId) ?? null;

  function handleSelectChange(value: string) {
    if (value === "__add_new__") {
      setShowAddForm(true);
      setAddError(null);
      return;
    }
    onSelect(value || null);
  }

  function cancelAddForm() {
    setShowAddForm(false);
    setAddError(null);
    setNewTitle("");
    setNewUrl("");
  }

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = newTitle.trim();
    const trimmedUrl = newUrl.trim();

    if (!trimmedTitle || !isLikelyHttpUrl(trimmedUrl)) {
      setAddError(
        "Please enter a title and a valid link starting with http:// or https://"
      );
      return;
    }

    setAdding(true);
    setAddError(null);
    const result = await onAddMaterial(trimmedTitle, trimmedUrl);
    setAdding(false);

    if ("error" in result) {
      setAddError(result.error);
      return;
    }

    setShowAddForm(false);
    setNewTitle("");
    setNewUrl("");
  }

  // Nothing linked yet and she hasn't started adding one — a bare, quiet
  // link rather than an empty-looking picker box.
  if (materials.length === 0 && !showAddForm) {
    return (
      <button
        type="button"
        onClick={() => setShowAddForm(true)}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-stone-400 transition-colors hover:text-brand-700"
      >
        <Plus className="h-3 w-3" />
        Add material
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-stone-200 bg-cream-50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-stone-500">Material</span>
        {activeMaterial && (
          <a
            href={activeMaterial.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        )}
      </div>

      {materials.length > 0 && (
        <select
          value={activeMaterialId ?? ""}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">None selected</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.title}
            </option>
          ))}
          <option value="__add_new__">+ Add new material…</option>
        </select>
      )}

      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="mt-2 space-y-1.5">
          <input
            type="text"
            required
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <input
            type="url"
            required
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={cancelAddForm}
              disabled={adding}
              className="rounded-md px-2 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="rounded-md bg-brand-700 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add & use"}
            </button>
          </div>
        </form>
      )}

      {lastUsedStats && (
        <p className="mt-1.5 text-xs text-stone-500">
          Last used: {lastUsedStats.percent}%{" "}
          {lastUsedStats.metricLabel.replace(/^%\s*/, "")} (
          {formatDate(lastUsedStats.sessionDate)})
        </p>
      )}
    </div>
  );
}
