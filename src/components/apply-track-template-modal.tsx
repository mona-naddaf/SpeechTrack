"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ResponseFormatOption = { id: string; name: string };

export type ApplyTemplateStep = {
  id: string;
  order_index: number;
  goal_text: string;
  response_format_id: string | null;
  target_percent: number | null;
};

/** A saved template, normalized to a side-agnostic shape — the caller
 *  maps its area_id/subject_id into `categoryId` before passing this
 *  down, same normalization BulkAssignTrackModal's BulkAssignBankGoal
 *  already does for bank goals. Covers a template from either origin
 *  (saved from a track, or built from scratch) — they're indistinguishable
 *  once saved. */
export type ApplyTemplateOption = {
  id: string;
  name: string;
  categoryId: string;
  steps: ApplyTemplateStep[];
};

/** Per-step overrides she can adjust before finalizing — these might
 *  vary slightly per student even when the goal text/order doesn't. */
type StepOverride = {
  responseFormatId: string;
  targetPercent: string;
};

type Props = {
  studentId: string;
  templates: ApplyTemplateOption[];
  responseFormats: ResponseFormatOption[];
  /** Account-wide default — pre-selected for steps without their own format. */
  defaultFormatId: string | null;
  goalsTable: "goals" | "teacher_goals";
  tracksTable: "goal_tracks" | "teacher_goal_tracks";
  categoryTable: "areas" | "teacher_subjects";
  responseFormatTable: "response_formats" | "teacher_response_formats";
  categoryIdColumn: "area_id" | "subject_id";
  ownerColumn: "slp_id" | "teacher_id";
  onCancel: () => void;
  /** Same result shape BulkAssignTrackModal hands back, so both sides'
   *  goals-section.tsx can fold it into the goal/track list the same way. */
  onDone: (result: {
    insertedGoals: Record<string, unknown>[];
    newTrack: { id: string; name: string } | null;
  }) => void;
};

/** PATH the requirement calls "Apply a track template": pick one of her
 *  saved templates (from either origin — Save-as-template or built from
 *  scratch, they behave identically), adjust response format/target %
 *  per step if this student needs something different, then create a
 *  brand-new track with all its steps assigned as goals in order — first
 *  step active, the rest queued, exactly like a freshly bulk-assigned
 *  track. */
export default function ApplyTrackTemplateModal({
  studentId,
  templates,
  responseFormats,
  defaultFormatId,
  goalsTable,
  tracksTable,
  categoryTable,
  responseFormatTable,
  categoryIdColumn,
  ownerColumn,
  onCancel,
  onDone,
}: Props) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [trackName, setTrackName] = useState(templates[0]?.name ?? "");
  const [overrides, setOverrides] = useState<Record<string, StepOverride>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId]
  );
  const sortedSteps = useMemo(
    () => (template ? [...template.steps].sort((a, b) => a.order_index - b.order_index) : []),
    [template]
  );

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const next = templates.find((t) => t.id === id);
    setTrackName(next?.name ?? "");
    setOverrides({});
  }

  function overrideFor(step: ApplyTemplateStep): StepOverride {
    return (
      overrides[step.id] ?? {
        // A step's own format wins; otherwise the account default.
        responseFormatId: step.response_format_id ?? defaultFormatId ?? "",
        targetPercent:
          step.target_percent !== null ? String(step.target_percent) : "",
      }
    );
  }

  function setOverride(step: ApplyTemplateStep, patch: Partial<StepOverride>) {
    setOverrides((prev) => ({
      ...prev,
      [step.id]: { ...overrideFor(step), ...patch },
    }));
  }

  async function handleSubmit() {
    if (!template) {
      setError("Pick a template.");
      return;
    }
    if (!trackName.trim()) {
      setError("Name the new track.");
      return;
    }
    if (sortedSteps.length === 0) {
      setError("This template has no steps yet.");
      return;
    }

    // Validate every target % override up front, same range the goal form
    // itself enforces.
    for (const step of sortedSteps) {
      const raw = overrideFor(step).targetPercent.trim();
      if (raw === "") continue;
      const parsed = Number(raw);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        setError("Target % must be a number between 0 and 100.");
        return;
      }
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

    const { data: trackData, error: trackError } = await (supabase.from(tracksTable) as any)
      .insert({
        [ownerColumn]: user.id,
        student_id: studentId,
        name: trackName.trim(),
      })
      .select("id, name")
      .single();

    if (trackError || !trackData) {
      setLoading(false);
      setError(trackError?.message ?? "Couldn't create the track.");
      return;
    }

    const newTrack = { id: trackData.id as string, name: trackData.name as string };

    const insertRows = sortedSteps.map((step, i) => {
      const override = overrideFor(step);
      const targetRaw = override.targetPercent.trim();
      return {
        [ownerColumn]: user.id,
        student_id: studentId,
        [categoryIdColumn]: template.categoryId,
        text: step.goal_text,
        response_format_id: override.responseFormatId || null,
        target_percent: targetRaw === "" ? null : Number(targetRaw),
        // First step (in order) starts active — the rest wait their turn,
        // same as a brand-new bulk-assigned track.
        status: i === 0 ? "active" : "queued",
        track_id: newTrack.id,
        step_order: i + 1,
      };
    });

    const categoryAlias = categoryIdColumn === "area_id" ? "area" : "subject";
    const { data: inserted, error: insertError } = await (supabase.from(goalsTable) as any)
      .insert(insertRows)
      .select(
        `id, student_id, ${categoryIdColumn}, text, response_format_id, baseline, target_percent, status, track_id, step_order, visible_to_parent, created_at, ${categoryAlias}:${categoryTable}(id, name), response_format:${responseFormatTable}(id, name), track:${tracksTable}(id, name)`
      );

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onDone({ insertedGoals: (inserted ?? []) as Record<string, unknown>[], newTrack });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">Apply a track template</h2>
          <p className="mt-1 text-sm text-stone-500">
            Creates a new track for this student from one of your saved
            templates — the first step starts active, the rest wait their
            turn. Adjust response format or target % per step if this
            student needs something different.
          </p>

          {templates.length === 0 ? (
            <p className="mt-4 rounded-lg bg-cream-50 p-3 text-sm text-stone-600">
              No saved templates yet — build one in the Track Templates
              library, or save an existing track as a template from its
              ladder view.
            </p>
          ) : (
            <>
              <div className="mt-4">
                <label
                  htmlFor="apply-template-select"
                  className="block text-sm font-medium text-stone-700"
                >
                  Template
                </label>
                <select
                  id="apply-template-select"
                  value={templateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.steps.length} step{t.steps.length === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="apply-template-track-name"
                  className="block text-sm font-medium text-stone-700"
                >
                  New track name
                </label>
                <input
                  id="apply-template-track-name"
                  type="text"
                  value={trackName}
                  onChange={(e) => setTrackName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-lg border border-stone-200 p-3">
                {sortedSteps.map((step, i) => {
                  const override = overrideFor(step);
                  return (
                    <div key={step.id} className="rounded-lg border border-stone-100 p-3">
                      <p className="text-sm font-medium text-stone-800">
                        <span className="text-stone-400">{i + 1}.</span> {step.goal_text}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs font-medium text-stone-500">
                          Response format
                          <select
                            value={override.responseFormatId}
                            onChange={(e) =>
                              setOverride(step, { responseFormatId: e.target.value })
                            }
                            className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="">None</option>
                            {responseFormats.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs font-medium text-stone-500">
                          Target %
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={override.targetPercent}
                            onChange={(e) =>
                              setOverride(step, { targetPercent: e.target.value })
                            }
                            className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              Cancel
            </button>
            {templates.length > 0 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? "Applying…" : "Apply template"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
