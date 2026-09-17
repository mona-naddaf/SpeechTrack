"use client";

import { useMemo } from "react";
import { Rocket } from "lucide-react";
import CelebrationToast from "@/components/celebration-toast";
import { useReinforcementProgress } from "./use-reinforcement-progress";

type Props = {
  stepCount: number;
  /** Fires once each time the rocket reaches the planet. */
  onLevelCleared?: () => void;
};

// How far up the track (as a % of its height) the planet sits — kept
// short of 100% so the rocket and planet both stay fully on-screen.
const TRACK_SPAN_PCT = 88;

// Deterministic scatter of star x-offsets (no Math.random, so the
// server-rendered and hydrated markup always match).
const STAR_X_OFFSETS = [18, 68, 40, 82, 12, 58, 28, 72, 46, 88, 34, 62];

/** Original character: a simple rounded rocket, no resemblance to any
 *  existing franchise character. */
function RocketCharacter() {
  return (
    <svg width="40" height="52" viewBox="0 0 40 52" aria-hidden focusable="false">
      <ellipse cx="20" cy="50" rx="9" ry="2" fill="#000000" opacity="0.12" />
      <path d="M20 2 C28 10 30 20 30 30 L10 30 C10 20 12 10 20 2 Z" fill="#FF6B47" />
      <rect x="10" y="30" width="20" height="10" rx="4" fill="#FFF4F1" />
      <circle cx="20" cy="20" r="5" fill="#22A390" />
      <circle cx="20" cy="20" r="2.2" fill="#EFFBF9" />
      <path d="M10 30 L2 40 L10 38 Z" fill="#CC3B1A" />
      <path d="M30 30 L38 40 L30 38 Z" fill="#CC3B1A" />
      <path d="M14 40 Q20 48 26 40 Q20 46 14 40 Z" fill="#FBBF24" />
    </svg>
  );
}

function Planet() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden focusable="false">
      <circle cx="28" cy="28" r="17" fill="#7ED7C8" />
      <circle cx="22" cy="22" r="3" fill="#47BFAC" opacity="0.7" />
      <circle cx="33" cy="30" r="2.2" fill="#47BFAC" opacity="0.7" />
      <ellipse
        cx="28"
        cy="30"
        rx="26"
        ry="6"
        fill="none"
        stroke="#FFA98F"
        strokeWidth="3"
        transform="rotate(-14 28 30)"
      />
    </svg>
  );
}

export default function RocketLaunchGame({ stepCount, onLevelCleared }: Props) {
  const { index, goalIndex, celebrating, handleTap, handleCelebrationDone } =
    useReinforcementProgress(stepCount, onLevelCleared);

  const positionPct = useMemo(
    () => (i: number) => (i / goalIndex) * TRACK_SPAN_PCT,
    [goalIndex]
  );
  const starPositions = useMemo(
    () =>
      Array.from({ length: stepCount }, (_, i) => ({
        bottom: positionPct(i + 1),
        left: STAR_X_OFFSETS[i % STAR_X_OFFSETS.length],
      })),
    [stepCount, positionPct]
  );

  return (
    <div>
      <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-stone-700 bg-gradient-to-b from-stone-900 via-stone-800 to-stone-700">
        {starPositions.map((star, i) => (
          <span
            key={i}
            className="absolute text-accent-200"
            style={{ bottom: `${star.bottom}%`, left: `${star.left}%` }}
            aria-hidden
          >
            ✦
          </span>
        ))}

        <div
          className="absolute -translate-x-1/2"
          style={{ bottom: `${positionPct(goalIndex)}%`, left: "50%" }}
          aria-hidden
        >
          <Planet />
        </div>

        <div
          className="reinforcement-mover absolute z-10 -translate-x-1/2"
          style={{ bottom: `${positionPct(index)}%`, left: "50%" }}
        >
          <div key={index} className="animate-reinforcement-thrust">
            <RocketCharacter />
          </div>
        </div>
      </div>

      <button
        onClick={handleTap}
        disabled={celebrating}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <Rocket className="h-4 w-4" />
        Reinforce
      </button>

      {celebrating && (
        <CelebrationToast message="Level cleared! 🎉" onDone={handleCelebrationDone} />
      )}
    </div>
  );
}
