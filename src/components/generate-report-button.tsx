"use client";

import { useState, type FormEvent } from "react";
import { FileText } from "lucide-react";
import { daysAgoLocalDateString, getTodayLocalDateString } from "@/lib/date";

type Props = {
  studentId: string;
  studentName: string;
};

function slugifyName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "") || "Student"
  );
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** "Generate Report" — a small date-range picker (default: last 30 days)
 *  that hands off to the shared /api/report/generate route, which reads
 *  from either the SLP or Teacher tables depending on the signed-in
 *  account's role and returns a ready-to-download .docx file. One
 *  component reused by both student pages, same as AttendanceSection. */
export default function GenerateReportButton({ studentId, studentName }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState(() => daysAgoLocalDateString(30));
  const [endDate, setEndDate] = useState(() => getTodayLocalDateString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, startDate, endDate }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not generate the report.");
      }

      const blob = await res.blob();
      downloadBlob(
        `BloomTrack_Report_${slugifyName(studentName)}_${startDate}_to_${endDate}.docx`,
        blob
      );
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md"
      >
        <FileText className="h-4 w-4" />
        Generate report
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/50 px-4 py-8">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900">Generate report</h2>
            <p className="mt-1 text-sm text-stone-500">
              Creates a downloadable, editable Word document summarizing{" "}
              {studentName}&apos;s goals, sessions, attendance, and behaviour
              over the selected period.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="report-start-date"
                    className="block text-sm font-medium text-stone-700"
                  >
                    Start date
                  </label>
                  <input
                    id="report-start-date"
                    type="date"
                    value={startDate}
                    max={endDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="report-end-date"
                    className="block text-sm font-medium text-stone-700"
                  >
                    End date
                  </label>
                  <input
                    id="report-end-date"
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={getTodayLocalDateString()}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {loading ? "Generating…" : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
