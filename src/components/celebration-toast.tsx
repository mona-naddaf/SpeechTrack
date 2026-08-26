"use client";

import { useEffect } from "react";
import { PartyPopper } from "lucide-react";

type Props = {
  message: string;
  onDone: () => void;
  durationMs?: number;
};

/** A brief, centered "🎉 ..." toast — pairs with fireCelebrationConfetti()
 *  wherever something worth celebrating just happened (a goal reaching
 *  "mastered", a parent logging practice). Auto-dismisses itself after
 *  durationMs; the caller just needs to stop rendering it via onDone. */
export default function CelebrationToast({
  message,
  onDone,
  durationMs = 2200,
}: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [onDone, durationMs]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <div className="animate-celebration-pop pointer-events-auto flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-900 shadow-lg ring-1 ring-stone-900/5">
        <PartyPopper className="h-4 w-4 shrink-0 text-brand-500" aria-hidden />
        {message}
      </div>
    </div>
  );
}
