"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Assessment, AssessmentQuestion } from "@/lib/types";
import { ASSESSMENT_RESPONSE_TYPE_LABELS } from "@/lib/assessment";
import QuestionFormModal, { type QuestionFormValues } from "./question-form-modal";
import DeleteQuestionConfirmModal from "./delete-question-confirm-modal";

const QUESTION_SELECT_COLUMNS =
  "id, assessment_id, order_index, prompt, response_type, expected_answer, notes, created_at";

type Props = {
  assessment: Assessment;
  initialQuestions: AssessmentQuestion[];
};

export default function AssessmentEditor({ assessment, initialQuestions }: Props) {
  const [name, setName] = useState(assessment.name);
  const [description, setDescription] = useState(assessment.description ?? "");
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<AssessmentQuestion[]>(
    [...initialQuestions].sort((a, b) => a.order_index - b.order_index)
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AssessmentQuestion | null>(
    null
  );
  const [deletingQuestion, setDeletingQuestion] = useState<AssessmentQuestion | null>(
    null
  );
  const [reordering, setReordering] = useState(false);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === assessment.name) {
      setName(trimmed || assessment.name);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("assessments")
      .update({ name: trimmed })
      .eq("id", assessment.id);
    if (error) setDetailsError(error.message);
  }

  async function saveDescription() {
    const trimmed = description.trim();
    const supabase = createClient();
    const { error } = await supabase
      .from("assessments")
      .update({ description: trimmed || null })
      .eq("id", assessment.id);
    if (error) setDetailsError(error.message);
  }

  async function handleAddQuestion(values: QuestionFormValues) {
    const supabase = createClient();
    const nextOrderIndex =
      questions.length > 0
        ? Math.max(...questions.map((q) => q.order_index)) + 1
        : 0;

    const { data, error } = await supabase
      .from("assessment_questions")
      .insert({
        assessment_id: assessment.id,
        order_index: nextOrderIndex,
        prompt: values.prompt,
        response_type: values.responseType,
        expected_answer: values.expectedAnswer || null,
        notes: values.notes || null,
      })
      .select(QUESTION_SELECT_COLUMNS)
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setQuestions((prev) => [...prev, data as AssessmentQuestion]);
    setShowAddModal(false);
    return null;
  }

  async function handleEditQuestion(values: QuestionFormValues) {
    if (!editingQuestion) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("assessment_questions")
      .update({
        prompt: values.prompt,
        response_type: values.responseType,
        expected_answer: values.expectedAnswer || null,
        notes: values.notes || null,
      })
      .eq("id", editingQuestion.id)
      .select(QUESTION_SELECT_COLUMNS)
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setQuestions((prev) =>
      prev.map((q) => (q.id === data.id ? (data as AssessmentQuestion) : q))
    );
    setEditingQuestion(null);
    return null;
  }

  async function handleDeleteQuestion() {
    if (!deletingQuestion) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("assessment_questions")
      .delete()
      .eq("id", deletingQuestion.id);

    if (error) {
      return error.message;
    }

    setQuestions((prev) => prev.filter((q) => q.id !== deletingQuestion.id));
    setDeletingQuestion(null);
    return null;
  }

  async function moveQuestion(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length || reordering) return;

    const current = questions[index];
    const target = questions[targetIndex];

    setReordering(true);
    const supabase = createClient();
    const [res1, res2] = await Promise.all([
      supabase
        .from("assessment_questions")
        .update({ order_index: target.order_index })
        .eq("id", current.id),
      supabase
        .from("assessment_questions")
        .update({ order_index: current.order_index })
        .eq("id", target.id),
    ]);
    setReordering(false);

    if (res1.error || res2.error) return;

    setQuestions((prev) => {
      const next = [...prev];
      const swappedCurrent = { ...current, order_index: target.order_index };
      const swappedTarget = { ...target, order_index: current.order_index };
      next[index] = swappedTarget;
      next[targetIndex] = swappedCurrent;
      return next;
    });
  }

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label htmlFor="assessment-name" className="sr-only">
          Assessment name
        </label>
        <input
          id="assessment-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          className="w-full border-none p-0 text-2xl font-bold text-slate-900 focus:outline-none focus:ring-0"
        />

        <label htmlFor="assessment-description" className="sr-only">
          Description
        </label>
        <textarea
          id="assessment-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveDescription}
          rows={2}
          placeholder="Description (optional)"
          className="mt-2 w-full resize-none border-none p-0 text-slate-600 focus:outline-none focus:ring-0"
        />

        {detailsError && (
          <p className="mt-2 text-sm text-red-600">{detailsError}</p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Questions ({questions.length})
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          + Add question
        </button>
      </div>

      {questions.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No questions yet. Add one to start building this assessment.
        </div>
      )}

      {questions.length > 0 && (
        <ul className="mt-4 space-y-3">
          {questions.map((question, i) => (
            <li
              key={question.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">
                    #{i + 1}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {ASSESSMENT_RESPONSE_TYPE_LABELS[question.response_type]}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {question.prompt}
                </p>
                {question.expected_answer && (
                  <p className="mt-1 text-sm text-slate-500">
                    Expected: {question.expected_answer}
                  </p>
                )}
                {question.notes && (
                  <p className="mt-1 text-sm text-slate-400">
                    {question.notes}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => moveQuestion(i, -1)}
                  disabled={i === 0 || reordering}
                  aria-label="Move up"
                  className="rounded-md px-2 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveQuestion(i, 1)}
                  disabled={i === questions.length - 1 || reordering}
                  aria-label="Move down"
                  className="rounded-md px-2 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => setEditingQuestion(question)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeletingQuestion(question)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAddModal && (
        <QuestionFormModal
          mode="add"
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAddQuestion}
        />
      )}

      {editingQuestion && (
        <QuestionFormModal
          mode="edit"
          initialQuestion={editingQuestion}
          onCancel={() => setEditingQuestion(null)}
          onSubmit={handleEditQuestion}
        />
      )}

      {deletingQuestion && (
        <DeleteQuestionConfirmModal
          question={deletingQuestion}
          onCancel={() => setDeletingQuestion(null)}
          onConfirm={handleDeleteQuestion}
        />
      )}
    </div>
  );
}
