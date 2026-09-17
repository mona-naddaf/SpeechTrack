"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import CelebrationToast from "@/components/celebration-toast";
import { useReinforcementProgress } from "./use-reinforcement-progress";

type Props = {
  stepCount: number;
  /** Fires once each time the critter reaches the goal. */
  onLevelCleared?: () => void;
};

// The track's usable horizontal range, as a % of its width — kept
// inset from both edges so the character (offset by its own half-width
// via -translate-x-1/2) never clips against the container's
// overflow-hidden bounds at either the start or the goal.
const TRACK_START_PCT = 8;
const TRACK_END_PCT = 90;

/** Original character: a small round critter with an antenna, no
 *  resemblance to any existing franchise character. */
function HopCritter() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden focusable="false">
      <ellipse cx="22" cy="40" rx="11" ry="2.5" fill="#000000" opacity="0.12" />
      <rect x="13" y="30" width="6" height="8" rx="3" fill="#CC3B1A" />
      <rect x="25" y="30" width="6" height="8" rx="3" fill="#CC3B1A" />
      <line x1="22" y1="8" x2="22" y2="2" stroke="#CC3B1A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="2" r="2.5" fill="#FFA98F" />
      <circle cx="22" cy="22" r="15" fill="#FF6B47" />
      <circle cx="16" cy="20" r="4.5" fill="white" />
      <circle cx="28" cy="20" r="4.5" fill="white" />
      <circle cx="17" cy="21" r="2.2" fill="#3A2A22" />
      <circle cx="29" cy="21" r="2.2" fill="#3A2A22" />
      <path
        d="M15 27 Q22 33 29 27"
        stroke="#7C2611"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="11" cy="25" r="2.5" fill="#FFA98F" opacity="0.7" />
      <circle cx="33" cy="25" r="2.5" fill="#FFA98F" opacity="0.7" />
    </svg>
  );
}

export default function HopToGoalGame({ stepCount, onLevelCleared }: Props) {
  const { index, goalIndex, celebrating, handleTap, handleCelebrationDone } =
    useReinforcementProgress(stepCount, onLevelCleared);

  const positionPct = useMemo(
    () => (i: number) =>
      TRACK_START_PCT + (i / goalIndex) * (TRACK_END_PCT - TRACK_START_PCT),
    [goalIndex]
  );
  const obstaclePositions = useMemo(
    () => Array.from({ length: stepCount }, (_, i) => positionPct(i + 1)),
    [stepCount, positionPct]
  );

  return (
    <div>
      <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-accent-200 bg-gradient-to-b from-accent-100 to-accent-50">
        <div className="absolute inset-x-0 bottom-0 h-10 bg-accent-300/50" aria-hidden />

        {obstaclePositions.map((pct, i) => (
          <div
            key={i}
            className="absolute bottom-10 h-7 w-8 -translate-x-1/2 rounded-t-full bg-cream-500 shadow-sm"
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        ))}

        <div
          className="absolute bottom-10 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${positionPct(goalIndex)}%` }}
          aria-hidden
        >
          <div className="relative h-16 w-0.5 bg-stone-600">
            <div className="animate-flag-wave absolute left-0.5 top-0 h-5 w-7 bg-brand-500 [clip-path:polygon(0_0,100%_22%,0_100%)]" />
          </div>
        </div>

        <div
          className="reinforcement-mover absolute bottom-10 z-10 -translate-x-1/2"
          style={{ left: `${positionPct(index)}%` }}
        >
          <div key={index} className="animate-reinforcement-hop">
            <HopCritter />
          </div>
        </div>
      </div>

      <button
        onClick={handleTap}
        disabled={celebrating}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <Sparkles className="h-4 w-4" />
        Reinforce
      </button>

      {celebrating && (
        <CelebrationToast message="Level cleared! 🎉" onDone={handleCelebrationDone} />
      )}
    </div>
  );
}
