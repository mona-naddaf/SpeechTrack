"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircleHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-lg">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
          <MessageCircleHeart className="h-6 w-6 text-brand-600" />
        </div>

        {sent ? (
          <>
            <h1 className="mt-4 text-2xl font-bold text-stone-900">
              Check your email
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              If an account exists for <strong>{email}</strong>, we&apos;ve
              sent a link to reset your password. It expires after a while,
              so use it soon.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-bold text-stone-900">
              Forgot your password?
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-stone-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
