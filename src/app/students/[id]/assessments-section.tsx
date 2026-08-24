"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/date";
import type { Assessment, AssessmentStatus } from "@/lib/types";
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
  assessments: Assessment[];
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
        <h2 className="text-lg font-semibold text-slate-900">Assessments</h2>
        <button
          onClick={() => setShowRunModal(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Run assessment
        </button>
      </div>

      {(assessmentsError || resultsError) && (
        <p className="mt-4 text-sm text-red-600">
          Couldn&apos;t load assessments: {assessmentsError ?? resultsError}
        </p>
      )}

      {inProgress.length === 0 && completed.length === 0 && !resultsError && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No assessments run yet for this student.
        </div>
      )}

      {inProgress.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            In progress
          </h3>
          <ul className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {inProgress.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/students/${studentId}/assessment/${r.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {r.assessmentName}
                    </p>
                    <p className="truncate text-sm text-slate-500">
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Past assessments
          </h3>
          <ul className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {completed.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/students/${studentId}/assessment/${r.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {r.assessmentName}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {formatDate(r.date)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
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
