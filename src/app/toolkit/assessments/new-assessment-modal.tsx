"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Assessment } from "@/lib/types";

type Props = {
  onCancel: () => void;
  onCreated: (created: Assessment) => void;
};

export default function NewAssessmentModal({ onCancel, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please give this assessment a name.");
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
      })
      .select("id, name, description, created_at")
      .single();

    setLoading(false);

    if (error || !data) {
      setError(error?.message ?? "Something went wrong. Please try again.");
      return;
    }

    onCreated(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
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
