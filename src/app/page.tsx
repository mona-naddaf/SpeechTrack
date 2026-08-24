import Link from "next/link";
import { MessageCircleHeart, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 shadow-sm">
          <MessageCircleHeart className="h-8 w-8 text-brand-600" strokeWidth={2} />
        </div>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          SpeechTrack
        </h1>
        <p className="mt-4 text-lg text-stone-600">
          Track and manage your students&apos; speech therapy progress.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-lg"
        >
          Sign in
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-sm text-stone-500">
          Parent?{" "}
          <Link
            href="/parent"
            className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800"
          >
            Log in with your access code
          </Link>
        </p>
      </div>
    </main>
  );
}
