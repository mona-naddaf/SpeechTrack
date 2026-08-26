"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  studentId: string;
  initialShared: boolean;
};

// Optimistic — flips the checkbox immediately, then persists in the
// background and rolls back with an inline error if the save fails.
// Same pattern as the per-goal "Show progress to parent" toggle, and the
// Teacher-side ShareBehaviorToggle this mirrors.
export default function ShareBehaviorToggle({
  studentId,
  initialShared,
}: Props) {
  const [shared, setShared] = useState(initialShared);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const nextValue = !shared;
    setShared(nextValue);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("students")
      .update({ share_behavior_with_parent: nextValue })
      .eq("id", studentId);

    if (updateError) {
      setShared(!nextValue);
      setError(updateError.message);
    }
  }

  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-medium text-stone-500">
        <input
          type="checkbox"
          checked={shared}
          onChange={handleToggle}
          className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
        />
        Show behavior summary to parent
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
