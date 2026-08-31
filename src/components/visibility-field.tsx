"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SetDisplayNameModal from "./set-display-name-modal";

export type VisibilityFieldOption<V extends string> = {
  value: V;
  label: string;
  /** Shown disabled with a "Coming soon" pill — for Materials' "for_sale",
   *  a future phase that isn't selectable yet. */
  comingSoon?: boolean;
};

type Props<V extends string> = {
  value: V;
  onChange: (value: V) => void;
  options: VisibilityFieldOption<V>[];
  /** Which option value needs a display name set first — always "shared"
   *  everywhere this is used. */
  gatedValue: V;
};

/** The "Private / Shared[ / For sale]" radio group used on the Goals,
 *  Response formats, and Materials forms (both SLP and Teacher sides —
 *  it's generic over the option value type so it works for
 *  MaterialVisibility's 3 options as well as the plain 2-option
 *  ShareVisibility used everywhere else). Picking the gated option first
 *  checks whether a display name is set (auth user_metadata.display_name)
 *  and, if not, opens SetDisplayNameModal instead of applying the change —
 *  a shared item needs an author credit. */
export default function VisibilityField<V extends string>({
  value,
  onChange,
  options,
  gatedValue,
}: Props<V>) {
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  async function handleSelect(option: VisibilityFieldOption<V>) {
    if (option.comingSoon) return;

    if (option.value === gatedValue) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const displayName =
        typeof user?.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name.trim()
          : "";
      if (!displayName) {
        setShowNamePrompt(true);
        return;
      }
    }

    onChange(option.value);
  }

  return (
    <div>
      <span className="block text-sm font-medium text-stone-700">
        Visibility
      </span>
      <div className="mt-1 space-y-1.5 text-sm">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex items-center gap-1.5 ${
              option.comingSoon
                ? "cursor-not-allowed text-stone-400"
                : "cursor-pointer text-stone-600"
            }`}
          >
            <input
              type="radio"
              name="visibility-field"
              checked={value === option.value}
              disabled={option.comingSoon}
              onChange={() => handleSelect(option)}
            />
            {option.label}
            {option.comingSoon && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-400">
                Coming soon
              </span>
            )}
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-stone-400">
        Shared items aren&apos;t browsable by anyone yet — this just marks it
        ready for when that launches.
      </p>

      {showNamePrompt && (
        <SetDisplayNameModal
          onCancel={() => setShowNamePrompt(false)}
          onSaved={() => {
            setShowNamePrompt(false);
            onChange(gatedValue);
          }}
        />
      )}
    </div>
  );
}
