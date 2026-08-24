"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Area,
  AssessmentFormality,
  AssessmentKind,
  AssessmentQuestion,
  AssessmentWithAreas,
} from "@/lib/types";
import {
  ASSESSMENT_FORMALITY_LABELS,
  ASSESSMENT_KIND_LABELS,
  ASSESSMENT_RESPONSE_TYPE_LABELS,
} from "@/lib/assessment";
import QuestionFormModal, { type QuestionFormValues } from "./question-form-modal";
import DeleteQuestionConfirmModal from "./delete-question-confirm-modal";

const QUESTION_SELECT_COLUMNS =
  "id, assessment_id, order_index, prompt, response_type, expected_answer, notes, created_at";

const KINDS: AssessmentKind[] = ["screening", "assessment"];
const FORMALITIES: AssessmentFormality[] = ["formal", "informal"];

type Props = {
  assessment: AssessmentWithAreas;
  initialQuestions: AssessmentQuestion[];
  areas: Area[];
};

export default function AssessmentEditor({
  assessment,
  initialQuestions,
  areas,
}: Props) {
  const [name, setName] = useState(assessment.name);
  const [description, setDescription] = useState(assessment.description ?? "");
  const [kind, setKind] = useState(assessment.kind);
  const [formality, setFormality] = useState(assessment.formality);
  const [areaIds, setAreaIds] = useState<Set<string>>(
    new Set(assessment.areas.map((a) => a.id))
  );
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

  async function saveKind(next: AssessmentKind) {
    setDetailsError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("assessments")
      .update({ kind: next })
      .eq("id", assessment.id);
    if (error) {
      setDetailsError(error.message);
      return;
    }
    setKind(next);
  }

  async function saveFormality(next: AssessmentFormality) {
    setDetailsError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("assessments")
      .update({ formality: next })
      .eq("id", assessment.id);
    if (error) {
      setDetailsError(error.message);
      return;
    }
    setFormality(next);
  }

  async function toggleArea(areaId: string) {
    setDetailsError(null);
    const supabase = createClient();
    const checked = areaIds.has(areaId);

    const { error } = checked
      ? await supabase
          .from("assessment_areas")
          .delete()
          .eq("assessment_id", assessment.id)
          .eq("area_id", areaId)
      : await supabase
          .from("assessment_areas")
          .insert({ assessment_id: assessment.id, area_id: areaId });

    if (error) {
      setDetailsError(error.message);
      return;
    }

    setAreaIds((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
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

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="block text-sm font-medium text-slate-700">Kind</span>
            <div className="mt-1 flex gap-4 text-sm text-slate-600">
              {KINDS.map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="assessment-kind"
                    checked={kind === k}
                    onChange={() => saveKind(k)}
                  />
                  {ASSESSMENT_KIND_LABELS[k]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-700">
              Formality
            </span>
            <div className="mt-1 flex gap-4 text-sm text-slate-600">
              {FORMALITIES.map((f) => (
                <label key={f} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="assessment-formality"
                    checked={formality === f}
                    onChange={() => saveFormality(f)}
                  />
                  {ASSESSMENT_FORMALITY_LABELS[f]}
                </label>
              ))}
            </div>
          </div>
        </div>

        {areas.length > 0 && (
          <div className="mt-4">
            <span className="block text-sm font-medium text-slate-700">
              Areas <span className="text-slate-400">(optional)</span>
            </span>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
              {areas.map((area) => (
                <label key={area.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={areaIds.has(area.id)}
                    onChange={() => toggleArea(area.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {area.name}
                </label>
              ))}
            </div>
          </div>
        )}

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
