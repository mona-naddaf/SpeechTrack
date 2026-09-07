"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTodayLocalDateString } from "@/lib/date";
import type { MaterialChip, TeacherSessionGoal, Trial } from "@/lib/types";
import type { MaterialUsageSummary } from "@/lib/progress";
import GoalTrialCard from "./goal-trial-card";
import type { AddMaterialResult } from "./goal-material-section";

type Props = {
  studentId: string;
  goals: TeacherSessionGoal[];
  initialMaterialsByGoalId: Record<string, MaterialChip[]>;
  lastUsedByGoalId: Record<string, Record<string, MaterialUsageSummary>>;
};

export default function NewSessionForm({
  studentId,
  goals,
  initialMaterialsByGoalId,
  lastUsedByGoalId,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState(getTodayLocalDateString());
  const [note, setNote] = useState("");
  const [shareNoteWithParent, setShareNoteWithParent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [trialsByGoal, setTrialsByGoal] = useState<Record<string, Trial[]>>(
    {}
  );
  // Session-scoped only — never persisted on its own, just tagged onto
  // whichever trials get logged for that goal from here on. Starts empty
  // even if a goal has just one linked material; she still picks it.
  const [activeMaterialByGoal, setActiveMaterialByGoal] = useState<
    Record<string, string | null>
  >({});
  // Seeded from the server, then grows in place as she adds a new
  // material inline mid-session (so it shows up in that goal's picker
  // without a page reload).
  const [materialsByGoalId, setMaterialsByGoalId] = useState<
    Record<string, MaterialChip[]>
  >(initialMaterialsByGoalId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-saves: the session row (and every trial) is written to the
  // database the moment it happens, so nothing is lost if the Teacher
  // navigates away mid-session. "Save session" just finalizes the note/date.
  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You need to be signed in.");
      return null;
    }

    const { data, error } = await supabase
      .from("teacher_sessions")
      .insert({
        teacher_id: user.id,
        student_id: studentId,
        date,
        note: note.trim() || null,
        visible_to_parent: shareNoteWithParent,
      })
      .select("id")
      .single();

    if (error || !data) {
      setError(error?.message ?? "Could not start the session.");
      return null;
    }

    setSessionId(data.id);
    return data.id;
  }

  // Same immediate-save pattern as the other parent-sharing toggles
  // (e.g. a goal's "Show progress to parent" checkbox) — if the session
  // row doesn't exist yet (nothing logged this visit), the choice is just
  // held in state and included the moment ensureSession() first creates it.
  async function handleToggleShareNote(checked: boolean) {
    setShareNoteWithParent(checked);
    if (sessionId) {
      const supabase = createClient();
      await supabase
        .from("teacher_sessions")
        .update({ visible_to_parent: checked })
        .eq("id", sessionId);
    }
  }

  async function handleDateChange(newDate: string) {
    setDate(newDate);
    if (sessionId) {
      const supabase = createClient();
      await supabase
        .from("teacher_sessions")
        .update({ date: newDate })
        .eq("id", sessionId);
    }
  }

  async function logTrial(goal: TeacherSessionGoal, value: Record<string, unknown>) {
    setError(null);
    const id = await ensureSession();
    if (!id) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("teacher_trials")
      .insert({
        session_id: id,
        goal_id: goal.id,
        response_format_type: goal.response_format?.type ?? "correct_incorrect",
        value,
        material_id: activeMaterialByGoal[goal.id] ?? null,
      })
      .select("id, goal_id, value, created_at")
      .single();

    if (error || !data) {
      setError(error?.message ?? "Could not log that trial.");
      return;
    }

    setTrialsByGoal((prev) => ({
      ...prev,
      [goal.id]: [...(prev[goal.id] ?? []), data],
    }));
  }

  async function undoLast(goalId: string) {
    const trials = trialsByGoal[goalId] ?? [];
    const last = trials[trials.length - 1];
    if (!last) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("teacher_trials")
      .delete()
      .eq("id", last.id);

    if (error) {
      setError(error.message);
      return;
    }

    setTrialsByGoal((prev) => ({
      ...prev,
      [goalId]: (prev[goalId] ?? []).slice(0, -1),
    }));
  }

  function handleSelectMaterial(goalId: string, materialId: string | null) {
    setActiveMaterialByGoal((prev) => ({ ...prev, [goalId]: materialId }));
  }

  // Creates a new material bank entry tagged with this goal's subject,
  // links it to the goal (so it shows up here again next session and on
  // the goal card back on the student page), and selects it immediately.
  async function handleAddMaterial(
    goal: TeacherSessionGoal,
    title: string,
    url: string
  ): Promise<AddMaterialResult> {
    if (!goal.subject) {
      return { error: "This goal has no category, so a material can't be filed under one." };
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You need to be signed in." };

    const { data, error } = await supabase
      .from("teacher_materials")
      .insert({
        teacher_id: user.id,
        title,
        url,
        description: null,
        subject_id: goal.subject.id,
        visibility: "private",
      })
      .select("id, title, url")
      .single();

    if (error || !data) {
      return { error: error?.message ?? "Could not add that material." };
    }

    // Link to the goal's bank template when it has one, rather than this
    // one student's specific goal row, so the new material shows up for
    // every student assigned that same bank goal — same rule the
    // Toolkit materials page follows (see resolveMaterialChipsByGoal).
    const { error: linkError } = await supabase.from("teacher_material_goals").insert({
      material_id: data.id,
      goal_id: goal.source_bank_goal_id ?? goal.id,
    });
    if (linkError) return { error: linkError.message };

    setMaterialsByGoalId((prev) => ({
      ...prev,
      [goal.id]: [...(prev[goal.id] ?? []), data],
    }));
    handleSelectMaterial(goal.id, data.id);

    return { material: data };
  }

  async function handleSave() {
    setError(null);
    const totalTrials = Object.values(trialsByGoal).reduce(
      (sum, list) => sum + list.length,
      0
    );

    // Nothing was ever logged and there's no note — nothing to save.
    if (!sessionId && !note.trim() && totalTrials === 0) {
      router.push(`/teacher/students/${studentId}`);
      return;
    }

    setSaving(true);
    const id = sessionId ?? (await ensureSession());
    if (id) {
      const supabase = createClient();
      const { error } = await supabase
        .from("teacher_sessions")
        .update({ note: note.trim() || null, date })
        .eq("id", id);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push(`/teacher/students/${studentId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4">
        <label
          htmlFor="session-date"
          className="block text-sm font-medium text-stone-700"
        >
          Date
        </label>
        <input
          id="session-date"
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {goals.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
          This student has no active goals yet. Add a goal on their page
          first, or just save a note below.
        </div>
      )}

      <div className="space-y-4">
        {goals.map((goal) => (
          <GoalTrialCard
            key={goal.id}
            goal={goal}
            trials={trialsByGoal[goal.id] ?? []}
            onLogTrial={(value) => logTrial(goal, value)}
            onUndo={() => undoLast(goal.id)}
            materials={materialsByGoalId[goal.id] ?? []}
            activeMaterialId={activeMaterialByGoal[goal.id] ?? null}
            lastUsedStats={
              (activeMaterialByGoal[goal.id] &&
                lastUsedByGoalId[goal.id]?.[activeMaterialByGoal[goal.id]!]) ||
              null
            }
            onSelectMaterial={(materialId) =>
              handleSelectMaterial(goal.id, materialId)
            }
            onAddMaterial={(title, url) => handleAddMaterial(goal, title, url)}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md p-4">
        <label
          htmlFor="session-note"
          className="block text-sm font-medium text-stone-700"
        >
          Session note <span className="text-stone-400">(optional)</span>
        </label>
        <textarea
          id="session-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="What happened in this session?"
        />
        <label className="mt-2 flex items-center gap-2 text-xs font-medium text-stone-500">
          <input
            type="checkbox"
            checked={shareNoteWithParent}
            onChange={(e) => handleToggleShareNote(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
          />
          Share this note with parent
        </label>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-brand-700 px-4 py-3 text-base font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 sm:w-auto"
          >
            {saving ? "Saving…" : "Save session"}
          </button>
        </div>
      </div>
    </div>
  );
}
