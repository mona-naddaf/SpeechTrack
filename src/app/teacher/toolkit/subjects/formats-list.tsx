"use client";

import { useState } from "react";
import { Plus, Sliders } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CueingLevel, ResponseFormat, ResponseFormatType } from "@/lib/types";
import { RESPONSE_FORMAT_TYPE_LABELS } from "@/lib/response-format-types";
import { getColorOption } from "@/lib/colors";
import CueingHierarchyEditorModal from "./cueing-hierarchy-editor-modal";
import CorrectIncorrectEditorModal from "./correct-incorrect-editor-modal";
import RatingScaleEditorModal from "./rating-scale-editor-modal";
import NewFormatModal from "./new-format-modal";
import DeleteFormatConfirmModal from "./delete-format-confirm-modal";

// Types the Teacher can create a custom version of from scratch on this
// page. Anything else in RESPONSE_FORMAT_TYPE_LABELS is still "coming soon".
const CREATABLE_TYPES: ResponseFormatType[] = [
  "correct_incorrect",
  "rating_scale",
  "cueing_hierarchy",
];

type Props = {
  initialFormats: ResponseFormat[];
};

export default function FormatsList({ initialFormats }: Props) {
  const [formats, setFormats] = useState<ResponseFormat[]>(initialFormats);
  const [editingFormat, setEditingFormat] = useState<ResponseFormat | null>(
    null
  );
  const [showNewModal, setShowNewModal] = useState(false);
  const [deletingFormat, setDeletingFormat] = useState<ResponseFormat | null>(
    null
  );
  const [inUseMessage, setInUseMessage] = useState<string | null>(null);

  const placeholderTypes = RESPONSE_FORMAT_TYPE_LABELS.filter(
    (t) => !CREATABLE_TYPES.includes(t.type)
  );

  function handleSaved(updated: ResponseFormat) {
    setFormats((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setEditingFormat(null);
  }

  function handleCreated(created: ResponseFormat, openEditor: boolean) {
    setFormats((prev) => [...prev, created]);
    setShowNewModal(false);
    if (openEditor) {
      setEditingFormat(created);
    }
  }

  async function handleDeleteRequest(format: ResponseFormat) {
    setInUseMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("teacher_goals")
      .select("id")
      .eq("response_format_id", format.id)
      .limit(1);

    if (error) {
      setInUseMessage(error.message);
      return;
    }

    if ((data ?? []).length > 0) {
      setInUseMessage(
        `"${format.name}" is used by at least one goal, so it can't be deleted. Change or remove it from those goals first.`
      );
      return;
    }

    setDeletingFormat(format);
  }

  async function handleDeleteConfirm() {
    if (!deletingFormat) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_response_formats")
      .delete()
      .eq("id", deletingFormat.id);

    if (error) {
      return error.message;
    }

    setFormats((prev) => prev.filter((f) => f.id !== deletingFormat.id));
    setDeletingFormat(null);
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Sliders className="h-5 w-5 text-brand-500" />
          Response formats
        </h2>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New custom format
        </button>
      </div>

      {inUseMessage && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {inUseMessage}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {formats.map((format) => (
          <div
            key={format.id}
            className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-stone-900">{format.name}</h3>
                <p className="text-xs text-stone-400">
                  {RESPONSE_FORMAT_TYPE_LABELS.find((t) => t.type === format.type)
                    ?.label ?? format.type}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setEditingFormat(format)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteRequest(format)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>

            {format.type === "cueing_hierarchy" && (
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
            )}

            {format.type === "correct_incorrect" && (
              <div className="mt-4 flex gap-2">
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
                  {format.config.correctLabel ?? "Correct"}
                </span>
                <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-800">
                  {format.config.incorrectLabel ?? "Incorrect"}
                </span>
              </div>
            )}

            {format.type === "rating_scale" && (
              <p className="mt-4 text-sm text-stone-600">
                Range: {format.config.min ?? 0}–{format.config.max ?? 4}
              </p>
            )}

            {!["cueing_hierarchy", "correct_incorrect", "rating_scale"].includes(
              format.type
            ) && (
              <p className="mt-1 text-sm text-stone-500">
                Editing for this format type is coming soon.
              </p>
            )}
          </div>
        ))}

        {placeholderTypes.map((t) => (
          <div
            key={t.type}
            className="rounded-xl border border-dashed border-stone-300 bg-white p-5 opacity-70"
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-semibold text-stone-700">{t.label}</h3>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                Coming soon
              </span>
            </div>
            <p className="mt-1 text-sm text-stone-500">{t.description}</p>
          </div>
        ))}
      </div>

      {editingFormat && editingFormat.type === "cueing_hierarchy" && (
        <CueingHierarchyEditorModal
          format={editingFormat}
          onCancel={() => setEditingFormat(null)}
          onSaved={handleSaved}
        />
      )}

      {editingFormat && editingFormat.type === "correct_incorrect" && (
        <CorrectIncorrectEditorModal
          format={editingFormat}
          onCancel={() => setEditingFormat(null)}
          onSaved={handleSaved}
        />
      )}

      {editingFormat && editingFormat.type === "rating_scale" && (
        <RatingScaleEditorModal
          format={editingFormat}
          onCancel={() => setEditingFormat(null)}
          onSaved={handleSaved}
        />
      )}

      {showNewModal && (
        <NewFormatModal
          onCancel={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}

      {deletingFormat && (
        <DeleteFormatConfirmModal
          format={deletingFormat}
          onCancel={() => setDeletingFormat(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
