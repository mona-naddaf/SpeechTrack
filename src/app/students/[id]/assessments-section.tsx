"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";
import type { AssessmentStatus, AssessmentWithAreas } from "@/lib/types";
import type { AssessmentScore } from "@/lib/assessment";
import RunAssessmentModal from "./run-assessment-modal";

export type AssessmentResultDisplay = {
  id: string;
  assessmentId: string;
  assessmentName: string;
  date: string;
  status: AssessmentStatus;
  completedAt: string | null;
  totalQuestions: number;
  answeredCount: number;
  score: AssessmentScore | null;
};

type Props = {
  studentId: string;
  assessments: AssessmentWithAreas[];
  initialResults: AssessmentResultDisplay[];
  assessmentsError: string | null;
  resultsError: string | null;
};

export default function AssessmentsSection({
  studentId,
  assessments,
  initialResults,
  assessmentsError,
  resultsError,
}: Props) {
  const router = useRouter();
  const [showRunModal, setShowRunModal] = useState(false);

  const inProgress = initialResults.filter((r) => r.status === "in_progress");
  const completed = initialResults
    .filter((r) => r.status === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  async function handleStart(assessmentId: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { data, error } = await supabase
      .from("assessment_results")
      .insert({
        slp_id: user.id,
        student_id: studentId,
        assessment_id: assessmentId,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    router.push(`/students/${studentId}/assessment/${data.id}`);
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <ClipboardList className="h-5 w-5 text-brand-500" />
          Assessments
        </h2>
        <button
          onClick={() => setShowRunModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <PlayCircle className="h-4 w-4" />
          Run assessment
        </button>
      </div>

      {(assessmentsError || resultsError) && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load assessments: {assessmentsError ?? resultsError}
        </p>
      )}

      {inProgress.length === 0 && completed.length === 0 && !resultsError && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <ClipboardList className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No assessments run yet for this student.
          </p>
        </div>
      )}

      {inProgress.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            In progress
          </h3>
          <ul className="mt-2 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            {inProgress.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/students/${studentId}/assessment/${r.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-cream-50 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-900">
                      {r.assessmentName}
                    </p>
                    <p className="truncate text-sm text-stone-500">
                      Started {formatDate(r.date)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    {r.answeredCount}/{r.totalQuestions} answered
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Past assessments
          </h3>
          <ul className="mt-2 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            {completed.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/students/${studentId}/assessment/${r.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-cream-50 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-900">
                      {r.assessmentName}
                    </p>
                    <p className="truncate text-sm text-stone-500">
                      {formatDate(r.date)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                    {r.score && r.score.total > 0
                      ? `${r.score.correct}/${r.score.total} correct`
                      : "No scored questions"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showRunModal && (
        <RunAssessmentModal
          assessments={assessments}
          onCancel={() => setShowRunModal(false)}
          onSubmit={handleStart}
        />
      )}
    </div>
  );
}
