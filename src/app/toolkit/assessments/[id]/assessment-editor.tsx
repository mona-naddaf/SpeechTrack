"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, ListChecks, Plus, Upload } from "lucide-react";
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
import { downloadXlsxTemplate, parseXlsxFile, type ImportSkip } from "@/lib/xlsx-import";
import { parseQuestionImportRows } from "@/lib/question-import";
import LinkifyText from "@/components/linkify-text";
import QuestionFormModal, { type QuestionFormValues } from "./question-form-modal";
import DeleteQuestionConfirmModal from "./delete-question-confirm-modal";

const QUESTION_SELECT_COLUMNS =
  "id, assessment_id, order_index, prompt, response_type, expected_answer, notes, choices, created_at";

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

  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{
    addedCount: number;
    skipped: ImportSkip[];
  } | null>(null);

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
        choices: values.choices,
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
        choices: values.choices,
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

  async function handleDownloadQuestionTemplate() {
    await downloadXlsxTemplate(
      "assessment-questions-template.xlsx",
      ["Prompt", "Response Type", "Expected Answer", "Notes", "Choices"],
      [
        [
          "Point to the picture of a dog.",
          "right_wrong",
          "",
          "Show the animal picture card",
          "",
        ],
        [
          "Rate use of target sound in conversation.",
          "custom_choice",
          "",
          "",
          "Present, Emerging, Absent",
        ],
      ]
    );
  }

  async function handleImportQuestions(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after a fix
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportSummary(null);

    try {
      const rows = await parseXlsxFile(file);
      const { valid, skipped } = parseQuestionImportRows(rows);

      let inserted: AssessmentQuestion[] = [];
      if (valid.length > 0) {
        const baseOrderIndex =
          questions.length > 0
            ? Math.max(...questions.map((q) => q.order_index)) + 1
            : 0;

        const supabase = createClient();
        const { data, error } = await supabase
          .from("assessment_questions")
          .insert(
            valid.map((row, i) => ({
              assessment_id: assessment.id,
              order_index: baseOrderIndex + i,
              prompt: row.prompt,
              response_type: row.responseType,
              expected_answer: row.expectedAnswer,
              notes: row.notes,
              choices: row.choices,
            }))
          )
          .select(QUESTION_SELECT_COLUMNS);

        if (error) {
          setImportError(error.message);
          return;
        }

        // Bulk-insert return order isn't guaranteed to match input order —
        // order_index is what actually preserves file order, so sort by it.
        inserted = ((data ?? []) as AssessmentQuestion[]).sort(
          (a, b) => a.order_index - b.order_index
        );
        setQuestions((prev) => [...prev, ...inserted]);
      }

      setImportSummary({ addedCount: inserted.length, skipped });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setImporting(false);
    }
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
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-5">
        <label htmlFor="assessment-name" className="sr-only">
          Assessment name
        </label>
        <input
          id="assessment-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          className="w-full border-none p-0 text-2xl font-bold text-stone-900 focus:outline-none focus:ring-0"
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
          className="mt-2 w-full resize-none border-none p-0 text-stone-600 focus:outline-none focus:ring-0"
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="block text-sm font-medium text-stone-700">Kind</span>
            <div className="mt-1 flex gap-4 text-sm text-stone-600">
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
            <span className="block text-sm font-medium text-stone-700">
              Formality
            </span>
            <div className="mt-1 flex gap-4 text-sm text-stone-600">
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
            <span className="block text-sm font-medium text-stone-700">
              Areas <span className="text-stone-400">(optional)</span>
            </span>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-stone-600">
              {areas.map((area) => (
                <label key={area.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={areaIds.has(area.id)}
                    onChange={() => toggleArea(area.id)}
                    className="h-4 w-4 rounded border-stone-300"
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <ListChecks className="h-5 w-5 text-brand-500" />
          Questions ({questions.length})
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Add question
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          Bulk import from Excel
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadQuestionTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-600 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
          >
            <Download className="h-4 w-4" />
            Download template
          </button>
          <button
            type="button"
            onClick={() => importFileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-600 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Upload className="h-4 w-4" />
            {importing ? "Importing…" : "Upload from Excel"}
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleImportQuestions}
            className="hidden"
          />
        </div>

        {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}

        {importSummary && (
          <div className="mt-2 rounded-lg bg-white p-3 text-sm text-stone-700">
            <p className="font-medium">
              {importSummary.addedCount} question
              {importSummary.addedCount === 1 ? "" : "s"} added
            </p>
            {importSummary.skipped.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-stone-500">
                {importSummary.skipped.map((s, i) => (
                  <li key={i}>
                    Row {s.rowNumber}: {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {questions.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <ListChecks className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No questions yet — add one to start building this assessment.
          </p>
        </div>
      )}

      {questions.length > 0 && (
        <ul className="mt-4 space-y-3">
          {questions.map((question, i) => (
            <li
              key={question.id}
              className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-stone-400">
                    #{i + 1}
                  </span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                    {ASSESSMENT_RESPONSE_TYPE_LABELS[question.response_type]}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-stone-900">
                  {question.prompt}
                </p>
                {question.expected_answer && (
                  <p className="mt-1 text-sm text-stone-500">
                    Expected: {question.expected_answer}
                  </p>
                )}
                {question.response_type === "custom_choice" &&
                  question.choices &&
                  question.choices.length > 0 && (
                    <p className="mt-1 text-sm text-stone-500">
                      Choices: {question.choices.join(", ")}
                    </p>
                  )}
                {question.notes && (
                  <p className="mt-1 text-sm text-stone-400">
                    <LinkifyText text={question.notes} />
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => moveQuestion(i, -1)}
                  disabled={i === 0 || reordering}
                  aria-label="Move up"
                  className="rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveQuestion(i, 1)}
                  disabled={i === questions.length - 1 || reordering}
                  aria-label="Move down"
                  className="rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => setEditingQuestion(question)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeletingQuestion(question)}
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
