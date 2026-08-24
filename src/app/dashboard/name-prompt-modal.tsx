"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
          <Sparkles className="h-5 w-5 text-amber-600" />
        </div>
        <h2 className="mt-3 text-lg font-bold text-stone-900">
          What should we call you?
        </h2>
        <p className="mt-2 text-sm text-stone-600">
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
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={dismissForSession}
              disabled={loading}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              Not now
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
