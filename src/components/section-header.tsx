import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** The section's own primary action button(s), e.g. "+ Set a goal" —
   *  stays in its usual spot on the right, still fully clickable
   *  regardless of collapsed state. */
  actions?: React.ReactNode;
};

/** The clickable, collapsible header row every student-page section uses
 *  (Goals, Sessions, Behavior, ...): chevron + icon + title toggles
 *  collapse, small up/down arrows reorder the section relative to the
 *  others. Pair with useSectionPreferences() (section-preferences.tsx)
 *  in the section component to wire collapsed/order state through — that
 *  state is shared globally across every section on the page. */
export default function SectionHeader({
  icon: Icon,
  title,
  collapsed,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  actions,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        className="flex min-w-0 items-center gap-2 text-lg font-semibold text-stone-900 transition-colors hover:text-brand-700"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
        )}
        <Icon className="h-5 w-5 shrink-0 text-brand-500" />
        <span className="truncate">{title}</span>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <div className="flex items-center gap-0.5 border-l border-stone-200 pl-2">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move ${title} section up`}
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move ${title} section down`}
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
