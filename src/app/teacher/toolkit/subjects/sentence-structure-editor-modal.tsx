"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CueingLevel, ResponseFormat, SentenceStructureComponent } from "@/lib/types";
import LevelsEditorFieldset from "@/components/levels-editor-fieldset";

type Props = {
  format: ResponseFormat;
  onCancel: () => void;
  onSaved: (updated: ResponseFormat) => void;
};

function newComponent(name: string): SentenceStructureComponent {
  return { id: crypto.randomUUID(), name };
}

/** Edits a "sentence_structure" format: the ordered list of components
 *  (e.g. Subject / is-are / Verb / -ing / Object) plus the same
 *  add/remove/rename/recolor level scale a Cueing hierarchy uses —
 *  LevelsEditorFieldset below is the exact same component that editor
 *  renders, not a lookalike. */
export default function SentenceStructureEditorModal({
  format,
  onCancel,
  onSaved,
}: Props) {
  const [name, setName] = useState(format.name);
  const [components, setComponents] = useState<SentenceStructureComponent[]>(
    (format.config.components ?? []).map((c) => ({ ...c }))
  );
  const [levels, setLevels] = useState<CueingLevel[]>(
    (format.config.levels ?? []).map((l) => ({ ...l }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateComponent(index: number, name: string) {
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, name } : c)));
  }

  function addComponent() {
    setComponents((prev) => [...prev, newComponent("New part")]);
  }

  function removeComponent(index: number) {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  }

  function moveComponent(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= components.length) return;
    setComponents((prev) => {
      const next = [...prev];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Please give this format a name.");
      return;
    }
    if (components.length === 0) {
      setError("Add at least one component.");
      return;
    }
    if (components.some((c) => !c.name.trim())) {
      setError("Every component needs a name.");
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
      .update({
        name: name.trim(),
        config: { ...format.config, components, levels },
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">
            Edit sentence structure
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Set the parts of the utterance you&apos;re tracking, in order, and
            the support-level scale each one gets scored against.
          </p>

          <div className="mt-4">
            <label
              htmlFor="sentence-structure-name"
              className="block text-sm font-medium text-stone-700"
            >
              Format name
            </label>
            <input
              id="sentence-structure-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="mt-4">
            <span className="block text-sm font-medium text-stone-700">
              Components
            </span>
            <div className="mt-2 space-y-2">
              {components.map((component, i) => (
                <div
                  key={component.id}
                  className="flex items-center gap-2 rounded-lg border border-stone-200 p-2"
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveComponent(i, "up")}
                      disabled={i === 0}
                      aria-label={`Move ${component.name || "component"} earlier`}
                      className="rounded p-0.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveComponent(i, "down")}
                      disabled={i === components.length - 1}
                      aria-label={`Move ${component.name || "component"} later`}
                      className="rounded p-0.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={component.name}
                    onChange={(e) => updateComponent(i, e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    aria-label={`Component ${i + 1} name`}
                  />
                  <button
                    type="button"
                    onClick={() => removeComponent(i)}
                    disabled={components.length <= 1}
                    aria-label={`Remove component ${i + 1}`}
                    className="rounded-md px-2 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addComponent}
                className="w-full rounded-lg border border-dashed border-stone-300 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-cream-50"
              >
                + Add component
              </button>
            </div>
          </div>

          <div className="mt-4">
            <span className="block text-sm font-medium text-stone-700">
              Support levels
            </span>
            <div className="mt-2">
              <LevelsEditorFieldset levels={levels} onChange={setLevels} />
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
    </div>
  );
}
