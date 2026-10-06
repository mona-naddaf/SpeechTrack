import { getColorOption } from "@/lib/colors";
import { STUDENT_STATUS_LABELS } from "@/lib/student-list";
import type { StudentStatus, StudentTag } from "@/lib/types";

/** Small colored tag chips — the student-list row and student page
 *  header. Internal only: never rendered in parent/classroom views. */
export function StudentTagChips({ tags }: { tags: StudentTag[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1" data-testid="student-tag-chips">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getColorOption(tag.color).badgeClass}`}
        >
          {tag.name}
        </span>
      ))}
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
