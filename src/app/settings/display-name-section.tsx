"use client";

import { useState } from "react";
import { CheckCircle2, UserCircle2 } from "lucide-react";
import DisplayNameForm from "@/components/display-name-form";

type Props = {
  initialDisplayName: string;
};

/** Thin client wrapper around DisplayNameForm for the settings page: adds
 *  the section framing and a brief "Saved" confirmation, since this form
 *  is also reused bare (no confirmation, just closes) inside
 *  SetDisplayNameModal. */
export default function DisplayNameSection({ initialDisplayName }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [justSaved, setJustSaved] = useState(false);

  function handleSaved(name: string) {
    setDisplayName(name);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
        <UserCircle2 className="h-5 w-5 text-brand-500" />
        Display name
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        Used for community sharing — when you mark a goal, response format,
        or material as &quot;Shared&quot;, this is the name it&apos;s
        credited to. Nothing is browsable by others yet, but this is
        already saved for when it launches.
      </p>

      {displayName && (
        <p className="mt-3 text-sm text-stone-500">
          Currently set to <span className="font-medium text-stone-700">{displayName}</span>.
        </p>
      )}

      <div className="mt-4">
        <DisplayNameForm initialValue={displayName} onSaved={handleSaved} />
      </div>

      {justSaved && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-accent-700">
          <CheckCircle2 className="h-4 w-4" />
          Saved.
        </p>
      )}
    </div>
  );
}
