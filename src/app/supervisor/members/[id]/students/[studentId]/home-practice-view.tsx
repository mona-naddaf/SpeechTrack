"use client";

import { Home } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { HomePracticeItem } from "@/lib/types";
import SectionHeader from "@/components/section-header";
import { useSectionPreferences } from "@/components/section-preferences";
import LinkifyText from "@/components/linkify-text";

type Props = {
  items: HomePracticeItem[];
  error: string | null;
};

/** Read-only mirror of HomePracticeSection — same item list, no "Add
 *  item" / Edit / Delete. Deliberately omits the parent access code
 *  block entirely: it's a login credential for the parent portal, not
 *  clinical data, and a supervisor has no reason to hold it. */
export default function HomePracticeView({ items, error }: Props) {
  const {
    collapsed,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
  } = useSectionPreferences("home_practice");

  return (
    <div>
      <SectionHeader
        icon={Home}
        title="Home practice"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />

      {!collapsed && (
        <>
          {error && (
            <p className="mt-4 text-sm text-red-600">
              Couldn&apos;t load home practice items: {error}
            </p>
          )}

          {!error && items.length === 0 && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <Home className="h-6 w-6 text-brand-500" />
              </div>
              <p className="text-stone-500">No home practice items yet.</p>
            </div>
          )}

          {items.length > 0 && (
            <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-3 sm:px-5">
                  <p className="font-medium text-stone-900">
                    <LinkifyText text={item.what_to_practice} />
                  </p>
                  {item.how_to_practice && (
                    <p className="mt-1 text-sm text-stone-600">
                      <LinkifyText text={item.how_to_practice} />
                    </p>
                  )}
                  {item.last_worked_date && (
                    <p className="mt-1 text-xs text-stone-400">
                      Last worked: {formatDate(item.last_worked_date)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
