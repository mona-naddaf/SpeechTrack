"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type CategoryOption = { id: string; name: string };

/** One step already sitting in the track being saved — just enough to
 *  snapshot into a track_template_steps/teacher_track_template_steps row.
 *  Steps are captured in their current step_order, unaffected by
 *  whatever happens to the original track afterwards. */
export type SaveAsTemplateStep = {
  text: string;
  response_format_id: string | null;
  target_percent: number | null;
};

type Props = {
  /** Used to prefill the template name (she can rename it). */
  trackName: string;
  steps: SaveAsTemplateStep[];
  categoryLabel: "Area" | "Subject";
  categories: CategoryOption[];
  /** Defaults the template's single area/subject to whatever the track's
   *  own goals are tagged with — most tracks are all one area, but she can
   *  still change it since nothing enforces that. */
  defaultCategoryId: string;
  templatesTable: "track_templates" | "teacher_track_templates";
  templateStepsTable: "track_template_steps" | "teacher_track_template_steps";
  categoryIdColumn: "area_id" | "subject_id";
  ownerColumn: "slp_id" | "teacher_id";
  onCancel: () => void;
  onDone: () => void;
};

/** PATH A of Track Templates: snapshot an existing student's track into a
 *  brand-new, standalone template — the original track/goals are never
 *  touched. Once saved, this template is indistinguishable from one built
 *  from scratch in the library (PATH B) — same two tables either way. */
export default function SaveTrackAsTemplateModal({
  trackName,
  steps,
  categoryLabel,
  categories,
  defaultCategoryId,
  templatesTable,
  templateStepsTable,
  categoryIdColumn,
  ownerColumn,
  onCancel,
  onDone,
}: Props) {
  const [name, setName] = useState(trackName);
  const [categoryId, setCategoryId] = useState(
    defaultCategoryId || categories[0]?.id || ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please name this template.");
      return;
    }
    if (!categoryId) {
      setError(`Please choose a ${categoryLabel.toLowerCase()}.`);
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("You need to be signed in.");
      return;
    }

    const { data: template, error: templateError } = await (
      supabase.from(templatesTable) as any
    )
      .insert({
        [ownerColumn]: user.id,
        name: trimmed,
        [categoryIdColumn]: categoryId,
      })
      .select("id")
      .single();

    if (templateError || !template) {
      setLoading(false);
      setError(templateError?.message ?? "Something went wrong. Please try again.");
      return;
    }

    const { error: stepsError } = await (supabase.from(templateStepsTable) as any).insert(
      steps.map((step, i) => ({
        template_id: template.id,
        order_index: i + 1,
        goal_text: step.text,
        response_format_id: step.response_format_id,
        target_percent: step.target_percent,
      }))
    );

    setLoading(false);

    if (stepsError) {
      setError(stepsError.message);
      return;
    }

    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">Save as template</h2>
        <p className="mt-1 text-sm text-stone-500">
          Captures this track&apos;s current {steps.length} step
          {steps.length === 1 ? "" : "s"} into a reusable template. This
          student&apos;s track is left exactly as it is.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="template-name"
              className="block text-sm font-medium text-stone-700"
            >
              Template name
            </label>
            <input
              id="template-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="template-category"
              className="block text-sm font-medium text-stone-700"
            >
              {categoryLabel}
            </label>
            <select
              id="template-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {categories.length === 0 && <option value="">None yet</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <ol className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-3 text-sm text-stone-600">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 font-medium text-stone-400">
                  {i + 1}.
                </span>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>

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
              {loading ? "Saving…" : "Save template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
