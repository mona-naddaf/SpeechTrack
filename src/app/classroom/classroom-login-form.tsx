"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";

// Mirrors ParentLoginForm exactly, just posting to the classroom-contact
// login route instead — a completely separate session/cookie (see
// src/lib/classroom-contact-session.ts).
export default function ClassroomLoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please enter your access code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/classroom-contact/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That code wasn't found. Please try again.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError(
        "Something went wrong. Please check your connection and try again."
      );
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-6"
    >
      <label
        htmlFor="access-code"
        className="flex items-center gap-2 text-base font-medium text-stone-700"
      >
        <KeyRound className="h-5 w-5 text-brand-500" />
        Enter your access code
      </label>
      <p className="mt-1 text-sm text-stone-500">
        The student&apos;s therapist or teacher gave you a 6-character code.
      </p>
      <input
        id="access-code"
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABC123"
        maxLength={6}
        className="mt-4 w-full rounded-lg border border-stone-300 px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-3 text-base font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50"
      >
        {loading ? "Checking…" : "Continue"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
    </form>
  );
}
