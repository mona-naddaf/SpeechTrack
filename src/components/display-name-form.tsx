"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialValue: string;
  submitLabel?: string;
  autoFocus?: boolean;
  onSaved: (name: string) => void;
};

/** The actual display-name input + save button, shared between the
 *  standalone /settings page and the "set a name first" prompt shown
 *  from VisibilityField when she tries to share something with no
 *  display name set yet. Persists to Supabase auth user_metadata under
 *  `display_name` — same storage pattern as `full_name` (NamePromptModal),
 *  just a separate field: full_name is private (greetings only),
 *  display_name is the one ever shown to someone else. */
export default function DisplayNameForm({
  initialValue,
  submitLabel = "Save",
  autoFocus = false,
  onSaved,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a display name.");
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { display_name: trimmed },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    onSaved(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label
          htmlFor="display-name-input"
          className="block text-sm font-medium text-stone-700"
        >
          Display name
        </label>
        <input
          id="display-name-input"
          type="text"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Ms. Rivera, SLP"
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="mt-1 text-xs text-stone-500">
          The name shown if you share something publicly — it doesn&apos;t
          default to your real name, and you can change it anytime.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {loading ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
