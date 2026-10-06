"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  CueingLevel,
  ResponseFormat,
  ResponseFormatType,
  ShareVisibility,
} from "@/lib/types";
import { RESPONSE_FORMAT_TYPE_LABELS } from "@/lib/response-format-types";
import { getColorOption } from "@/lib/colors";
import VisibilityField from "@/components/visibility-field";
import { DEFAULT_FORMAT_METADATA_KEY } from "@/lib/default-format";
import CueingHierarchyEditorModal from "./cueing-hierarchy-editor-modal";
import CorrectIncorrectEditorModal from "./correct-incorrect-editor-modal";
import RatingScaleEditorModal from "./rating-scale-editor-modal";
import SentenceStructureEditorModal from "./sentence-structure-editor-modal";
import NewFormatModal from "./new-format-modal";
import DeleteFormatConfirmModal from "./delete-format-confirm-modal";

const VISIBILITY_OPTIONS = [
  { value: "private" as const, label: "Private" },
  { value: "shared" as const, label: "Shared" },
];

// Types the SLP can create a custom version of from scratch on this page.
// Anything else in RESPONSE_FORMAT_TYPE_LABELS is still "coming soon".
const CREATABLE_TYPES: ResponseFormatType[] = [
  "correct_incorrect",
  "rating_scale",
  "cueing_hierarchy",
  "sentence_structure",
  "language_sample",
];

type Props = {
  initialFormats: ResponseFormat[];
  /** Her account-wide default format id (validated against her formats
   *  server-side), or null. */
  initialDefaultFormatId: string | null;
};

export default function FormatsList({ initialFormats, initialDefaultFormatId }: Props) {
  const [defaultFormatId, setDefaultFormatId] = useState<string | null>(initialDefaultFormatId);
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [defaultNotice, setDefaultNotice] = useState<string | null>(null);

  /** Saves (or clears, with null) the account-wide default in
   *  user_metadata — one default at a time by construction. */
  async function saveDefault(id: string | null): Promise<string | null> {
    setDefaultSaving(true);
    const { error } = await createClient().auth.updateUser({
      data: { [DEFAULT_FORMAT_METADATA_KEY]: id },
    });
    setDefaultSaving(false);
    if (error) return error.message;
    setDefaultFormatId(id);
    return null;
  }

  async function handleSetDefault(format: ResponseFormat | null) {
    setDefaultNotice(null);
    const err = await saveDefault(format?.id ?? null);
    setDefaultNotice(
      err ?? (format ? `"${format.name}" is now your default response format.` : "Default response format cleared.")
    );
  }
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

  async function handleChangeVisibility(
    format: ResponseFormat,
    visibility: ShareVisibility
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("response_formats")
      .update({ visibility })
      .eq("id", format.id);

    if (error) {
      setInUseMessage(error.message);
      return;
    }

    setFormats((prev) =>
      prev.map((f) => (f.id === format.id ? { ...f, visibility } : f))
    );
  }

  async function handleDeleteRequest(format: ResponseFormat) {
    setInUseMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("goals")
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
      .from("response_formats")
      .delete()
      .eq("id", deletingFormat.id);

    if (error) {
      return error.message;
    }

    setFormats((prev) => prev.filter((f) => f.id !== deletingFormat.id));
    if (deletingFormat.id === defaultFormatId) {
      const err = await saveDefault(null);
      setDefaultNotice(
        err
          ? `Deleted, but your default couldn't be cleared: ${err}`
          : `Deleted "${deletingFormat.name}" — it was your default, so your default response format is now cleared.`
      );
    }
    setDeletingFormat(null);
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New custom format
        </button>
      </div>

      {defaultNotice && (
        <p className="rounded-md bg-accent-50 px-4 py-3 text-sm text-accent-800" data-testid="default-format-notice">
          {defaultNotice}
        </p>
      )}

      {inUseMessage && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {inUseMessage}
        </p>
      )}

      {formats.map((format) => (
        <div
          key={format.id}
          className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-stone-900">
                {format.name}
                {format.id === defaultFormatId && (
                  <span
                    data-testid="default-format-badge"
                    className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800"
                  >
                    Default
                  </span>
                )}
              </h2>
              <p className="text-xs text-stone-400">
                {RESPONSE_FORMAT_TYPE_LABELS.find((t) => t.type === format.type)
                  ?.label ?? format.type}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {format.id === defaultFormatId ? (
                <button
                  onClick={() => handleSetDefault(null)}
                  disabled={defaultSaving}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 disabled:opacity-50"
                >
                  Clear default
                </button>
              ) : (
                <button
                  onClick={() => handleSetDefault(format)}
                  disabled={defaultSaving}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-50"
                >
                  Set as default
                </button>
              )}
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

          {(format.type === "cueing_hierarchy" ||
              format.type === "language_sample") && (
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

          {format.type === "sentence_structure" && (
            <div className="mt-4">
              <p className="text-sm text-stone-600">
                {(format.config.components ?? []).map((c) => c.name).join(" + ") ||
                  "No components yet"}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
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
          )}

          {![
              "cueing_hierarchy",
              "correct_incorrect",
              "rating_scale",
              "sentence_structure",
              "language_sample",
            ].includes(
            format.type
          ) && (
            <p className="mt-1 text-sm text-stone-500">
              Editing for this format type is coming soon.
            </p>
          )}

          <div className="mt-4 border-t border-stone-100 pt-4">
            <VisibilityField
              value={format.visibility}
              onChange={(v) => handleChangeVisibility(format, v)}
              options={VISIBILITY_OPTIONS}
              gatedValue="shared"
            />
          </div>
        </div>
      ))}

      {placeholderTypes.map((t) => (
        <div
          key={t.type}
          className="rounded-xl border border-dashed border-stone-300 bg-white p-5 opacity-70"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-stone-700">{t.label}</h2>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-500">{t.description}</p>
        </div>
      ))}

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

      {editingFormat && editingFormat.type === "language_sample" && (
        <CueingHierarchyEditorModal
          format={editingFormat}
          onCancel={() => setEditingFormat(null)}
          onSaved={handleSaved}
          title="Edit language sample"
          description="Rename the format and set the support levels an utterance can be produced under — add, remove, rename, recolor, or mark which count as independent."
        />
      )}

      {editingFormat && editingFormat.type === "sentence_structure" && (
        <SentenceStructureEditorModal
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
          isDefault={deletingFormat.id === defaultFormatId}
          onCancel={() => setDeletingFormat(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
