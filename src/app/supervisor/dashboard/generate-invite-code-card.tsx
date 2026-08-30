"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  /** Most recently generated, still-unredeemed code, if any — fetched
   *  server-side so a page refresh doesn't hide a code that's still
   *  valid to share. */
  initialCode: string | null;
};

/** Lets a Supervisor generate a short invite code to share with an SLP
 *  or Teacher. The code itself is filled in by a database trigger (see
 *  set_supervisor_invite_code_trigger) — this just inserts the row and
 *  displays whatever comes back. */
export default function GenerateInviteCodeCard({ userId, initialCode }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setCopied(false);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("supervisor_invite_codes")
      .insert({ supervisor_id: userId })
      .select("code")
      .single();
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setCode(data.code);
    router.refresh();
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the code is still shown on screen.
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
        <KeyRound className="h-3.5 w-3.5" />
        Invite an SLP or Teacher
      </p>

      {code ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-stone-100 px-4 py-2 text-lg font-semibold tracking-widest text-stone-900">
            {code}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate a new code"}
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-stone-600">
            Generate a code and share it with an SLP or Teacher so they can
            link their account to you.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="mt-3 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? "Generating…" : "Generate invite code"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
