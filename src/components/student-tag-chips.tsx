import { getColorOption } from "@/lib/colors";
import { STUDENT_STATUS_LABELS } from "@/lib/student-list";
import type { StudentStatus, StudentTag } from "@/lib/types";

/** Small colored tag chips — the student-list row and student page
 *  header. Internal only: never rendered in parent/classroom views. */
export function StudentTagChips({
  tags,
  max,
}: {
  tags: StudentTag[];
  /** Show at most this many, then a "+N" chip (all names in its title).
   *  Single-line mode: chips don't wrap. Omit to show every tag. */
  max?: number;
}) {
  if (tags.length === 0) return null;
  const shown = max === undefined ? tags : tags.slice(0, max);
  const hidden = tags.slice(shown.length);
  return (
    <span
      className={`flex gap-1 ${max === undefined ? "flex-wrap" : "min-w-0 flex-nowrap overflow-hidden"}`}
      data-testid="student-tag-chips"
    >
      {shown.map((tag) => (
        <span
          key={tag.id}
          className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${getColorOption(tag.color).badgeClass}`}
        >
          {tag.name}
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          title={hidden.map((t) => t.name).join(", ")}
          className="shrink-0 whitespace-nowrap rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600"
        >
          +{hidden.length}
        </span>
      )}
    </span>
  );
}

/** "Trial" / "Stopped" / "Archived" badge; nothing for an Active student. */
export function StudentStatusBadge({
  status,
  archived,
}: {
  status: StudentStatus;
  archived?: boolean;
}) {
  if (archived) {
    return (
      <span
        data-testid="student-status-badge"
        className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700"
      >
        Archived
      </span>
    );
  }
  if (status === "active") return null;
  return (
    <span
      data-testid="student-status-badge"
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        status === "trial" ? "bg-blue-100 text-blue-800" : "bg-stone-200 text-stone-700"
      }`}
    >
      {STUDENT_STATUS_LABELS[status]}
    </span>
  );
}
