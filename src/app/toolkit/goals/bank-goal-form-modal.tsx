"use client";

import { useState, type FormEvent } from "react";
import type { Area, ResponseFormatOption, ShareVisibility } from "@/lib/types";
import VisibilityField from "@/components/visibility-field";
import type { BankGoalWithRelations } from "./goal-bank-section";

const VISIBILITY_OPTIONS = [
  { value: "private" as const, label: "Private" },
  { value: "shared" as const, label: "Shared" },
];

export type BankGoalFormValues = {
  areaId: string;
  text: string;
  responseFormatId: string | null;
  targetPercent: number | null;
  visibility: ShareVisibility;
};

type Props = {
  mode: "add" | "edit";
  areas: Area[];
  responseFormats: ResponseFormatOption[];
  initialGoal?: BankGoalWithRelations | null;
  onCancel: () => void;
  onSubmit: (values: BankGoalFormValues) => Promise<string | null>;
};

export default function BankGoalFormModal({
  mode,
  areas,
  responseFormats,
  initialGoal,
  onCancel,
  onSubmit,
}: Props) {
  const [areaId, setAreaId] = useState(
    initialGoal?.area_id ?? areas[0]?.id ?? ""
  );
  const [text, setText] = useState(initialGoal?.text ?? "");
  const [responseFormatId, setResponseFormatId] = useState(
    initialGoal?.response_format_id ?? ""
  );
  const [targetPercent, setTargetPercent] = useState(
    initialGoal?.target_percent !== undefined &&
      initialGoal?.target_percent !== null
      ? String(initialGoal.target_percent)
      : ""
  );
  const [visibility, setVisibility] = useState<ShareVisibility>(
    initialGoal?.visibility ?? "private"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!areaId) {
      setError("Please choose an area.");
      return;
    }
    if (!text.trim()) {
      setError("Please enter the goal text.");
      return;
    }

    let targetValue: number | null = null;
    if (targetPercent.trim() !== "") {
      const parsed = Number(targetPercent);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        setError("Target % must be a number between 0 and 100.");
        return;
      }
      targetValue = parsed;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({
      areaId,
      text: text.trim(),
      responseFormatId: responseFormatId || null,
      targetPercent: targetValue,
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
          {mode === "add" ? "Add bank goal" : "Edit bank goal"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="bank-goal-area"
              className="block text-sm font-medium text-stone-700"
            >
              Area
            </label>
            <select
              id="bank-goal-area"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {areas.length === 0 && <option value="">No areas yet</option>}
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="bank-goal-text"
              className="block text-sm font-medium text-stone-700"
            >
              Goal text
            </label>
            <textarea
              id="bank-goal-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g. Will produce /r/ in initial position of words with 80% accuracy"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="bank-goal-format"
                className="block text-sm font-medium text-stone-700"
              >
                Default response format{" "}
                <span className="text-stone-400">(optional)</span>
              </label>
              <select
                id="bank-goal-format"
                value={responseFormatId}
                onChange={(e) => setResponseFormatId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">None</option>
                {responseFormats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="bank-goal-target"
                className="block text-sm font-medium text-stone-700"
              >
                Target % <span className="text-stone-400">(optional)</span>
              </label>
              <input
                id="bank-goal-target"
                type="number"
                min={0}
                max={100}
                value={targetPercent}
                onChange={(e) => setTargetPercent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <VisibilityField
            value={visibility}
            onChange={setVisibility}
            options={VISIBILITY_OPTIONS}
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
                  ? "Add to bank"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
