"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ResponseFormat, ShareVisibility } from "@/lib/types";
import VisibilityField from "@/components/visibility-field";

const VISIBILITY_OPTIONS = [
  { value: "private" as const, label: "Private" },
  { value: "shared" as const, label: "Shared" },
];

type CreatableType =
  | "correct_incorrect"
  | "rating_scale"
  | "cueing_hierarchy"
  | "sentence_structure"
  | "language_sample";

const TYPE_OPTIONS: { type: CreatableType; label: string; description: string }[] = [
  {
    type: "correct_incorrect",
    label: "Correct/Incorrect",
    description: "Simple right or wrong scoring.",
  },
  {
    type: "rating_scale",
    label: "Rating scale",
    description: "Score responses on your own numeric range, e.g. 0–4.",
  },
  {
    type: "cueing_hierarchy",
    label: "Cueing hierarchy",
    description: "Track the level of support a student needed to respond.",
  },
  {
    type: "sentence_structure",
    label: "Sentence structure",
    description:
      "Score each part of a multi-part utterance (Subject, Verb, Object, ...) separately in one trial.",
  },
  {
    type: "language_sample",
    label: "Language sample",
    description:
      "Record each utterance the child produces — the word(s), meaning, whether it fit the context, and the support level.",
  },
];

type Props = {
  onCancel: () => void;
  onCreated: (created: ResponseFormat, openEditor: boolean) => void;
};

export default function NewFormatModal({ onCancel, onCreated }: Props) {
  const [type, setType] = useState<CreatableType>("correct_incorrect");
  const [name, setName] = useState("");
  const [correctLabel, setCorrectLabel] = useState("Correct");
  const [incorrectLabel, setIncorrectLabel] = useState("Incorrect");
  const [min, setMin] = useState("0");
  const [max, setMax] = useState("4");
  const [visibility, setVisibility] = useState<ShareVisibility>("private");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please give this format a name.");
      return;
    }

    let config: Record<string, unknown> = {};
    let openEditor = false;

    if (type === "correct_incorrect") {
      if (!correctLabel.trim() || !incorrectLabel.trim()) {
        setError("Both labels are required.");
        return;
      }
      config = {
        correctLabel: correctLabel.trim(),
        incorrectLabel: incorrectLabel.trim(),
      };
    } else if (type === "rating_scale") {
      const minValue = Number(min);
      const maxValue = Number(max);
      if (!Number.isInteger(minValue) || !Number.isInteger(maxValue)) {
        setError("Min and max must be whole numbers.");
        return;
      }
      if (maxValue <= minValue) {
        setError("Max must be greater than min.");
        return;
      }
      if (maxValue - minValue > 20) {
        setError("Keep the range to 20 points or fewer.");
        return;
      }
      config = { min: minValue, max: maxValue };
    } else if (type === "cueing_hierarchy") {
      // cueing_hierarchy — start with two default levels; she customizes
      // levels right after creating, in the same editor used for the
      // built-in default format.
      config = {
        levels: [
          { name: "Independent", color: "green", is_independent: true },
          { name: "With support", color: "amber", is_independent: false },
        ],
      };
      openEditor = true;
    } else if (type === "sentence_structure") {
      // sentence_structure — a sensible Subject/Verb/Object starting point
      // plus the same two default levels cueing_hierarchy starts with
      // (same scale, same editor UI); she customizes both right after
      // creating.
      config = {
        components: [
          { id: crypto.randomUUID(), name: "Subject" },
          { id: crypto.randomUUID(), name: "Verb" },
          { id: crypto.randomUUID(), name: "Object" },
        ],
        levels: [
          { name: "Independent", color: "green", is_independent: true },
          { name: "With support", color: "amber", is_independent: false },
        ],
      };
      openEditor = true;
    } else {
      // language_sample — a typical language-stimulation support scale,
      // most to least independent; fully editable right after creating
      // (same levels editor as cueing_hierarchy).
      config = {
        levels: [
          { name: "Spontaneous", color: "green", is_independent: true },
          { name: "Natural after delayed modeling", color: "teal", is_independent: false },
          { name: "After modeling", color: "amber", is_independent: false },
          { name: "Prompted", color: "clay", is_independent: false },
        ],
      };
      openEditor = true;
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
      .from("teacher_response_formats")
      .insert({
        teacher_id: user.id,
        name: trimmedName,
        type,
        config,
        visibility,
      })
      .select("id, name, type, config, visibility, created_at")
      .single();

    setLoading(false);

    if (error || !data) {
      setError(error?.message ?? "Something went wrong. Please try again.");
      return;
    }

    onCreated(data, openEditor);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">
            New custom response format
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="new-format-name"
                className="block text-sm font-medium text-stone-700"
              >
                Name
              </label>
              <input
                id="new-format-name"
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Effort-based scoring"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-stone-700">
                Type
              </span>
              <div className="mt-2 space-y-2">
                {TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.type}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors ${
                    type === opt.type
                      ? "border-stone-900 bg-cream-50"
                      : "border-stone-200 hover:bg-cream-50"
                  }`}
                  >
                    <input
                      type="radio"
                      name="format-type"
                      className="mt-0.5"
                      checked={type === opt.type}
                      onChange={() => setType(opt.type)}
                    />
                    <span>
                      <span className="block font-medium text-stone-900">
                        {opt.label}
                      </span>
                      <span className="block text-stone-500">
                        {opt.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {type === "correct_incorrect" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="new-correct-label"
                    className="block text-sm font-medium text-stone-700"
                  >
                    &quot;Correct&quot; label
                  </label>
                  <input
                    id="new-correct-label"
                    type="text"
                    value={correctLabel}
                    onChange={(e) => setCorrectLabel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-incorrect-label"
                    className="block text-sm font-medium text-stone-700"
                  >
                    &quot;Incorrect&quot; label
                  </label>
                  <input
                    id="new-incorrect-label"
                    type="text"
                    value={incorrectLabel}
                    onChange={(e) => setIncorrectLabel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}

            {type === "rating_scale" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="new-rs-min"
                    className="block text-sm font-medium text-stone-700"
                  >
                    Min
                  </label>
                  <input
                    id="new-rs-min"
                    type="number"
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-rs-max"
                    className="block text-sm font-medium text-stone-700"
                  >
                    Max
                  </label>
                  <input
                    id="new-rs-max"
                    type="number"
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}

            {type === "cueing_hierarchy" && (
              <p className="text-sm text-stone-500">
                You&apos;ll start with two levels and can add, remove, rename,
                or recolor them right after creating it.
              </p>
            )}

            {type === "sentence_structure" && (
              <p className="text-sm text-stone-500">
                You&apos;ll start with Subject/Verb/Object and two levels —
                fully editable (add, remove, rename, reorder) right after
                creating it.
              </p>
            )}

            {type === "language_sample" && (
              <p className="text-sm text-stone-500">
                You&apos;ll start with four support levels (Spontaneous, Natural
                after delayed modeling, After modeling, Prompted) — rename,
                recolor, add, or remove them right after creating it.
              </p>
            )}

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
                {loading ? "Creating…" : "Create format"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
