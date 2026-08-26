"use client";

import { useState } from "react";
import { Plus, Smile } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BehaviorType } from "@/lib/types";
import { getColorOption } from "@/lib/colors";
import BehaviorTypeFormModal from "./behavior-type-form-modal";
import DeleteBehaviorTypeConfirmModal from "./delete-behavior-type-confirm-modal";

type Props = {
  initialBehaviorTypes: BehaviorType[];
};

export default function BehaviorTypesSection({ initialBehaviorTypes }: Props) {
  const [behaviorTypes, setBehaviorTypes] =
    useState<BehaviorType[]>(initialBehaviorTypes);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingType, setEditingType] = useState<BehaviorType | null>(null);
  const [deletingType, setDeletingType] = useState<BehaviorType | null>(null);
  const [inUseMessage, setInUseMessage] = useState<string | null>(null);

  function sortByName(list: BehaviorType[]) {
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function handleAdd({ name, color }: { name: string; color: string }) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { data, error } = await supabase
      .from("behavior_types")
      .insert({ slp_id: user.id, name, color })
      .select("id, name, color")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setBehaviorTypes((prev) => sortByName([...prev, data]));
    setShowAddModal(false);
    return null;
  }

  async function handleEdit({ name, color }: { name: string; color: string }) {
    if (!editingType) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("behavior_types")
      .update({ name, color })
      .eq("id", editingType.id)
      .select("id, name, color")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setBehaviorTypes((prev) =>
      sortByName(prev.map((t) => (t.id === data.id ? data : t)))
    );
    setEditingType(null);
    return null;
  }

  async function handleDeleteRequest(behaviorType: BehaviorType) {
    setInUseMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("slp_behavior_logs")
      .select("id")
      .eq("behavior_type_id", behaviorType.id)
      .limit(1);

    if (error) {
      setInUseMessage(error.message);
      return;
    }

    if ((data ?? []).length > 0) {
      setInUseMessage(
        `"${behaviorType.name}" has been used to log behavior, so it can't be deleted.`
      );
      return;
    }

    setDeletingType(behaviorType);
  }

  async function handleDeleteConfirm() {
    if (!deletingType) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("behavior_types")
      .delete()
      .eq("id", deletingType.id);

    if (error) {
      return error.message;
    }

    setBehaviorTypes((prev) => prev.filter((t) => t.id !== deletingType.id));
    setDeletingType(null);
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Smile className="h-5 w-5 text-brand-500" />
          Behavior types
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Add behavior type
        </button>
      </div>

      {inUseMessage && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {inUseMessage}
        </p>
      )}

      {behaviorTypes.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Smile className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No behavior types yet — add one to start logging behavior.
          </p>
        </div>
      )}

      {behaviorTypes.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {behaviorTypes.map((behaviorType) => {
            const color = getColorOption(behaviorType.color);
            return (
              <li
                key={behaviorType.id}
                className="flex items-center gap-1 rounded-full border border-stone-200 bg-white py-1 pl-1 pr-1 shadow-sm"
              >
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${color.badgeClass}`}
                >
                  <span className={`h-2 w-2 rounded-full ${color.swatchClass}`} />
                  {behaviorType.name}
                </span>
                <button
                  onClick={() => setEditingType(behaviorType)}
                  className="rounded-full px-2 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteRequest(behaviorType)}
                  className="rounded-full px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showAddModal && (
        <BehaviorTypeFormModal
          mode="add"
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingType && (
        <BehaviorTypeFormModal
          mode="edit"
          initialBehaviorType={editingType}
          onCancel={() => setEditingType(null)}
          onSubmit={handleEdit}
        />
      )}

      {deletingType && (
        <DeleteBehaviorTypeConfirmModal
          behaviorType={deletingType}
          onCancel={() => setDeletingType(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
