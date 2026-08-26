"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTrialValue } from "@/lib/trial-value";

type Props = {
  studentId: string;
  studentName: string;
};

type RawTrial = {
  id: string;
  goal_id: string;
  response_format_type: string;
  value: Record<string, unknown>;
  created_at: string;
  session: { id: string; date: string } | null;
};

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "student"
  );
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function ExportButtons({ studentId, studentName }: Props) {
  const [loading, setLoading] = useState<"json" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStudentData() {
    const supabase = createClient();

    const [studentRes, goalsRes, sessionsRes, trialsRes] = await Promise.all([
      supabase
        .from("teacher_students")
        .select("id, name, class, created_at")
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("teacher_goals")
        .select(
          "id, subject:teacher_subjects(id, name), text, response_format:teacher_response_formats(id, name, type, config), baseline, target_percent, status, created_at"
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: true }),
      supabase
        .from("teacher_sessions")
        .select("id, date, note, created_at")
        .eq("student_id", studentId)
        .order("date", { ascending: true }),
      supabase
        .from("teacher_trials")
        .select(
          "id, goal_id, response_format_type, value, created_at, session:teacher_sessions!inner(id, date, student_id)"
        )
        .eq("session.student_id", studentId)
        .order("created_at", { ascending: true }),
    ]);

    const firstError =
      studentRes.error || goalsRes.error || sessionsRes.error || trialsRes.error;
    if (firstError) {
      throw new Error(firstError.message);
    }

    return {
      student: studentRes.data,
      goals: goalsRes.data ?? [],
      sessions: sessionsRes.data ?? [],
      trials: (trialsRes.data ?? []) as unknown as RawTrial[],
    };
  }

  async function handleExportJson() {
    setError(null);
    setLoading("json");
    try {
      const data = await loadStudentData();
      const payload = {
        exported_at: new Date().toISOString(),
        student: data.student,
        goals: data.goals,
        sessions: data.sessions,
        trials: data.trials.map((t) => ({
          id: t.id,
          session_id: t.session?.id ?? null,
          goal_id: t.goal_id,
          response_format_type: t.response_format_type,
          value: t.value,
          created_at: t.created_at,
        })),
      };
      downloadFile(
        `${slugify(studentName)}-backup.json`,
        JSON.stringify(payload, null, 2),
        "application/json"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export data.");
    } finally {
      setLoading(null);
    }
  }

  async function handleExportCsv() {
    setError(null);
    setLoading("csv");
    try {
      const data = await loadStudentData();
      const goalTextById = new Map(data.goals.map((g) => [g.id, g.text]));

      const header = ["Session date", "Goal", "Response value"];
      const rows = data.trials.map((t) => [
        t.session?.date ?? "",
        goalTextById.get(t.goal_id) ?? "",
        formatTrialValue(t.value),
      ]);

      const csv = [header, ...rows]
        .map((row) => row.map((cell) => csvEscape(String(cell))).join(","))
        .join("\r\n");

      downloadFile(`${slugify(studentName)}-trials.csv`, csv, "text/csv");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export data.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleExportJson}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <Download className="h-4 w-4" />
        {loading === "json" ? "Exporting…" : "Export JSON backup"}
      </button>
      <button
        type="button"
        onClick={handleExportCsv}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <Download className="h-4 w-4" />
        {loading === "csv" ? "Exporting…" : "Export trials CSV"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
