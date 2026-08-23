"use client";

import { useState } from "react";
import type { CueingLevel, ResponseFormat } from "@/lib/types";
import { RESPONSE_FORMAT_TYPE_LABELS } from "@/lib/response-format-types";
import { getColorOption } from "@/lib/colors";
import CueingHierarchyEditorModal from "./cueing-hierarchy-editor-modal";

type Props = {
  initialFormats: ResponseFormat[];
};

export default function FormatsList({ initialFormats }: Props) {
  const [formats, setFormats] = useState<ResponseFormat[]>(initialFormats);
  const [editingFormat, setEditingFormat] = useState<ResponseFormat | null>(
    null
  );

  const existingTypes = new Set(formats.map((f) => f.type));
  const placeholderTypes = RESPONSE_FORMAT_TYPE_LABELS.filter(
    (t) => !existingTypes.has(t.type)
  );

  function handleSaved(updated: ResponseFormat) {
    setFormats((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setEditingFormat(null);
  }

  return (
    <div className="space-y-4">
      {formats.map((format) =>
        format.type === "cueing_hierarchy" ? (
          <div
            key={format.id}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold text-slate-900">{format.name}</h2>
              <button
                onClick={() => setEditingFormat(format)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Edit
              </button>
            </div>

            <ul className="mt-4 flex flex-wrap gap-2">
              {(format.config.levels ?? []).map(
                (level: CueingLevel, i: number) => {
                  const color = getColorOption(level.color);
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${color.badgeClass}`}
                    >
                      {level.name}
                      {level.is_independent && (
                        <span className="text-xs opacity-70">
                          (independent)
                        </span>
                      )}
                    </li>
                  );
                }
              )}
            </ul>
          </div>
        ) : (
          <div
            key={format.id}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="font-semibold text-slate-900">{format.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Editing for this format type is coming soon.
            </p>
          </div>
        )
      )}

      {placeholderTypes.map((t) => (
        <div
          key={t.type}
          className="rounded-xl border border-dashed border-slate-300 bg-white p-5 opacity-70"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-slate-700">{t.label}</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{t.description}</p>
        </div>
      ))}

      {editingFormat && (
        <CueingHierarchyEditorModal
          format={editingFormat}
          onCancel={() => setEditingFormat(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
