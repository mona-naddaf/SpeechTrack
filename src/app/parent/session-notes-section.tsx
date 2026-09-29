import { NotebookText } from "lucide-react";
import { formatDate } from "@/lib/date";
import LinkifyText from "@/components/linkify-text";

export type ParentSessionNote = {
  id: string;
  date: string;
  note: string;
};

type Props = {
  notes: ParentSessionNote[];
};

/** Session notes the SLP/Teacher has explicitly opted to share, most
 *  recent first. Unlike Behavior (an on/off toggle for the whole
 *  student), sharing here is per-session, so there's no separate
 *  "enabled" flag to check — the parent-dashboard page only renders this
 *  at all once there's at least one shared note, same as Progress. */
export default function SessionNotesSection({ notes }: Props) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
        <NotebookText className="h-5 w-5 text-brand-500" />
        Notes from your therapist/teacher
      </h2>

      <div className="mt-3 space-y-3">
        {notes.map((entry) => (
          <div
            key={entry.id}
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="font-medium text-stone-900">{formatDate(entry.date)}</p>
            <p className="mt-1 text-sm text-stone-600">
              <LinkifyText text={entry.note} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
