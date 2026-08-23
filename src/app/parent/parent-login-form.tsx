"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function ParentLoginForm() {
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
      const res = await fetch("/api/parent/login", {
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
      className="rounded-xl border border-slate-200 bg-white p-6"
    >
      <label
        htmlFor="access-code"
        className="block text-base font-medium text-slate-700"
      >
        Enter your access code
      </label>
      <p className="mt-1 text-sm text-slate-500">
        Your child&apos;s therapist gave you a 6-character code.
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
        className="mt-4 w-full rounded-md border border-slate-300 px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em] focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-md bg-slate-900 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
      >
        {loading ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
