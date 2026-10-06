"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTodayLocalDateString } from "@/lib/date";
import type {
  MaterialChip,
  ResponseFormatOption,
  TeacherBankGoal,
  TeacherGoalWithRelations,
  TeacherSessionGoal,
  TeacherSubject,
  Trial,
} from "@/lib/types";
import type { MaterialUsageSummary } from "@/lib/progress";
import { resolveQueuePlacement } from "@/lib/goal-queue-placement";
import ReinforcementSessionPanel from "@/components/reinforcement-session-panel";
import FutureGoalNoteQuickAdd from "@/components/future-goal-note-quick-add";
import GoalTrialCard from "./goal-trial-card";
import type { AddMaterialResult } from "./goal-material-section";
import GoalFormModal, { type GoalFormValues } from "../../goal-form-modal";

const GOAL_SELECT_COLUMNS =
  "id, student_id, subject_id, text, response_format_id, baseline, target_percent, status, visible_to_parent, track_id, step_order, created_at, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name), track:teacher_goal_tracks(id, name)";

const QUEUE_TABLES = {
  goalsTable: "teacher_goals" as const,
  tracksTable: "teacher_goal_tracks" as const,
  ownerColumn: "teacher_id" as const,
  categoryTable: "teacher_subjects" as const,
};

type Props = {
  studentId: string;
  goals: TeacherSessionGoal[];
  initialMaterialsByGoalId: Record<string, MaterialChip[]>;
  lastUsedByGoalId: Record<string, Record<string, MaterialUsageSummary>>;
  subjects: TeacherSubject[];
  responseFormats: ResponseFormatOption[];
  /** Account-wide default response format (validated server-side), or
   *  null. Pre-selected for NEW goals only — see src/lib/default-format.ts. */
  defaultFormatId: string | null;
  bankGoals: TeacherBankGoal[];
  /** This student's full goal list (every status, tracked or not) — used
   *  only to power the "+ Add goal" modal's queue-behind picker, same as
   *  goals-section.tsx's own studentGoals/studentTracks. Grows in place
   *  when a goal is added mid-session. */
  initialStudentGoals: TeacherGoalWithRelations[];
};

export default function NewSessionForm({
  studentId,
  goals: initialGoals,
  initialMaterialsByGoalId,
  lastUsedByGoalId,
  subjects,
  responseFormats,
  defaultFormatId,
  bankGoals,
  initialStudentGoals,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState(getTodayLocalDateString());
  const [note, setNote] = useState("");
  const [shareNoteWithParent, setShareNoteWithParent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [goals, setGoals] = useState<TeacherSessionGoal[]>(initialGoals);
  const [allGoals, setAllGoals] = useState<TeacherGoalWithRelations[]>(
    initialStudentGoals
  );
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
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

  // Same grouping goals-section.tsx's own useMemo does, just scoped to
  // what the "+ Add goal" modal's queue-behind picker needs — no track
  // ladders are ever rendered on this page, so standalone goals aren't
  // split out here.
  const studentTracks = useMemo(() => {
    const byTrackId = new Map<
      string,
      { name: string; steps: TeacherGoalWithRelations[] }
    >();
    for (const goal of allGoals) {
      if (goal.track_id && goal.track) {
        const entry = byTrackId.get(goal.track_id) ?? {
          name: goal.track.name,
          steps: [],
        };
        entry.steps.push(goal);
        byTrackId.set(goal.track_id, entry);
      }
    }
    return Array.from(byTrackId.entries()).map(([trackId, { name, steps }]) => ({
      trackId,
      name,
      steps: [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0)),
    }));
  }, [allGoals]);

  // Same insert (and queue-placement) logic as goals-section.tsx's own
  // handleAdd — duplicated here rather than shared since this component
  // has no access to that one's local state. A newly active goal is
  // appended straight into the trial-card list so she can start tallying
  // it without leaving this session; a queued/on-hold/mastered one only
  // updates allGoals (for future queue placements), same as anywhere else
  // that only shows active goals for logging.
  async function handleAddGoal(values: GoalFormValues): Promise<string | null> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "You need to be signed in.";

    let trackId: string | null = null;
    let stepOrder: number | null = null;
    if (values.queueBehind) {
      const placement = await resolveQueuePlacement(
        supabase,
        QUEUE_TABLES,
        user.id,
        studentId,
        values.queueBehind
      );
      if (!placement.ok) return placement.error;
      trackId = placement.trackId;
      stepOrder = placement.stepOrder;
    }

    const { data, error } = await supabase
      .from("teacher_goals")
      .insert({
        teacher_id: user.id,
        student_id: studentId,
        subject_id: values.subjectId,
        text: values.text,
        response_format_id: values.responseFormatId,
        baseline: values.baseline || null,
        target_percent: values.targetPercent,
        status: values.status,
        source_bank_goal_id: values.sourceBankGoalId,
        track_id: trackId,
        step_order: stepOrder,
      })
      .select("id")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    const { data: refreshedGoals } = await supabase
      .from("teacher_goals")
      .select(GOAL_SELECT_COLUMNS)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    setAllGoals((refreshedGoals ?? []) as unknown as TeacherGoalWithRelations[]);

    if (values.status === "active") {
      const { data: newSessionGoal } = await supabase
        .from("teacher_goals")
        .select(
          "id, text, source_bank_goal_id, subject:teacher_subjects(id, name), response_format:teacher_response_formats(id, name, type, config)"
        )
        .eq("id", data.id)
        .single();
      if (newSessionGoal) {
        setGoals((prev) => [
          newSessionGoal as unknown as TeacherSessionGoal,
          ...prev,
        ]);
      }
    }

    setShowAddGoalModal(false);
    return null;
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

      <ReinforcementSessionPanel
        boardsTable="teacher_reinforcement_boards"
        sessionsTable="teacher_sessions"
        storageNamespace="teacher"
        toolkitHref="/teacher/toolkit/reinforcement-boards"
        ensureSessionId={ensureSession}
      />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">Goals</h2>
        <button
          type="button"
          onClick={() => setShowAddGoalModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Add goal
        </button>
      </div>

      {goals.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
          This student has no active goals yet. Add one above, or just save
          a note below.
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

      <FutureGoalNoteQuickAdd
        notesTable="teacher_future_goal_notes"
        ownerColumn="teacher_id"
        studentId={studentId}
      />

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

      {showAddGoalModal && (
        <GoalFormModal
          mode="add"
          subjects={subjects}
          responseFormats={responseFormats}
          defaultFormatId={defaultFormatId}
          bankGoals={bankGoals}
          studentGoals={allGoals}
          studentTracks={studentTracks}
          onCancel={() => setShowAddGoalModal(false)}
          onSubmit={handleAddGoal}
        />
      )}
    </div>
  );
}
