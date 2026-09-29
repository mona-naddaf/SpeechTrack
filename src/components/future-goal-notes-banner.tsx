import { Lightbulb } from "lucide-react";
import LinkifyText from "./linkify-text";

type Props = {
  notes: { id: string; text: string }[];
};

/** Persistent reminder shown every time a new session starts for this
 *  student, for as long as any future-goal-idea note is unresolved — see
 *  future_goal_notes/teacher_future_goal_notes (0040_future_goal_notes.sql).
 *  Pure display, no Supabase calls: promoting or deleting a note (from the
 *  student page's "Future goals" area) is what makes it stop appearing
 *  here. */
export default function FutureGoalNotesBanner({ notes }: Props) {
  if (notes.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
        <Lightbulb className="h-4 w-4 shrink-0" />
        You wanted to work on:
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-9 text-sm text-amber-900">
        {notes.map((note) => (
          <li key={note.id}>
            <LinkifyText text={note.text} />
          </li>
        ))}
      </ul>
    </div>
  );
}
