"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status = "verifying" | "ready" | "invalid" | "saving" | "done";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase redirects back here with ?error=...&error_description=...
    // instead of a valid recovery link when the link was already used,
    // expired, or otherwise invalid.
    const description = searchParams.get("error_description");
    if (description) {
      setLinkError(description.replace(/\+/g, " "));
      setStatus("invalid");
      return;
    }

    const supabase = createClient();

    // The client library exchanges the ?code=... in the URL for a
    // session automatically, then fires this event once it's ready.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    // Fallback: if the exchange already completed before we subscribed
    // (or this page was reloaded after the link was already followed),
    // a session existing is good enough to let the user set a password.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus((s) => (s === "verifying" && session ? "ready" : s));
    });

    // If neither happens, the link had no recovery code to begin with.
    const timeout = setTimeout(() => {
      setStatus((s) => {
        if (s !== "verifying") return s;
        setLinkError(
          "This reset link is invalid or has expired. Please request a new one."
        );
        return "invalid";
      });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords don't match.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setFormError(error.message);
      setStatus("ready");
      return;
    }

    // Sign out of the recovery session so the new password gets its
    // first real workout on the way back in.
    await supabase.auth.signOut();
    router.push("/login?reset=success");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-lg">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
          <KeyRound className="h-6 w-6 text-brand-600" />
        </div>

        {status === "verifying" && (
          <>
            <h1 className="mt-4 text-2xl font-bold text-stone-900">
              Verifying your link…
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              One moment while we confirm your reset link.
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1 className="mt-4 text-2xl font-bold text-stone-900">
              Link invalid or expired
            </h1>
            <p className="mt-1 text-sm text-stone-500">{linkError}</p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Request a new link
            </Link>
          </>
        )}

        {(status === "ready" || status === "saving") && (
          <>
            <h1 className="mt-4 text-2xl font-bold text-stone-900">
              Set a new password
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Choose a new password for your account.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-stone-700"
                >
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-stone-700"
                >
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}

              <button
                type="submit"
                disabled={status === "saving"}
                className="w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {status === "saving" ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
