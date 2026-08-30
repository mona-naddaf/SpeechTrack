"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Nav-row button + modal for an SLP or Teacher to redeem a Supervisor's
 *  invite code, linking their account to that Supervisor. Identical for
 *  both roles — redeem_supervisor_invite_code() determines the caller's
 *  role itself, so this component doesn't need to know which dashboard
 *  it's rendered on. */
export default function LinkSupervisorButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function close() {
    setOpen(false);
    setCode("");
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("redeem_supervisor_invite_code", {
      p_code: trimmed,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
      >
        <Link2 className="h-4 w-4" />
        Link to a supervisor
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900">
              Link to a supervisor
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Enter the invite code your supervisor shared with you.
            </p>

            {success ? (
              <>
                <p className="mt-4 text-sm text-accent-700">
                  You&apos;re linked! Your supervisor can now see you on
                  their dashboard.
                </p>
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="supervisor-invite-code" className="sr-only">
                    Invite code
                  </label>
                  <input
                    id="supervisor-invite-code"
                    type="text"
                    autoFocus
                    autoComplete="off"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AB12CD"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-center text-lg font-semibold tracking-widest focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={loading}
                    className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !code.trim()}
                    className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {loading ? "Linking…" : "Link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
