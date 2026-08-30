"use client";

import { Plus, X } from "lucide-react";
import type { CustomFieldDraft } from "@/lib/custom-fields";

export type { CustomFieldDraft };

type Props = {
  value: CustomFieldDraft[];
  onChange: (next: CustomFieldDraft[]) => void;
};

/** Free-form label/value pairs on the add/edit student form (e.g. "IEP
 *  status: Yes", "Allergy: Peanuts") — any number, added/removed freely.
 *  Pure value/onChange widget (like AvatarPicker/SchedulePicker), shared
 *  by both the SLP and Teacher add/edit-student modals and the student
 *  page's own "Student info" edit modal. The containing form reconciles
 *  inserts/updates/deletes against `id` on submit — see diffCustomFields
 *  in src/lib/custom-fields.ts. */
export default function CustomFieldsEditor({ value, onChange }: Props) {
  function updateField(index: number, patch: Partial<CustomFieldDraft>) {
    onChange(value.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addField() {
    onChange([...value, { id: null, label: "", value: "" }]);
  }

  function removeField(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <span className="block text-sm font-medium text-stone-700">
        Custom fields <span className="text-stone-400">(optional)</span>
      </span>
      {value.length > 0 && (
        <div className="mt-1 space-y-2">
          {value.map((field, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={field.label}
                onChange={(e) => updateField(i, { label: e.target.value })}
                placeholder="Label (e.g. IEP status)"
                className="w-2/5 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <input
                type="text"
                value={field.value}
                onChange={(e) => updateField(i, { value: e.target.value })}
                placeholder="Value (e.g. Yes)"
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => removeField(i)}
                aria-label="Remove custom field"
                className="shrink-0 rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={addField}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        <Plus className="h-3.5 w-3.5" />
        Add custom field
      </button>
    </div>
  );
}
