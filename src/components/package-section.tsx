"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Package, Plus, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, getTodayLocalDateString } from "@/lib/date";
import {
  PACKAGE_ITEM_KIND_LABELS,
  derivePackageState,
  renewalStartDate,
  type PackageItem,
} from "@/lib/packages";
import type { StudentPackage } from "@/lib/types";
import SectionHeader from "./section-header";
import { useSectionPreferences } from "./section-preferences";
import PackageFormModal, { type PackageFormValues } from "./package-form-modal";
import ManualEntryModal, { type ManualEntryValues } from "./manual-entry-modal";
import DeleteManualEntryModal from "./delete-manual-entry-modal";
import CancelPackageConfirmModal from "./cancel-package-confirm-modal";

type Props = {
  studentId: string;
  packages: StudentPackage[];
  /** Every logged session, counted absence and manual entry for this
   *  student (see buildPackageItems) — which ones fill a circle is
   *  derived here, so these props are the whole source of truth. */
  items: PackageItem[];
} & (
  | {
      readOnly?: false;
      /** Written into whichever of slp_id / teacher_id `ownerField`
       *  names — same shared-table pattern as AttendanceSection. */
      ownerId: string;
      ownerField: "slp_id" | "teacher_id";
    }
  | {
      /** Supervisor view: circles + "What's counted", no controls. */
      readOnly: true;
    }
);

const KIND_BADGE_CLASSES: Record<PackageItem["kind"], string> = {
  session: "bg-brand-100 text-brand-800",
  absence: "bg-amber-100 text-amber-800",
  manual: "bg-stone-100 text-stone-700",
};

/** Session package circles, shared by the SLP, Teacher and (read-only)
 *  supervisor student pages. Holds no copy of the data: every mutation
 *  here — and in SessionsSection/AttendanceSection, whose rows also
 *  fill circles — writes to Supabase and then router.refresh()es, so the
 *  page re-fetches and the circles re-derive from the rows themselves. */
export default function PackageSection(props: Props) {
  const { studentId, packages, items } = props;
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [modal, setModal] = useState<
    "setup" | "renew" | "manual" | "edit" | "cancel" | null
  >(null);
  const [deletingEntry, setDeletingEntry] = useState<PackageItem | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("package");

  const state = derivePackageState(packages, items);
  const today = getTodayLocalDateString();

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleSetup(values: PackageFormValues) {
    if (props.readOnly) return null;
    const { error } = await createClient().from("student_packages").insert({
      [props.ownerField]: props.ownerId,
      student_id: studentId,
      total_sessions: values.totalSessions,
      start_date: values.startDate,
    });
    if (error) return error.message;
    setModal(null);
    refresh();
    return null;
  }

  // Two writes (end the old package, insert the new one) with a manual
  // rollback, since the partial unique index only allows one un-ended
  // package per student at a time — the insert can't go first.
  async function handleRenew(values: PackageFormValues) {
    if (props.readOnly || !state) return null;
    const supabase = createClient();
    const { data: ended, error: endError } = await supabase
      .from("student_packages")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", state.current.id)
      .is("ended_at", null)
      .select("id");
    if (endError) return endError.message;
    if (!ended || ended.length === 0) {
      return "This package was already renewed — reload the page to see the current one.";
    }

    const { error: insertError } = await supabase.from("student_packages").insert({
      [props.ownerField]: props.ownerId,
      student_id: studentId,
      total_sessions: values.totalSessions,
      start_date: values.startDate,
    });
    if (insertError) {
      await supabase
        .from("student_packages")
        .update({ ended_at: null })
        .eq("id", state.current.id);
      return insertError.message;
    }
    setModal(null);
    refresh();
    return null;
  }

  // Only the package row's two editable fields change — the circles
  // re-derive from them on refresh like after any other change.
  async function handleEdit(values: PackageFormValues) {
    if (props.readOnly || !state) return null;
    const { data, error } = await createClient()
      .from("student_packages")
      .update({ total_sessions: values.totalSessions, start_date: values.startDate })
      .eq("id", state.current.id)
      .is("ended_at", null)
      .select("id");
    if (error) return error.message;
    if (!data || data.length === 0) {
      return "This package is no longer active — reload the page to see the current one.";
    }
    setModal(null);
    refresh();
    return null;
  }

  // Deletes the package row outright (an ended row would keep consuming
  // items) along with its manual entries — the ones no ended package
  // consumed (state.ownedManualEntries), so earlier packages are never
  // touched. Manual entries go first; if the package delete then fails
  // they're re-inserted as they were, same manual-rollback approach as
  // handleRenew.
  async function handleCancelPackage() {
    if (props.readOnly || !state) return null;
    const supabase = createClient();
    const owned = state.ownedManualEntries;

    if (owned.length > 0) {
      const { error } = await supabase
        .from("package_manual_entries")
        .delete()
        .in("id", owned.map((e) => e.id));
      if (error) return error.message;
    }

    const { data, error } = await supabase
      .from("student_packages")
      .delete()
      .eq("id", state.current.id)
      .is("ended_at", null)
      .select("id");
    if (error || !data || data.length === 0) {
      if (owned.length > 0) {
        await supabase.from("package_manual_entries").insert(
          owned.map((e) => ({
            id: e.id,
            [props.ownerField]: props.ownerId,
            student_id: studentId,
            date: e.date,
            note: e.note,
            created_at: e.created_at,
          }))
        );
      }
      return error?.message ?? "Couldn't cancel this package — reload the page and try again.";
    }

    setModal(null);
    refresh();
    return null;
  }

  async function handleAddManual(values: ManualEntryValues) {
    if (props.readOnly) return null;
    const { error } = await createClient().from("package_manual_entries").insert({
      [props.ownerField]: props.ownerId,
      student_id: studentId,
      date: values.date,
      note: values.note || null,
    });
    if (error) return error.message;
    setModal(null);
    refresh();
    return null;
  }

  async function handleDeleteManual() {
    if (!deletingEntry) return null;
    const { data, error } = await createClient()
      .from("package_manual_entries")
      .delete()
      .eq("id", deletingEntry.id)
      .select("id");
    if (error) return error.message;
    // RLS turns a not-allowed delete into a silent zero-row no-op.
    if (!data || data.length === 0) return "Couldn't delete this entry.";
    setDeletingEntry(null);
    refresh();
    return null;
  }

  const actionButtonClass =
    "inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0";

  let actions: React.ReactNode = null;
  if (!props.readOnly) {
    if (!state) {
      actions = (
        <button
          type="button"
          onClick={() => setModal("setup")}
          className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
        >
          Set up package
        </button>
      );
    } else if (state.isFull) {
      actions = (
        <button
          type="button"
          onClick={() => setModal("renew")}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <RefreshCw className="h-4 w-4" />
          Renew package
        </button>
      );
    } else {
      actions = (
        <button
          type="button"
          onClick={() => setModal("manual")}
          disabled={isRefreshing}
          className={actionButtonClass}
        >
          <Plus className="h-4 w-4" />
          Add session manually
        </button>
      );
    }
  }

  return (
    <div>
      <SectionHeader
        icon={Package}
        title="Session package"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        actions={actions}
      />

      {!collapsed && !state && (
        <p className="mt-3 text-sm text-stone-400">No session package set up.</p>
      )}

      {!collapsed && state && (
        <div
          data-testid="package-panel"
          className={`mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-opacity sm:p-5 ${
            isRefreshing ? "opacity-60" : ""
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-stone-900" data-testid="package-progress">
              {state.counted.length} of {state.current.total_sessions} sessions used
            </p>
            <p className="text-xs text-stone-400">
              Started {formatDate(state.current.start_date)}
            </p>
          </div>

          <ul
            className="mt-3 flex flex-wrap gap-2"
            aria-label={`${state.counted.length} of ${state.current.total_sessions} package sessions used`}
          >
            {Array.from({ length: state.current.total_sessions }, (_, i) => {
              const item = state.counted[i];
              return (
                <li
                  key={i}
                  data-testid="package-circle"
                  data-filled={item ? "true" : "false"}
                  title={
                    item
                      ? `${PACKAGE_ITEM_KIND_LABELS[item.kind]} · ${formatDate(item.date)}`
                      : "Not used yet"
                  }
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    item
                      ? "border-accent-500 bg-accent-500 text-white"
                      : "border-stone-300 bg-white"
                  }`}
                >
                  {item && <Check className="h-4 w-4" />}
                </li>
              );
            })}
          </ul>

          {state.isFull && (
            <p className="mt-3 text-sm text-stone-600">
              Package complete.
              {state.extras.length > 0 &&
                ` ${state.extras.length} extra ${
                  state.extras.length === 1 ? "item has" : "items have"
                } been logged since — ${
                  state.extras.length === 1 ? "it" : "they"
                } will carry over when the package is renewed.`}
            </p>
          )}

          {(state.counted.length > 0 || state.extras.length > 0) && (
            <div className="mt-4 border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={() => setListOpen((open) => !open)}
                aria-expanded={listOpen}
                className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 transition-colors hover:text-brand-700"
              >
                {listOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                What&apos;s counted ({state.counted.length})
              </button>

              {listOpen && (
                <>
                  <CountedList
                    items={state.counted}
                    readOnly={Boolean(props.readOnly)}
                    onDelete={setDeletingEntry}
                  />
                  {state.extras.length > 0 && (
                    <>
                      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-400">
                        Carries over to the next package
                      </p>
                      <CountedList
                        items={state.extras}
                        readOnly={Boolean(props.readOnly)}
                        onDelete={setDeletingEntry}
                      />
                    </>
                  )}
                  {!props.readOnly && (
                    <p className="mt-2 text-xs text-stone-400">
                      To remove a logged session, delete it from Sessions. To
                      stop an absence counting, edit it in Attendance and
                      untick &ldquo;Counts toward package&rdquo;.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {!props.readOnly && (
            <div className="mt-4 flex flex-wrap justify-end gap-1 border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={() => setModal("edit")}
                disabled={isRefreshing}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-50"
              >
                Edit package
              </button>
              <button
                type="button"
                onClick={() => setModal("cancel")}
                disabled={isRefreshing}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Cancel package
              </button>
            </div>
          )}
        </div>
      )}

      {modal === "setup" && (
        <PackageFormModal
          mode="setup"
          onCancel={() => setModal(null)}
          onSubmit={handleSetup}
        />
      )}
      {modal === "renew" && state && (
        <PackageFormModal
          mode="renew"
          defaultTotalSessions={state.current.total_sessions}
          startDate={renewalStartDate(state, today)}
          carryOverCount={state.extras.length}
          onCancel={() => setModal(null)}
          onSubmit={handleRenew}
        />
      )}
      {modal === "edit" && state && (
        <PackageFormModal
          mode="edit"
          defaultTotalSessions={state.current.total_sessions}
          defaultStartDate={state.current.start_date}
          countDroppedBefore={(startDate) =>
            [...state.counted, ...state.extras].filter(
              (item) => item.date < startDate
            ).length
          }
          onCancel={() => setModal(null)}
          onSubmit={handleEdit}
        />
      )}
      {modal === "cancel" && state && (
        <CancelPackageConfirmModal
          totalSessions={state.current.total_sessions}
          manualEntryCount={state.ownedManualEntries.length}
          onCancel={() => setModal(null)}
          onConfirm={handleCancelPackage}
        />
      )}
      {modal === "manual" && (
        <ManualEntryModal onCancel={() => setModal(null)} onSubmit={handleAddManual} />
      )}
      {deletingEntry && (
        <DeleteManualEntryModal
          entry={deletingEntry}
          onCancel={() => setDeletingEntry(null)}
          onConfirm={handleDeleteManual}
        />
      )}
    </div>
  );
}

function CountedList({
  items,
  readOnly,
  onDelete,
}: {
  items: PackageItem[];
  readOnly: boolean;
  onDelete: (item: PackageItem) => void;
}) {
  return (
    <ul className="mt-2 divide-y divide-stone-100" data-testid="package-counted-list">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-stone-900">
                {formatDate(item.date)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE_CLASSES[item.kind]}`}
              >
                {PACKAGE_ITEM_KIND_LABELS[item.kind]}
              </span>
            </div>
            {item.note && (
              <p className="mt-0.5 truncate text-sm text-stone-500">{item.note}</p>
            )}
          </div>
          {!readOnly && item.kind === "manual" && (
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="shrink-0 rounded-lg px-3 py-1 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
