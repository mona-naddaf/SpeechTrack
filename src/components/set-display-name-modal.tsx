"use client";

import { Sparkles } from "lucide-react";
import DisplayNameForm from "./display-name-form";

type Props = {
  onCancel: () => void;
  onSaved: (name: string) => void;
};

/** Popped open by VisibilityField when she picks "Shared" without a
 *  display name set yet — a shared item needs an author credit. Sits
 *  above whatever add/edit form triggered it (those are all z-50), so
 *  this one is z-[60]. */
export default function SetDisplayNameModal({ onCancel, onSaved }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
          <Sparkles className="h-5 w-5 text-amber-600" />
        </div>
        <h2 className="mt-3 text-lg font-bold text-stone-900">
          Set a display name first
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Sharing something credits it to a name, so pick one before marking
          this as shared. You can change it later from Settings.
        </p>

        <div className="mt-4">
          <DisplayNameForm
            initialValue=""
            autoFocus
            submitLabel="Save and continue"
            onSaved={onSaved}
          />
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
