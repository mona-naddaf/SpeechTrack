"use client";

import { useState } from "react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-slate-900">
          Delete home practice item
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to delete this item? This action cannot be
          undone.
        </p>
        <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          {item.what_to_practice}
        </p>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
