"use client";

import { useMemo, useState, type FormEvent } from "react";
import type {
  Area,
  BankGoal,
  Goal,
  GoalWithRelations,
  ResponseFormatOption,
} from "@/lib/types";

export type GoalFormValues = {
  areaId: string;
  text: string;
  responseFormatId: string | null;
  baseline: string;
  targetPercent: number | null;
  status: Goal["status"];
  /** Set only when this goal is being created by picking "From goal
   *  bank" — the bank template's own id. Ignored on edit. */
  sourceBankGoalId: string | null;
};

type TextSource = "write" | "bank";

type Props = {
  mode: "add" | "edit";
  areas: Area[];
  responseFormats: ResponseFormatOption[];
  bankGoals: BankGoal[];
  initialGoal?: GoalWithRelations | null;
  onCancel: () => void;
  onSubmit: (values: GoalFormValues) => Promise<string | null>;
};

export default function GoalFormModal({
  mode,
  areas,
  responseFormats,
  bankGoals,
  initialGoal,
  onCancel,
  onSubmit,
}: Props) {
  const [areaId, setAreaId] = useState(
    initialGoal?.area_id ?? areas[0]?.id ?? ""
  );
  const [textSource, setTextSource] = useState<TextSource>("write");
  const [text, setText] = useState(initialGoal?.text ?? "");
  const [selectedBankGoalId, setSelectedBankGoalId] = useState("");
  const [baseline, setBaseline] = useState(initialGoal?.baseline ?? "");
  const [targetPercent, setTargetPercent] = useState(
    initialGoal?.target_percent !== undefined &&
      initialGoal?.target_percent !== null
      ? String(initialGoal.target_percent)
      : ""
  );
  const [responseFormatId, setResponseFormatId] = useState(
    initialGoal?.response_format_id ?? ""
  );
  const [status, setStatus] = useState<Goal["status"]>(
    initialGoal?.status ?? "active"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bankGoalsForArea = useMemo(
    () => bankGoals.filter((g) => g.area_id === areaId),
    [bankGoals, areaId]
  );

  function handleBankGoalSelect(id: string) {
    setSelectedBankGoalId(id);
    const found = bankGoalsForArea.find((g) => g.id === id);
    if (found) {
      setText(found.text);
      // Bank goals can carry a default response format / target % — load
      // them in as a starting point; she can still change either before
      // saving.
      setResponseFormatId(found.response_format_id ?? "");
      setTargetPercent(
        found.target_percent !== null ? String(found.target_percent) : ""
      );
    }
  }

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
      baseline: baseline.trim(),
      targetPercent: targetValue,
      status,
      sourceBankGoalId:
        textSource === "bank" ? selectedBankGoalId || null : null,
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
          {mode === "add" ? "Set a goal" : "Edit goal"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="goal-area"
              className="block text-sm font-medium text-stone-700"
            >
              Area
            </label>
            <select
              id="goal-area"
              value={areaId}
              onChange={(e) => {
                setAreaId(e.target.value);
                setSelectedBankGoalId("");
              }}
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
            <span className="block text-sm font-medium text-stone-700">
              Goal text
            </span>
            <div className="mt-1 flex gap-4 text-sm text-stone-600">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="text-source"
                  checked={textSource === "write"}
                  onChange={() => {
                    setTextSource("write");
                    setSelectedBankGoalId("");
                  }}
                />
                Write new
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="text-source"
                  checked={textSource === "bank"}
                  onChange={() => setTextSource("bank")}
                />
                From goal bank
              </label>
            </div>

            {textSource === "bank" && (
              <select
                value={selectedBankGoalId}
                onChange={(e) => handleBankGoalSelect(e.target.value)}
                className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">
                  {bankGoalsForArea.length === 0
                    ? "No bank goals in this area yet"
                    : "Select a bank goal…"}
                </option>
                {bankGoalsForArea.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.text}
                  </option>
                ))}
              </select>
            )}

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g. Will produce /r/ in initial position of words with 80% accuracy"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="goal-baseline"
                className="block text-sm font-medium text-stone-700"
              >
                Baseline <span className="text-stone-400">(optional)</span>
              </label>
              <input
                id="goal-baseline"
                type="text"
                value={baseline}
                onChange={(e) => setBaseline(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="e.g. 20%"
              />
            </div>
            <div>
              <label
                htmlFor="goal-target"
                className="block text-sm font-medium text-stone-700"
              >
                Target %
              </label>
              <input
                id="goal-target"
                type="number"
                min={0}
                max={100}
                value={targetPercent}
                onChange={(e) => setTargetPercent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="goal-format"
              className="block text-sm font-medium text-stone-700"
            >
              Response format
            </label>
            <select
              id="goal-format"
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
              htmlFor="goal-status"
              className="block text-sm font-medium text-stone-700"
            >
              Status
            </label>
            <select
              id="goal-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Goal["status"])}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="mastered">Mastered</option>
              {/* Only meaningful for a goal that's part of a track — picking
                  it here is the manual override that skips the automatic
                  wait for its turn (requirement 6). */}
              <option value="queued">Queued</option>
            </select>
          </div>

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
                  ? "Set goal"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
