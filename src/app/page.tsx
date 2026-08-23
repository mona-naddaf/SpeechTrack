import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          SpeechTrack
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Track and manage your students&apos; speech therapy progress.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow transition-colors hover:bg-slate-700"
        >
          Sign in
        </Link>
        <p className="mt-4 text-sm text-slate-500">
          Parent?{" "}
          <Link href="/parent" className="font-medium underline underline-offset-2 hover:text-slate-700">
            Log in with your access code
          </Link>
        </p>
      </div>
    </main>
  );
}
