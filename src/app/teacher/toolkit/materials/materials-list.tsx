"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Library, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  TeacherMaterialGoalOption,
  TeacherMaterialWithRelations,
  TeacherSubject,
} from "@/lib/types";
import {
  MATERIAL_VISIBILITY_CLASSES,
  MATERIAL_VISIBILITY_LABELS,
  flattenTeacherMaterialJoins,
  formatGoalOptionLabel,
  type RawTeacherMaterialJoin,
} from "@/lib/materials";
import MaterialFormModal, { type MaterialFormValues } from "./material-form-modal";
import DeleteMaterialConfirmModal from "./delete-material-confirm-modal";

const MATERIAL_SELECT_COLUMNS =
  "id, title, url, description, subject_id, visibility, created_at, subject:teacher_subjects(id, name), teacher_material_goals(goal_id)";

type Props = {
  initialMaterials: TeacherMaterialWithRelations[];
  subjects: TeacherSubject[];
  goalOptions: TeacherMaterialGoalOption[];
};

export default function MaterialsList({
  initialMaterials,
  subjects,
  goalOptions,
}: Props) {
  const [materials, setMaterials] =
    useState<TeacherMaterialWithRelations[]>(initialMaterials);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMaterial, setEditingMaterial] =
    useState<TeacherMaterialWithRelations | null>(null);
  const [deletingMaterial, setDeletingMaterial] =
    useState<TeacherMaterialWithRelations | null>(null);

  const goalById = useMemo(() => {
    const map = new Map<string, TeacherMaterialGoalOption>();
    for (const goal of goalOptions) map.set(goal.id, goal);
    return map;
  }, [goalOptions]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      if (subjectFilter && material.subject_id !== subjectFilter) return false;
      if (goalFilter && !material.goal_ids.includes(goalFilter)) return false;
      return true;
    });
  }, [materials, subjectFilter, goalFilter]);

  async function refetchMaterial(
    id: string
  ): Promise<TeacherMaterialWithRelations | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from("teacher_materials")
      .select(MATERIAL_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return (
      flattenTeacherMaterialJoins([data as unknown as RawTeacherMaterialJoin])[0] ??
      null
    );
  }

  async function handleAdd(values: MaterialFormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    const { data, error } = await supabase
      .from("teacher_materials")
      .insert({
        teacher_id: user.id,
        title: values.title,
        url: values.url,
        description: values.description,
        subject_id: values.subjectId,
        visibility: "private",
      })
      .select("id")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    if (values.goalIds.length > 0) {
      const { error: linkError } = await supabase
        .from("teacher_material_goals")
        .insert(
          values.goalIds.map((goalId) => ({
            material_id: data.id,
            goal_id: goalId,
          }))
        );
      if (linkError) return linkError.message;
    }

    const fullMaterial = await refetchMaterial(data.id);
    if (fullMaterial) {
      setMaterials((prev) => [fullMaterial, ...prev]);
    }
    setShowAddModal(false);
    return null;
  }

  async function handleEdit(values: MaterialFormValues) {
    if (!editingMaterial) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_materials")
      .update({
        title: values.title,
        url: values.url,
        description: values.description,
        subject_id: values.subjectId,
      })
      .eq("id", editingMaterial.id);

    if (error) return error.message;

    // Simplest correct way to reconcile the goal links: clear them and
    // re-insert the current selection, rather than diffing old vs new.
    const { error: clearError } = await supabase
      .from("teacher_material_goals")
      .delete()
      .eq("material_id", editingMaterial.id);
    if (clearError) return clearError.message;

    if (values.goalIds.length > 0) {
      const { error: linkError } = await supabase
        .from("teacher_material_goals")
        .insert(
          values.goalIds.map((goalId) => ({
            material_id: editingMaterial.id,
            goal_id: goalId,
          }))
        );
      if (linkError) return linkError.message;
    }

    const fullMaterial = await refetchMaterial(editingMaterial.id);
    if (fullMaterial) {
      setMaterials((prev) =>
        prev.map((m) => (m.id === fullMaterial.id ? fullMaterial : m))
      );
    }
    setEditingMaterial(null);
    return null;
  }

  async function handleDelete() {
    if (!deletingMaterial) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_materials")
      .delete()
      .eq("id", deletingMaterial.id);

    if (error) return error.message;

    setMaterials((prev) => prev.filter((m) => m.id !== deletingMaterial.id));
    setDeletingMaterial(null);
    return null;
  }

  const hasFilters = subjectFilter !== "" || goalFilter !== "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Library className="h-5 w-5 text-brand-500" />
          Your materials
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Add material
        </button>
      </div>

      {materials.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All categories</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <select
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
            className="max-w-[14rem] rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All goals</option>
            {goalOptions.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {formatGoalOptionLabel(goal)}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => {
                setSubjectFilter("");
                setGoalFilter("");
              }}
              className="text-sm font-medium text-stone-500 underline underline-offset-2 hover:text-brand-800"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {materials.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Library className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-stone-500">
            No materials yet — add a link to start building your bank.
          </p>
        </div>
      )}

      {materials.length > 0 && filteredMaterials.length === 0 && (
        <p className="mt-4 text-sm text-stone-500">
          No materials match those filters.
        </p>
      )}

      {filteredMaterials.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {filteredMaterials.map((material) => (
            <div
              key={material.id}
              className="flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                  {material.subject?.name ?? "Uncategorized"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${MATERIAL_VISIBILITY_CLASSES[material.visibility]}`}
                >
                  {MATERIAL_VISIBILITY_LABELS[material.visibility]}
                </span>
              </div>

              <a
                href={material.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-start gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
              >
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {material.title}
              </a>

              {material.description && (
                <p className="mt-1 text-sm text-stone-600">
                  {material.description}
                </p>
              )}

              {material.goal_ids.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {material.goal_ids.map((goalId) => {
                    const goal = goalById.get(goalId);
                    if (!goal) return null;
                    return (
                      <span
                        key={goalId}
                        className="rounded-full bg-cream-50 px-2 py-0.5 text-xs text-stone-500"
                      >
                        {formatGoalOptionLabel(goal)}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex flex-1 items-end justify-end gap-1">
                <button
                  onClick={() => setEditingMaterial(material)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeletingMaterial(material)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <MaterialFormModal
          mode="add"
          subjects={subjects}
          goalOptions={goalOptions}
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingMaterial && (
        <MaterialFormModal
          mode="edit"
          subjects={subjects}
          goalOptions={goalOptions}
          initialMaterial={editingMaterial}
          onCancel={() => setEditingMaterial(null)}
          onSubmit={handleEdit}
        />
      )}

      {deletingMaterial && (
        <DeleteMaterialConfirmModal
          material={deletingMaterial}
          onCancel={() => setDeletingMaterial(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
