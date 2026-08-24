"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  HeartHandshake,
  MessageCircleHeart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserRole, type Role } from "@/lib/role";

type Mode = "sign-in" | "sign-up";
type View = "choose" | "form";

const ROLE_COPY: Record<
  Role,
  { icon: typeof MessageCircleHeart; label: string; signInSubtitle: string; signUpSubtitle: string }
> = {
  slp: {
    icon: MessageCircleHeart,
    label: "Speech-Language Pathologist",
    signInSubtitle: "Sign in to your Speech-Language Pathologist account.",
    signUpSubtitle: "Let's get your caseload set up.",
  },
  teacher: {
    icon: GraduationCap,
    label: "Teacher",
    signInSubtitle: "Sign in to your Teacher account.",
    signUpSubtitle: "Let's get your classroom set up.",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("choose");
  const [mode, setMode] = useState<Mode>("sign-in");
  const [role, setRole] = useState<Role>("slp");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function enterForm(chosenRole: Role) {
    setRole(chosenRole);
    setView("form");
    setError(null);
    setMessage(null);
  }

  function backToChooser() {
    setView("choose");
    setError(null);
    setMessage(null);
  }

  function routeForRole(accountRole: Role) {
    router.push(accountRole === "teacher" ? "/teacher/dashboard" : "/dashboard");
    router.refresh();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (mode === "sign-in") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      routeForRole(getUserRole(data.user));
      return;
    }

    // sign-up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim(), role } },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Email confirmation is disabled for this project, so a successful
    // signUp already returns an active session — go straight in rather
    // than claiming a confirmation email was sent (none is).
    if (data.session) {
      routeForRole(role);
      return;
    }

    // Fallback for the unlikely case signUp didn't return a session (e.g.
    // if email confirmation is ever turned back on for this project) — try
    // signing in immediately with the same credentials instead of showing
    // "check your email" messaging that wouldn't be accurate either way.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!signInError) {
      routeForRole(role);
      return;
    }

    setMessage("Account created! You can sign in now.");
    setMode("sign-in");
    setLoading(false);
  }

  function toggleMode() {
    setMode((m) => (m === "sign-in" ? "sign-up" : "sign-in"));
    setError(null);
    setMessage(null);
  }

  const RoleIcon = ROLE_COPY[role].icon;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-lg">
        {view === "choose" ? (
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        ) : (
          <button
            type="button"
            onClick={backToChooser}
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}

        {view === "choose" ? (
          <>
            <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
              <MessageCircleHeart className="h-6 w-6 text-brand-600" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-stone-900">
              Welcome to SpeechTrack
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Who&apos;s signing in today?
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => enterForm("slp")}
                className="flex w-full items-center gap-3 rounded-xl border border-stone-200 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100">
                  <MessageCircleHeart className="h-5 w-5 text-brand-600" />
                </div>
                <span className="flex-1">
                  <span className="block font-semibold text-stone-900">SLP</span>
                  <span className="block text-sm text-stone-500">
                    Speech-Language Pathologist
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-stone-300" />
              </button>

              <button
                type="button"
                onClick={() => enterForm("teacher")}
                className="flex w-full items-center gap-3 rounded-xl border border-stone-200 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100">
                  <GraduationCap className="h-5 w-5 text-accent-700" />
                </div>
                <span className="flex-1">
                  <span className="block font-semibold text-stone-900">Teacher</span>
                  <span className="block text-sm text-stone-500">
                    Classroom teacher
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-stone-300" />
              </button>

              <Link
                href="/parent"
                className="flex w-full items-center gap-3 rounded-xl border border-stone-200 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <HeartHandshake className="h-5 w-5 text-amber-600" />
                </div>
                <span className="flex-1">
                  <span className="block font-semibold text-stone-900">Parent</span>
                  <span className="block text-sm text-stone-500">
                    Log in with your access code
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-stone-300" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
              <RoleIcon className="h-6 w-6 text-brand-600" />
            </div>

            <h1 className="mt-4 text-2xl font-bold text-stone-900">
              {mode === "sign-in" ? "Welcome back" : "Create an account"}
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {mode === "sign-in"
                ? ROLE_COPY[role].signInSubtitle
                : ROLE_COPY[role].signUpSubtitle}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "sign-up" && (
                <>
                  <div>
                    <label
                      htmlFor="full-name"
                      className="block text-sm font-medium text-stone-700"
                    >
                      Full name
                    </label>
                    <input
                      id="full-name"
                      name="full-name"
                      type="text"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-stone-700">
                      Are you a Speech-Language Pathologist or a Teacher?
                    </span>
                    <div className="mt-1 flex gap-4 text-sm text-stone-600">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="role"
                          checked={role === "slp"}
                          onChange={() => setRole("slp")}
                        />
                        Speech-Language Pathologist
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="role"
                          checked={role === "teacher"}
                          onChange={() => setRole("teacher")}
                        />
                        Teacher
                      </label>
                    </div>
                  </div>
                </>
              )}

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

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-stone-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "sign-in" ? "current-password" : "new-password"
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {message && <p className="text-sm text-accent-700">{message}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading
                  ? "Please wait…"
                  : mode === "sign-in"
                    ? "Sign in"
                    : "Sign up"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-500">
              {mode === "sign-in"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={toggleMode}
                className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
              >
                {mode === "sign-in" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
