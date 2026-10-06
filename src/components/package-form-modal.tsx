"use client";

import { useState, type FormEvent } from "react";
import { formatDate, getTodayLocalDateString } from "@/lib/date";

export type PackageFormValues = {
  totalSessions: number;
  startDate: string;
};

type Props =
  | {
      mode: "setup";
      onCancel: () => void;
      onSubmit: (values: PackageFormValues) => Promise<string | null>;
    }
  | {
      mode: "edit";
      defaultTotalSessions: number;
      defaultStartDate: string;
      /** How many currently-counted/carry-over items a given start date
       *  would push out, for the live warning under the date field. */
      countDroppedBefore: (startDate: string) => number;
      onCancel: () => void;
      onSubmit: (values: PackageFormValues) => Promise<string | null>;
    }
  | {
      mode: "renew";
      /** Pre-fills the session count with the ending package's size. */
      defaultTotalSessions: number;
      /** Not editable on renewal — derived so extras carry over (see
       *  renewalStartDate in src/lib/packages.ts); shown for context. */
      startDate: string;
      carryOverCount: number;
      onCancel: () => void;
      onSubmit: (values: PackageFormValues) => Promise<string | null>;
    };

/** "Set up package" (session count + start date), "Edit package" (the
 *  same two fields, pre-filled) and "Renew package" (session count only,
 *  pre-filled with the ending package's). */
export default function PackageFormModal(props: Props) {
  const [totalSessions, setTotalSessions] = useState(
    props.mode === "setup" ? "6" : String(props.defaultTotalSessions)
  );
  const [startDate, setStartDate] = useState(
    props.mode === "renew"
      ? props.startDate
      : props.mode === "edit"
        ? props.defaultStartDate
        : getTodayLocalDateString()
  );
  const droppedCount =
    props.mode === "edit" && startDate ? props.countDroppedBefore(startDate) : 0;
  const title =
    props.mode === "renew"
      ? "Renew package"
      : props.mode === "edit"
        ? "Edit package"
        : "Set up package";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(totalSessions);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setError("Number of sessions must be a whole number from 1 to 100.");
      return;
    }
    if (!startDate) {
      setError("Please pick a start date.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await props.onSubmit({ totalSessions: n, startDate });
    setLoading(false);
    if (result) {
      setError(result);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          {props.mode === "renew" && (
            <p className="mt-1 text-sm text-stone-500">
              This ends the current package and starts a new one.
              {props.carryOverCount > 0 &&
                ` ${props.carryOverCount} extra ${
                  props.carryOverCount === 1 ? "item" : "items"
                } logged since it filled up will carry over.`}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="package-total-sessions"
                className="block text-sm font-medium text-stone-700"
              >
                Number of sessions
              </label>
              <input
                id="package-total-sessions"
                type="number"
                min={1}
                max={100}
                step={1}
                value={totalSessions}
                onChange={(e) => setTotalSessions(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {props.mode !== "renew" ? (
              <div>
                <label
                  htmlFor="package-start-date"
                  className="block text-sm font-medium text-stone-700"
                >
                  Start date
                </label>
                <input
                  id="package-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <p className="mt-1 text-xs text-stone-400">
                  Sessions, counted absences and manual entries on or after
                  this date fill the package.
                </p>
                {droppedCount > 0 && (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    {droppedCount} {droppedCount === 1 ? "item" : "items"} dated
                    before this will stop counting. Nothing is deleted —
                    moving the date back counts {droppedCount === 1 ? "it" : "them"} again.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-400">
                Starts {formatDate(startDate)}.
              </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={props.onCancel}
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
                {loading ? "Saving…" : props.mode === "edit" ? "Save changes" : title}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
