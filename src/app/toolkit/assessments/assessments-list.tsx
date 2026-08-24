"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Area, Assessment, AssessmentWithAreas } from "@/lib/types";
import AssessmentMetaBadges from "@/components/assessment-meta-badges";
import NewAssessmentModal from "./new-assessment-modal";
import DeleteAssessmentConfirmModal from "./delete-assessment-confirm-modal";

type Props = {
  initialAssessments: AssessmentWithAreas[];
  areas: Area[];
};

export default function AssessmentsList({ initialAssessments, areas }: Props) {
  const router = useRouter();
  const [assessments, setAssessments] =
    useState<AssessmentWithAreas[]>(initialAssessments);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deletingAssessment, setDeletingAssessment] = useState<Assessment | null>(
    null
  );
  const [inUseMessage, setInUseMessage] = useState<string | null>(null);

  function handleCreated(created: Assessment) {
    setShowNewModal(false);
    router.push(`/toolkit/assessments/${created.id}`);
  }

  async function handleDeleteRequest(assessment: Assessment) {
    setInUseMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("assessment_results")
      .select("id")
      .eq("assessment_id", assessment.id)
      .limit(1);

    if (error) {
      setInUseMessage(error.message);
      return;
    }

    if ((data ?? []).length > 0) {
      setInUseMessage(
        `"${assessment.name}" has been run against at least one student, so it can't be deleted (that would erase their recorded results). `
      );
      return;
    }

    setDeletingAssessment(assessment);
  }

  async function handleDeleteConfirm() {
    if (!deletingAssessment) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("assessments")
      .delete()
      .eq("id", deletingAssessment.id);

    if (error) {
      return error.message;
    }

    setAssessments((prev) => prev.filter((a) => a.id !== deletingAssessment.id));
    setDeletingAssessment(null);
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <ClipboardList className="h-5 w-5 text-brand-500" />
          Saved assessments
        </h2>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New assessment
        </button>
      </div>

      {inUseMessage && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {inUseMessage}
        </p>
      )}

      {assessments.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <ClipboardList className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No assessments yet — create one to start building a reusable
            assessment.
          </p>
        </div>
      )}

      {assessments.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {assessments.map((assessment) => (
            <div
              key={assessment.id}
              className="flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4"
            >
              <p className="font-medium text-stone-900">{assessment.name}</p>
              {assessment.description ? (
                <p className="mt-1 text-sm text-stone-600">
                  {assessment.description}
                </p>
              ) : null}

              <div className="mt-2 flex-1">
                <AssessmentMetaBadges
                  kind={assessment.kind}
                  formality={assessment.formality}
                  areas={assessment.areas}
                />
              </div>

              <div className="mt-3 flex justify-end gap-1">
                <Link
                  href={`/toolkit/assessments/${assessment.id}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                >
                  Edit questions
                </Link>
                <button
                  onClick={() => handleDeleteRequest(assessment)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <NewAssessmentModal
          areas={areas}
          onCancel={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}

      {deletingAssessment && (
        <DeleteAssessmentConfirmModal
          assessment={deletingAssessment}
          onCancel={() => setDeletingAssessment(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
