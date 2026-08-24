"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { HomePracticeItem } from "@/lib/types";

type Props = {
  item: HomePracticeItem;
  onCancel: () => void;
  onConfirm: () => Promise<string | null>;
};

export default function DeleteHomePracticeItemModal({
  item,
  onCancel,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await onConfirm();
    setLoading(false);
    if (result) setError(result);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900">
          <Trash2 className="h-5 w-5 text-red-500" />
          Delete home practice item
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Are you sure you want to delete this item? This action cannot be
          undone.
        </p>
        <p className="mt-2 rounded-md bg-cream-50 p-3 text-sm text-stone-700">
          {item.what_to_practice}
        </p>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
