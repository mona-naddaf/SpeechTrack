import Link from "next/link";
import {
  ArrowRight,
  GraduationCap,
  HeartHandshake,
  LogIn,
} from "lucide-react";

// Small, hand-placed petal dots scattered around the hero — not
// randomized, so the layout stays stable and deliberate rather than
// noisy on every load. Purely decorative (aria-hidden).
const PETALS: { top: string; left: string; size: number; color: string }[] = [
  { top: "4%", left: "10%", size: 8, color: "bg-brand-200" },
  { top: "10%", left: "88%", size: 10, color: "bg-accent-200" },
  { top: "34%", left: "3%", size: 6, color: "bg-amber-200" },
  { top: "60%", left: "94%", size: 7, color: "bg-brand-200" },
  { top: "82%", left: "6%", size: 9, color: "bg-accent-200" },
  { top: "88%", left: "84%", size: 6, color: "bg-amber-200" },
];

const ENTRY_POINTS = [
  {
    href: "/login",
    icon: LogIn,
    title: "Sign in",
    subtitle: "SLP, Teacher, or Supervisor account.",
    iconBg: "bg-brand-100",
    iconColor: "text-brand-600",
    hoverBorder: "hover:border-brand-300",
    ctaColor: "text-brand-700",
  },
  {
    href: "/parent",
    icon: HeartHandshake,
    title: "Parent",
    subtitle: "Log in with your access code.",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    hoverBorder: "hover:border-amber-300",
    ctaColor: "text-amber-700",
  },
  {
    href: "/classroom",
    icon: GraduationCap,
    title: "Teacher",
    subtitle: "Log in with your access code.",
    iconBg: "bg-accent-100",
    iconColor: "text-accent-700",
    hoverBorder: "hover:border-accent-300",
    ctaColor: "text-accent-700",
  },
] as const;

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-cream-50 via-cream-50 to-brand-50 px-6 py-16">
      {/* Soft corner blooms — pure CSS, no image assets, so this stays
          fast-loading. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-28 -top-40 h-80 w-80 rounded-full bg-brand-100/70 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-accent-100/70 blur-3xl"
      />
      {PETALS.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className={`pointer-events-none absolute rounded-full opacity-60 ${p.color}`}
          style={{ top: p.top, left: p.left, width: p.size, height: p.size }}
        />
      ))}

      <div className="relative mx-auto w-full max-w-md text-center">
        <div className="mx-auto h-16 w-16 overflow-hidden rounded-2xl shadow-[0_6px_16px_-8px_rgba(240,78,40,0.45)]">
          {/* src/app/icon.svg, verbatim — the same asset used for the
              browser-tab favicon, reused here rather than a separate
              icon so the two stay in lockstep. Keep this in sync with
              that file if it ever changes. */}
          <svg viewBox="0 0 32 32" className="h-16 w-16">
            <rect width="32" height="32" rx="6" fill="#FFE6DF" />
            <g transform="translate(16 16)">
              <g fill="#F04E28">
                <ellipse cx="0" cy="-6.4" rx="3.3" ry="5.1" />
                <ellipse cx="0" cy="-6.4" rx="3.3" ry="5.1" transform="rotate(90)" />
                <ellipse cx="0" cy="-6.4" rx="3.3" ry="5.1" transform="rotate(180)" />
                <ellipse cx="0" cy="-6.4" rx="3.3" ry="5.1" transform="rotate(270)" />
              </g>
              <circle r="3.1" fill="#FFE6DF" />
            </g>
          </svg>
        </div>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          BloomTrack
        </h1>
        <p className="mt-3 text-lg text-stone-600">
          Growth you can track, progress you can see.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {ENTRY_POINTS.map((entry) => {
            const Icon = entry.icon;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={`group flex flex-col gap-2.5 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${entry.hoverBorder}`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${entry.iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${entry.iconColor}`} />
                </div>
                <div>
                  <p className="font-heading font-bold text-stone-900">
                    {entry.title}
                  </p>
                  <p className="text-xs text-stone-500">{entry.subtitle}</p>
                </div>
                <span
                  className={`mt-auto flex items-center gap-1 text-xs font-semibold ${entry.ctaColor}`}
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
