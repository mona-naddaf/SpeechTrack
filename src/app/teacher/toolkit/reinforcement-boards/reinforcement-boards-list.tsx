"use client";

import { useState } from "react";
import { Gamepad2, Plus, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TeacherReinforcementBoard } from "@/lib/types";
import { REINFORCEMENT_GAME_LABELS } from "@/lib/reinforcement-games";
import BoardFormModal, { type BoardFormValues } from "./board-form-modal";
import DeleteBoardConfirmModal from "./delete-board-confirm-modal";
import PreviewBoardModal from "./preview-board-modal";

type Props = {
  initialBoards: TeacherReinforcementBoard[];
};

export default function ReinforcementBoardsList({ initialBoards }: Props) {
  const [boards, setBoards] = useState<TeacherReinforcementBoard[]>(initialBoards);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBoard, setEditingBoard] =
    useState<TeacherReinforcementBoard | null>(null);
  const [deletingBoard, setDeletingBoard] =
    useState<TeacherReinforcementBoard | null>(null);
  const [previewingBoard, setPreviewingBoard] =
    useState<TeacherReinforcementBoard | null>(null);

  async function handleAdd(values: BoardFormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { data, error } = await supabase
      .from("teacher_reinforcement_boards")
      .insert({
        teacher_id: user.id,
        name: values.name,
        type: values.type,
        step_count: values.stepCount,
      })
      .select("id, teacher_id, name, type, step_count, config, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setBoards((prev) => [data as TeacherReinforcementBoard, ...prev]);
    setShowAddModal(false);
    return null;
  }

  async function handleEdit(values: BoardFormValues) {
    if (!editingBoard) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("teacher_reinforcement_boards")
      .update({
        name: values.name,
        type: values.type,
        step_count: values.stepCount,
      })
      .eq("id", editingBoard.id)
      .select("id, teacher_id, name, type, step_count, config, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setBoards((prev) =>
      prev.map((b) =>
        b.id === editingBoard.id ? (data as TeacherReinforcementBoard) : b
      )
    );
    setEditingBoard(null);
    return null;
  }

  async function handleDelete() {
    if (!deletingBoard) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_reinforcement_boards")
      .delete()
      .eq("id", deletingBoard.id);

    if (error) return error.message;

    setBoards((prev) => prev.filter((b) => b.id !== deletingBoard.id));
    setDeletingBoard(null);
    return null;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Gamepad2 className="h-5 w-5 text-brand-500" />
          Your boards
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New board
        </button>
      </div>

      {boards.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Gamepad2 className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No reinforcement boards yet — add one to start building your
            bank.
          </p>
        </div>
      )}

      {boards.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {boards.map((board) => (
            <div
              key={board.id}
              className="flex flex-col rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                  {REINFORCEMENT_GAME_LABELS[
                    board.type as keyof typeof REINFORCEMENT_GAME_LABELS
                  ] ?? board.type}
                </span>
                <span className="rounded-full bg-cream-50 px-2.5 py-1 text-xs font-medium text-stone-500">
                  {board.step_count} steps
                </span>
              </div>

              <p className="mt-3 text-sm font-semibold text-stone-900">
                {board.name}
              </p>

              <div className="mt-3 flex flex-1 items-end justify-end gap-1">
                <button
                  onClick={() => setPreviewingBoard(board)}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  Preview
                </button>
                <button
                  onClick={() => setEditingBoard(board)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeletingBoard(board)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <BoardFormModal
          mode="add"
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingBoard && (
        <BoardFormModal
          mode="edit"
          initialBoard={editingBoard}
          onCancel={() => setEditingBoard(null)}
          onSubmit={handleEdit}
        />
      )}

      {deletingBoard && (
        <DeleteBoardConfirmModal
          board={deletingBoard}
          onCancel={() => setDeletingBoard(null)}
          onConfirm={handleDelete}
        />
      )}

      {previewingBoard && (
        <PreviewBoardModal
          board={previewingBoard}
          onClose={() => setPreviewingBoard(null)}
        />
      )}
    </div>
  );
}
