"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Gamepad2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ReinforcementGamePlayer from "@/components/reinforcement-games/reinforcement-game-player";

type BoardOption = {
  id: string;
  name: string;
  type: string;
  step_count: number;
};

type Props = {
  boardsTable: "reinforcement_boards" | "teacher_reinforcement_boards";
  sessionsTable: "sessions" | "teacher_sessions";
  /** Namespaces the "last board picked" localStorage key per side, and
   *  picks which Toolkit link to show when she has no boards yet. */
  storageNamespace: "slp" | "teacher";
  toolkitHref: string;
  /** Same lazy session-row creation the rest of the page already uses
   *  (see ensureSession() in new-session-form.tsx) — reused here so the
   *  first level cleared creates the session exactly like the first
   *  trial logged would. */
  ensureSessionId: () => Promise<string | null>;
};

const STORAGE_KEY_PREFIX = "bloomtrack:reinforcement-board:";

/** A collapsible "Reinforcement" panel for the session-logging page:
 *  pick a saved Reinforcement Bank board, tap through its mini-game as
 *  a reward, completely independent of trial logging. Collapsed by
 *  default — using it for a given session is opt-in, not required.
 *  Counts levels cleared during *this* session only (the game's own
 *  tap position always starts fresh on mount) and persists that count
 *  onto the session row as it grows, the same incremental-save pattern
 *  the rest of the page uses for trials/notes. */
export default function ReinforcementSessionPanel({
  boardsTable,
  sessionsTable,
  storageNamespace,
  toolkitHref,
  ensureSessionId,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [boards, setBoards] = useState<BoardOption[] | null>(null);
  const [boardsError, setBoardsError] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [levelsCleared, setLevelsCleared] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBoards() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(boardsTable)
        .select("id, name, type, step_count")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setBoardsError(error.message);
        return;
      }

      const loaded = (data ?? []) as BoardOption[];
      setBoards(loaded);

      let storedId: string | null = null;
      try {
        storedId = window.localStorage.getItem(
          `${STORAGE_KEY_PREFIX}${storageNamespace}`
        );
      } catch {
        // localStorage can throw (private mode, blocked storage) — fine
        // to just skip remembering the last pick.
      }
      if (storedId && loaded.some((b) => b.id === storedId)) {
        setSelectedBoardId(storedId);
      }
    }

    loadBoards();
    return () => {
      cancelled = true;
    };
  }, [boardsTable, storageNamespace]);

  function handleSelectBoard(id: string) {
    setSelectedBoardId(id || null);
    try {
      if (id) {
        window.localStorage.setItem(
          `${STORAGE_KEY_PREFIX}${storageNamespace}`,
          id
        );
      } else {
        window.localStorage.removeItem(
          `${STORAGE_KEY_PREFIX}${storageNamespace}`
        );
      }
    } catch {
      // Same as above — a lost "remember last pick" isn't worth surfacing.
    }
  }

  async function handleLevelCleared() {
    const next = levelsCleared + 1;
    setLevelsCleared(next);
    setSaveError(null);

    const id = await ensureSessionId();
    if (!id) {
      setSaveError("Couldn't save that — you need to be signed in.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from(sessionsTable)
      .update({ reinforcement_levels_cleared: next })
      .eq("id", id);

    if (error) {
      setSaveError(error.message);
    }
  }

  const selectedBoard = boards?.find((b) => b.id === selectedBoardId) ?? null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-lg font-semibold text-stone-900 transition-colors hover:text-brand-700">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
          )}
          <Gamepad2 className="h-5 w-5 shrink-0 text-brand-500" />
          Reinforcement
        </span>
        {levelsCleared > 0 && (
          <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700">
            {levelsCleared} cleared this session
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="mt-4">
          {boardsError && (
            <p className="text-sm text-red-600">
              Couldn&apos;t load your reinforcement boards: {boardsError}
            </p>
          )}

          {!boardsError && boards === null && (
            <p className="text-sm text-stone-500">Loading your boards…</p>
          )}

          {!boardsError && boards !== null && boards.length === 0 && (
            <p className="text-sm text-stone-500">
              No reinforcement boards yet —{" "}
              <Link
                href={toolkitHref}
                className="font-medium text-brand-700 hover:underline"
              >
                add one in the Toolkit
              </Link>
              .
            </p>
          )}

          {!boardsError && boards !== null && boards.length > 0 && (
            <div>
              <select
                value={selectedBoardId ?? ""}
                onChange={(e) => handleSelectBoard(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Select a board…</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>

              {saveError && (
                <p className="mt-2 text-sm text-red-600">{saveError}</p>
              )}

              {selectedBoard ? (
                <div className="mt-4 max-w-sm">
                  <ReinforcementGamePlayer
                    type={selectedBoard.type}
                    stepCount={selectedBoard.step_count}
                    onLevelCleared={handleLevelCleared}
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-stone-500">
                  Select a board to use during this session.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
