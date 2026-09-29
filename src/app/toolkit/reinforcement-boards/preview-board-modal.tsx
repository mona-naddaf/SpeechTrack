"use client";

import { X } from "lucide-react";
import type { ReinforcementBoard } from "@/lib/types";
import ReinforcementGamePlayer from "@/components/reinforcement-games/reinforcement-game-player";
import { REINFORCEMENT_GAME_LABELS } from "@/lib/reinforcement-games";

type Props = {
  board: ReinforcementBoard;
  onClose: () => void;
};

/** Lets her tap through a board right from the Toolkit page — the same
 *  component a real session will eventually use, just standing alone
 *  with a close button instead of wired into a live session. */
export default function PreviewBoardModal({ board, onClose }: Props) {
  const gameLabel =
    REINFORCEMENT_GAME_LABELS[board.type as keyof typeof REINFORCEMENT_GAME_LABELS] ??
    board.type;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900">{board.name}</h2>
              <p className="text-sm text-stone-500">
                {gameLabel} · {board.step_count} steps
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4">
            <ReinforcementGamePlayer type={board.type} stepCount={board.step_count} />
          </div>

          <p className="mt-4 text-xs text-stone-500">
            Tap Reinforce to try it out — this is just a preview, nothing is
            saved.
          </p>
        </div>
      </div>
    </div>
  );
}
