"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type SectionPreferencesContextValue = {
  isCollapsed: (key: string) => boolean;
  toggleCollapsed: (key: string) => void;
  moveSection: (key: string, direction: -1 | 1) => void;
  orderIndex: (key: string) => number;
  sectionCount: number;
};

const SectionPreferencesContext =
  createContext<SectionPreferencesContextValue | null>(null);

/** Reads/writes one section's slice of the shared page preferences —
 *  what SectionHeader needs. Must be called from a component rendered
 *  inside a SectionPreferencesProvider (i.e. one of the section
 *  components a student page passes in). */
export function useSectionPreferences(key: string) {
  const ctx = useContext(SectionPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useSectionPreferences must be used within a SectionPreferencesProvider"
    );
  }
  const index = ctx.orderIndex(key);
  return {
    collapsed: ctx.isCollapsed(key),
    onToggleCollapse: () => ctx.toggleCollapsed(key),
    onMoveUp: () => ctx.moveSection(key, -1),
    onMoveDown: () => ctx.moveSection(key, 1),
    canMoveUp: index > 0,
    canMoveDown: index !== -1 && index < ctx.sectionCount - 1,
  };
}

export type SectionEntry = {
  key: string;
  defaultCollapsed: boolean;
  /** Pre-rendered — a Server Component page constructs each section
   *  element (e.g. <GoalsSection .../>) and hands it here as plain JSX,
   *  since a function couldn't cross the server/client boundary but an
   *  already-built element can. The section itself reads its own
   *  collapsed/order state back out via useSectionPreferences(key). */
  node: ReactNode;
};

type ProviderProps = {
  /** Distinguishes the SLP and Teacher student pages, which have a
   *  different set of sections — keeps their saved preferences separate
   *  in localStorage. This is a deliberately GLOBAL, cross-student
   *  preference (same order/collapse state on every student's page for
   *  that role), not per-student — see the "Section reordering" README bullet. */
  storageKey: string;
  sections: SectionEntry[];
};

/** Renders `sections` in a user-reorderable order and gives each one
 *  access to its own collapsed state and move-up/move-down handlers via
 *  context (see useSectionPreferences). Order + collapsed state persist
 *  to localStorage under `storageKey`, read back in on mount — server
 *  and first client render both use the default order/collapse state
 *  passed in via `sections`, so there's no hydration mismatch; the
 *  stored preference (if any) applies a moment after mount instead. */
export default function SectionPreferencesProvider({
  storageKey,
  sections,
}: ProviderProps) {
  const defaultOrder = sections.map((s) => s.key);
  const defaultCollapsed: Record<string, boolean> = {};
  for (const s of sections) defaultCollapsed[s.key] = s.defaultCollapsed;

  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [collapsed, setCollapsed] =
    useState<Record<string, boolean>>(defaultCollapsed);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        order?: string[];
        collapsed?: Record<string, boolean>;
      };
      // Sections can change over time as features are added/removed —
      // drop any saved keys that no longer exist, and append any new
      // ones (in their default position) that the saved order predates.
      const validKeys = new Set(defaultOrder);
      const savedOrder = (saved.order ?? []).filter((k) => validKeys.has(k));
      const missingKeys = defaultOrder.filter((k) => !savedOrder.includes(k));
      setOrder([...savedOrder, ...missingKeys]);
      if (saved.collapsed) {
        setCollapsed((prev) => ({ ...prev, ...saved.collapsed }));
      }
    } catch {
      // localStorage unavailable or the saved value is corrupt — the
      // defaults already set above are a perfectly fine fallback.
    }
    // Only ever needs to run once, on mount, per storageKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function persist(nextOrder: string[], nextCollapsed: Record<string, boolean>) {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ order: nextOrder, collapsed: nextCollapsed })
      );
    } catch {
      // Private browsing / storage disabled — the preference just won't
      // survive a reload, which is a fine degradation for a UI nicety.
    }
  }

  const value: SectionPreferencesContextValue = {
    isCollapsed: (key) => collapsed[key] ?? false,
    toggleCollapsed: (key) => {
      setCollapsed((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        persist(order, next);
        return next;
      });
    },
    moveSection: (key, direction) => {
      setOrder((prev) => {
        const index = prev.indexOf(key);
        const targetIndex = index + direction;
        if (index === -1 || targetIndex < 0 || targetIndex >= prev.length) {
          return prev;
        }
        const next = [...prev];
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        persist(next, collapsed);
        return next;
      });
    },
    orderIndex: (key) => order.indexOf(key),
    sectionCount: order.length,
  };

  const nodesByKey = new Map(sections.map((s) => [s.key, s.node]));

  return (
    <SectionPreferencesContext.Provider value={value}>
      {order.map((key) => (
        <div key={key} className="mt-8">
          {nodesByKey.get(key)}
        </div>
      ))}
    </SectionPreferencesContext.Provider>
  );
}
