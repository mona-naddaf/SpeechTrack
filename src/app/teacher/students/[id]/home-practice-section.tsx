"use client";

import { useState } from "react";
import { Home, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";
import type { HomePracticeItem } from "@/lib/types";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";
import HomePracticeItemFormModal from "./home-practice-item-form-modal";
import DeleteHomePracticeItemModal from "./delete-home-practice-item-modal";
import CopyCodeButton from "./copy-code-button";

type Props = {
  studentId: string;
  parentAccessCode: string;
  initialItems: HomePracticeItem[];
  initialError: string | null;
};

export default function HomePracticeSection({
  studentId,
  parentAccessCode,
  initialItems,
  initialError,
}: Props) {
  const [items, setItems] = useState<HomePracticeItem[]>(initialItems);
  const [listError] = useState<string | null>(initialError);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<HomePracticeItem | null>(
    null
  );
  const [deletingItem, setDeletingItem] = useState<HomePracticeItem | null>(
    null
  );
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("home_practice");

  function sortByNewest(list: HomePracticeItem[]) {
    return [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async function handleAdd(values: {
    whatToPractice: string;
    howToPractice: string;
    lastWorkedDate: string;
  }) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { data, error } = await supabase
      .from("teacher_home_practice_items")
      .insert({
        teacher_id: user.id,
        student_id: studentId,
        what_to_practice: values.whatToPractice,
        how_to_practice: values.howToPractice || null,
        last_worked_date: values.lastWorkedDate || null,
      })
      .select(
        "id, what_to_practice, how_to_practice, last_worked_date, created_at"
      )
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setItems((prev) => sortByNewest([...prev, data]));
    setShowAddModal(false);
    return null;
  }

  async function handleEdit(values: {
    whatToPractice: string;
    howToPractice: string;
    lastWorkedDate: string;
  }) {
    if (!editingItem) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("teacher_home_practice_items")
      .update({
        what_to_practice: values.whatToPractice,
        how_to_practice: values.howToPractice || null,
        last_worked_date: values.lastWorkedDate || null,
      })
      .eq("id", editingItem.id)
      .select(
        "id, what_to_practice, how_to_practice, last_worked_date, created_at"
      )
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)));
    setEditingItem(null);
    return null;
  }

  async function handleDelete() {
    if (!deletingItem) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_home_practice_items")
      .delete()
      .eq("id", deletingItem.id);

    if (error) return error.message;

    setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
    setDeletingItem(null);
    return null;
  }

  return (
    <div>
      <SectionHeader
        icon={Home}
        title="Home practice"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Add item
          </button>
        }
      />

      {!collapsed && (
        <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Parent access code
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-stone-900">
            {parentAccessCode}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Share this with a parent so they can log in at /parent to see
            practice items and log what they did at home.
          </p>
        </div>
        <CopyCodeButton code={parentAccessCode} />
      </div>

      {listError && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load home practice items: {listError}
        </p>
      )}

      {!listError && items.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Home className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No home practice items yet — add one so the parent has something
            to work on.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-900">
                    {item.what_to_practice}
                  </p>
                  {item.how_to_practice && (
                    <p className="mt-1 text-sm text-stone-600">
                      {item.how_to_practice}
                    </p>
                  )}
                  {item.last_worked_date && (
                    <p className="mt-1 text-xs text-stone-400">
                      Last worked: {formatDate(item.last_worked_date)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingItem(item)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
        </>
      )}

      {showAddModal && (
        <HomePracticeItemFormModal
          mode="add"
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingItem && (
        <HomePracticeItemFormModal
          mode="edit"
          initialItem={editingItem}
          onCancel={() => setEditingItem(null)}
          onSubmit={handleEdit}
        />
      )}

      {deletingItem && (
        <DeleteHomePracticeItemModal
          item={deletingItem}
          onCancel={() => setDeletingItem(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
