"use client";

import { useState, type FormEvent } from "react";
import type { TeacherReinforcementBoard } from "@/lib/types";
import {
  DEFAULT_STEP_COUNT,
  MAX_STEP_COUNT,
  MIN_STEP_COUNT,
  REINFORCEMENT_GAME_TYPES,
  type ReinforcementGameType,
} from "@/lib/reinforcement-games";

export type BoardFormValues = {
  name: string;
  type: ReinforcementGameType;
  stepCount: number;
};

type Props = {
  mode: "add" | "edit";
  initialBoard?: TeacherReinforcementBoard | null;
  onCancel: () => void;
  onSubmit: (values: BoardFormValues) => Promise<string | null>;
};

export default function BoardFormModal({
  mode,
  initialBoard,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialBoard?.name ?? "");
  const [type, setType] = useState<ReinforcementGameType>(
    (initialBoard?.type as ReinforcementGameType) ??
      REINFORCEMENT_GAME_TYPES[0].value
  );
  const [stepCount, setStepCount] = useState(
    initialBoard?.step_count ?? DEFAULT_STEP_COUNT
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please give this board a name.");
      return;
    }
    if (stepCount < MIN_STEP_COUNT || stepCount > MAX_STEP_COUNT) {
      setError(`Steps must be between ${MIN_STEP_COUNT} and ${MAX_STEP_COUNT}.`);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await onSubmit({ name: trimmedName, type, stepCount });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">
          {mode === "add" ? "New reinforcement board" : "Edit board"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="board-name"
              className="block text-sm font-medium text-stone-700"
            >
              Name
            </label>
            <input
              id="board-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rocket reward"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-stone-700">
              Mini-game
            </span>
            <div className="mt-1.5 space-y-2">
              {REINFORCEMENT_GAME_TYPES.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors ${
                    type === option.value
                      ? "border-brand-500 bg-brand-50"
                      : "border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="board-type"
                    checked={type === option.value}
                    onChange={() => setType(option.value)}
                    className="mt-0.5 h-4 w-4 shrink-0 border-stone-300"
                  />
                  <span>
                    <span className="block font-medium text-stone-900">
                      {option.label}
                    </span>
                    <span className="block text-stone-500">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="board-step-count"
              className="block text-sm font-medium text-stone-700"
            >
              Steps
            </label>
            <input
              id="board-step-count"
              type="number"
              min={MIN_STEP_COUNT}
              max={MAX_STEP_COUNT}
              required
              value={stepCount}
              onChange={(e) => setStepCount(Number(e.target.value))}
              className="mt-1 w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-stone-500">
              How many obstacles/stars to hop or fly past before the
              celebration.
            </p>
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
                  ? "Add board"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
