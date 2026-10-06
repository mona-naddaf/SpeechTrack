"use client";

import { useState } from "react";
import { ListTree, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  ResponseFormatOption,
  TeacherSubject,
  TeacherTrackTemplateStepWithRelations,
  TeacherTrackTemplateWithSubject,
} from "@/lib/types";
import StepFormModal, { type StepFormValues } from "./step-form-modal";
import DeleteStepConfirmModal from "./delete-step-confirm-modal";

const STEP_SELECT_COLUMNS =
  "id, template_id, order_index, goal_text, response_format_id, target_percent, created_at, response_format:teacher_response_formats(id, name)";

type Props = {
  template: TeacherTrackTemplateWithSubject;
  initialSteps: TeacherTrackTemplateStepWithRelations[];
  subjects: TeacherSubject[];
  responseFormats: ResponseFormatOption[];
  /** Account-wide default format — pre-selected for new steps only. */
  defaultFormatId: string | null;
};

/** Builds/edits one track template's steps directly — PATH B when
 *  starting from scratch here, and also where a PATH-A template (saved
 *  from a student's track) is fine-tuned afterwards. Mirrors
 *  assessment-editor.tsx's inline-name + ordered-list-of-child-rows shape. */
export default function TrackTemplateEditor({
  template,
  initialSteps,
  subjects,
  responseFormats,
  defaultFormatId,
}: Props) {
  const [name, setName] = useState(template.name);
  const [subjectId, setSubjectId] = useState(template.subject_id);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [steps, setSteps] = useState<TeacherTrackTemplateStepWithRelations[]>(
    [...initialSteps].sort((a, b) => a.order_index - b.order_index)
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStep, setEditingStep] =
    useState<TeacherTrackTemplateStepWithRelations | null>(null);
  const [deletingStep, setDeletingStep] =
    useState<TeacherTrackTemplateStepWithRelations | null>(null);
  const [reordering, setReordering] = useState(false);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === template.name) {
      setName(trimmed || template.name);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_track_templates")
      .update({ name: trimmed })
      .eq("id", template.id);
    if (error) setDetailsError(error.message);
  }

  async function saveSubject(next: string) {
    setDetailsError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_track_templates")
      .update({ subject_id: next })
      .eq("id", template.id);
    if (error) {
      setDetailsError(error.message);
      return;
    }
    setSubjectId(next);
  }

  async function handleAddStep(values: StepFormValues) {
    const supabase = createClient();
    const nextOrderIndex =
      steps.length > 0 ? Math.max(...steps.map((s) => s.order_index)) + 1 : 1;

    const { data, error } = await supabase
      .from("teacher_track_template_steps")
      .insert({
        template_id: template.id,
        order_index: nextOrderIndex,
        goal_text: values.goalText,
        response_format_id: values.responseFormatId,
        target_percent: values.targetPercent,
      })
      .select(STEP_SELECT_COLUMNS)
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setSteps((prev) => [
      ...prev,
      data as unknown as TeacherTrackTemplateStepWithRelations,
    ]);
    setShowAddModal(false);
    return null;
  }

  async function handleEditStep(values: StepFormValues) {
    if (!editingStep) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("teacher_track_template_steps")
      .update({
        goal_text: values.goalText,
        response_format_id: values.responseFormatId,
        target_percent: values.targetPercent,
      })
      .eq("id", editingStep.id)
      .select(STEP_SELECT_COLUMNS)
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setSteps((prev) =>
      prev.map((s) =>
        s.id === (data as unknown as TeacherTrackTemplateStepWithRelations).id
          ? (data as unknown as TeacherTrackTemplateStepWithRelations)
          : s
      )
    );
    setEditingStep(null);
    return null;
  }

  async function handleDeleteStep() {
    if (!deletingStep) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_track_template_steps")
      .delete()
      .eq("id", deletingStep.id);

    if (error) {
      return error.message;
    }

    setSteps((prev) => prev.filter((s) => s.id !== deletingStep.id));
    setDeletingStep(null);
    return null;
  }

  async function moveStep(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= steps.length || reordering) return;

    const current = steps[index];
    const target = steps[targetIndex];

    setReordering(true);
    const supabase = createClient();
    const [res1, res2] = await Promise.all([
      supabase
        .from("teacher_track_template_steps")
        .update({ order_index: target.order_index })
        .eq("id", current.id),
      supabase
        .from("teacher_track_template_steps")
        .update({ order_index: current.order_index })
        .eq("id", target.id),
    ]);
    setReordering(false);

    if (res1.error || res2.error) return;

    setSteps((prev) => {
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
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-5">
        <label htmlFor="template-name" className="sr-only">
          Template name
        </label>
        <input
          id="template-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          className="w-full border-none p-0 text-2xl font-bold text-stone-900 focus:outline-none focus:ring-0"
        />

        <div className="mt-4">
          <label htmlFor="template-subject" className="block text-sm font-medium text-stone-700">
            Subject
          </label>
          <select
            id="template-subject"
            value={subjectId}
            onChange={(e) => saveSubject(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-auto"
          >
            {subjects.length === 0 && <option value="">No subjects yet</option>}
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>

        {detailsError && <p className="mt-2 text-sm text-red-600">{detailsError}</p>}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <ListTree className="h-5 w-5 text-brand-500" />
          Steps ({steps.length})
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Add step
        </button>
      </div>

      {steps.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <ListTree className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No steps yet — add one to start building this template&apos;s
            sequence.
          </p>
        </div>
      )}

      {steps.length > 0 && (
        <ul className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-stone-400">#{i + 1}</span>
                  {step.response_format && (
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                      {step.response_format.name}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-stone-900">{step.goal_text}</p>
                <p className="mt-1 text-sm text-stone-500">
                  {step.target_percent !== null
                    ? `Target: ${step.target_percent}%`
                    : "No target set"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => moveStep(i, -1)}
                  disabled={i === 0 || reordering}
                  aria-label="Move up"
                  className="rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveStep(i, 1)}
                  disabled={i === steps.length - 1 || reordering}
                  aria-label="Move down"
                  className="rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => setEditingStep(step)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeletingStep(step)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAddModal && (
        <StepFormModal
          mode="add"
          responseFormats={responseFormats}
          defaultFormatId={defaultFormatId}
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAddStep}
        />
      )}

      {editingStep && (
        <StepFormModal
          mode="edit"
          responseFormats={responseFormats}
          defaultFormatId={defaultFormatId}
          initialStep={editingStep}
          onCancel={() => setEditingStep(null)}
          onSubmit={handleEditStep}
        />
      )}

      {deletingStep && (
        <DeleteStepConfirmModal
          step={deletingStep}
          onCancel={() => setDeletingStep(null)}
          onConfirm={handleDeleteStep}
        />
      )}
    </div>
  );
}
