import type { HowItWent } from "./types";

/** Shared between the SLP-facing practice log view and the parent-facing
 *  logging form, so both sides show the exact same labels/emoji. */
export const HOW_IT_WENT_OPTIONS: { value: HowItWent; label: string; emoji: string }[] = [
  { value: "great", label: "Great", emoji: "😄" },
  { value: "okay", label: "Okay", emoji: "🙂" },
  { value: "tricky", label: "Tricky", emoji: "😕" },
];

export function getHowItWentOption(value: HowItWent) {
  return (
    HOW_IT_WENT_OPTIONS.find((o) => o.value === value) ?? HOW_IT_WENT_OPTIONS[1]
  );
}
