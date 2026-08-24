"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
};

const DISMISS_KEY_PREFIX = "speechtrack:name-prompt-dismissed:";

/**
 * Shown on the dashboard for any account that doesn't have a full_name in
 * its Supabase auth user_metadata yet (existing accounts from before this
 * field existed, or anyone who skipped it). Asks once per browser session —
 * "Not now" hides it until the next sign-in, it never blocks the app.
 */
export default function NamePromptModal({ userId }: Props) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return (
        window.sessionStorage.getItem(DISMISS_KEY_PREFIX + userId) === "1"
      );
    } catch {
      return false;
    }
  });
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  function dismissForSession() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY_PREFIX + userId, "1");
    } catch {
      // Storage unavailable (private mode, etc.) — just hide for this render.
    }
    setDismissed(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = fullName.trim();
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: trimmed },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    dismissForSession();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-slate-900">
          What should we call you?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Add your name so the dashboard can greet you properly.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="prompt-full-name" className="sr-only">
              Full name
            </label>
            <input
              id="prompt-full-name"
              type="text"
              autoFocus
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Mona"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={dismissForSession}
              disabled={loading}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              Not now
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
