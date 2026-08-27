import { Link2 } from "lucide-react";
import type { MaterialChip } from "@/lib/types";

type Props = {
  materials: MaterialChip[];
};

/** Small clickable link chips for any materials linked to a goal — shown
 *  right on the goal card (student page, both sides) so relevant
 *  resources surface where she's already working, not just on the
 *  materials toolkit page. Renders nothing when there's nothing linked. */
export default function MaterialChips({ materials }: Props) {
  if (materials.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {materials.map((material) => (
        <a
          key={material.id}
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
          title={material.title}
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100"
        >
          <Link2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{material.title}</span>
        </a>
      ))}
    </div>
  );
}
