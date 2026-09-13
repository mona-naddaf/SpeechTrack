"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListTree, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TeacherSubject, TeacherTrackTemplateWithSubject } from "@/lib/types";
import NewTemplateModal from "./new-template-modal";
import DeleteTemplateConfirmModal from "./delete-template-confirm-modal";

type Props = {
  initialTemplates: TeacherTrackTemplateWithSubject[];
  stepCountByTemplateId: Record<string, number>;
  subjects: TeacherSubject[];
};

/** Lists every saved track template regardless of which path created it
 *  (saved from a student's track, or built from scratch here) — both land
 *  in the same tables, so they look and behave identically once saved. */
export default function TrackTemplatesList({
  initialTemplates,
  stepCountByTemplateId,
  subjects,
}: Props) {
  const router = useRouter();
  const [templates, setTemplates] =
    useState<TeacherTrackTemplateWithSubject[]>(initialTemplates);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deletingTemplate, setDeletingTemplate] =
    useState<TeacherTrackTemplateWithSubject | null>(null);

  function handleCreated(created: TeacherTrackTemplateWithSubject) {
    setShowNewModal(false);
    router.push(`/teacher/toolkit/track-templates/${created.id}`);
  }

  async function handleDeleteConfirm() {
    if (!deletingTemplate) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_track_templates")
      .delete()
      .eq("id", deletingTemplate.id);

    if (error) {
      return error.message;
    }

    setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
    setDeletingTemplate(null);
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <ListTree className="h-5 w-5 text-brand-500" />
          Saved templates
        </h2>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New template
        </button>
      </div>

      {templates.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <ListTree className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No track templates yet — build one here, or save an existing
            student&apos;s track as a template from its ladder view.
          </p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {templates.map((template) => {
            const stepCount = stepCountByTemplateId[template.id] ?? 0;
            return (
              <div
                key={template.id}
                className="flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-stone-900">{template.name}</p>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                    {template.subject?.name ?? "Uncategorized"}
                  </span>
                </div>

                <p className="mt-2 flex-1 text-sm text-stone-500">
                  {stepCount} step{stepCount === 1 ? "" : "s"}
                </p>

                <div className="mt-3 flex justify-end gap-1">
                  <Link
                    href={`/teacher/toolkit/track-templates/${template.id}`}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                  >
                    Edit steps
                  </Link>
                  <button
                    onClick={() => setDeletingTemplate(template)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNewModal && (
        <NewTemplateModal
          subjects={subjects}
          onCancel={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}

      {deletingTemplate && (
        <DeleteTemplateConfirmModal
          template={deletingTemplate}
          onCancel={() => setDeletingTemplate(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
