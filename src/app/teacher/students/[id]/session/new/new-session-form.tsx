"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTodayLocalDateString } from "@/lib/date";
import type { TeacherSessionGoal, Trial } from "@/lib/types";
import GoalTrialCard from "./goal-trial-card";

type Props = {
  studentId: string;
  goals: TeacherSessionGoal[];
};

export default function NewSessionForm({ studentId, goals }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(getTodayLocalDateString());
  const [note, setNote] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [trialsByGoal, setTrialsByGoal] = useState<Record<string, Trial[]>>(
    {}
  );
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
