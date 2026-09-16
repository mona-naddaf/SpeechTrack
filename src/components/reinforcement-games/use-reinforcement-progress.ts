"use client";

import { useCallback, useEffect, useState } from "react";
import { fireCelebrationConfetti } from "@/lib/confetti";

/** Shared tap-to-advance state machine for every Reinforcement Bank
 *  mini-game (hop_to_goal, rocket_launch, ...). `index` runs
 *  0 (start) .. stepCount (last obstacle/star) .. stepCount + 1 (goal).
 *  Reaching the goal fires confetti and flips `celebrating`; the caller
 *  shows a CelebrationToast and calls `handleCelebrationDone` when it
 *  auto-dismisses, which resets back to the start so the board is ready
 *  to reinforce again. */
export function useReinforcementProgress(stepCount: number) {
  const goalIndex = stepCount + 1;
  const [index, setIndex] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (celebrating) {
      fireCelebrationConfetti();
    }
  }, [celebrating]);

  const handleTap = useCallback(() => {
    if (celebrating) return;
    setIndex((prev) => {
      const next = Math.min(prev + 1, goalIndex);
      if (next === goalIndex) setCelebrating(true);
      return next;
    });
  }, [celebrating, goalIndex]);

  const handleCelebrationDone = useCallback(() => {
    setCelebrating(false);
    setIndex(0);
  }, []);

  return { index, goalIndex, celebrating, handleTap, handleCelebrationDone };
}
