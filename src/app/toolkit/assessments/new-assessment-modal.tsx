"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Area, Assessment, AssessmentFormality, AssessmentKind } from "@/lib/types";
import { ASSESSMENT_FORMALITY_LABELS, ASSESSMENT_KIND_LABELS } from "@/lib/assessment";

type Props = {
  areas: Area[];
  onCancel: () => void;
  onCreated: (created: Assessment) => void;
};

const KINDS: AssessmentKind[] = ["screening", "assessment"];
const FORMALITIES: AssessmentFormality[] = ["formal", "informal"];

export default function NewAssessmentModal({ areas, onCancel, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<AssessmentKind | "">("");
  const [formality, setFormality] = useState<AssessmentFormality | "">("");
  const [areaIds, setAreaIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleArea(areaId: string) {
    setAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please give this assessment a name.");
      return;
    }
    if (!kind) {
      setError("Please choose a kind.");
      return;
    }
    if (!formality) {
      setError("Please choose a formality.");
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

    const { data, error } = await supabase
      .from("assessments")
      .insert({
        slp_id: user.id,
        name: trimmedName,
        description: description.trim() || null,
        kind,
        formality,
      })
      .select("id, name, description, kind, formality, created_at")
      .single();

    if (error || !data) {
      setLoading(false);
      setError(error?.message ?? "Something went wrong. Please try again.");
      return;
    }

    if (areaIds.size > 0) {
      const { error: areasError } = await supabase.from("assessment_areas").insert(
        Array.from(areaIds).map((areaId) => ({
          assessment_id: data.id,
          area_id: areaId,
        }))
      );
      setLoading(false);
      if (areasError) {
        setError(areasError.message);
        return;
      }
    } else {
      setLoading(false);
    }

    onCreated(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-slate-900">New assessment</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="assessment-name"
              className="block text-sm font-medium text-slate-700"
            >
              Name
            </label>
            <input
              id="assessment-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Artic screener"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="assessment-description"
              className="block text-sm font-medium text-slate-700"
            >
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="assessment-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700">Kind</span>
            <div className="mt-1 flex gap-4 text-sm text-slate-600">
              {KINDS.map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="assessment-kind"
                    checked={kind === k}
                    onChange={() => setKind(k)}
                  />
                  {ASSESSMENT_KIND_LABELS[k]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700">
              Formality
            </span>
            <div className="mt-1 flex gap-4 text-sm text-slate-600">
              {FORMALITIES.map((f) => (
                <label key={f} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="assessment-formality"
                    checked={formality === f}
                    onChange={() => setFormality(f)}
                  />
                  {ASSESSMENT_FORMALITY_LABELS[f]}
                </label>
              ))}
            </div>
          </div>

          {areas.length > 0 && (
            <div>
              <span className="block text-sm font-medium text-slate-700">
                Areas <span className="text-slate-400">(optional)</span>
              </span>
              <div className="mt-1 flex max-h-32 flex-wrap gap-x-4 gap-y-1.5 overflow-y-auto text-sm text-slate-600">
                {areas.map((area) => (
                  <label key={area.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={areaIds.has(area.id)}
                      onChange={() => toggleArea(area.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {area.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create assessment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
