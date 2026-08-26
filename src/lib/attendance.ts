import type { AttendanceReason } from "./types";

export const ATTENDANCE_REASONS: AttendanceReason[] = [
  "sick",
  "vacation",
  "school_event",
  "other",
];

export const ATTENDANCE_REASON_LABELS: Record<AttendanceReason, string> = {
  sick: "Sick",
  vacation: "Vacation",
  school_event: "School event",
  other: "Other",
};
