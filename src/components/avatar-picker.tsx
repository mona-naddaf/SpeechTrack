import { AVATAR_EMOJI_OPTIONS } from "@/lib/avatar";

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
};

/** A small grid of curated emoji (src/lib/avatar.ts) for the optional
 *  student avatar — not a full system emoji picker. Selecting the
 *  already-chosen one clears it back to "no avatar". */
export default function AvatarPicker({ value, onChange }: Props) {
  return (
    <div>
      <span className="block text-sm font-medium text-stone-700">
        Avatar <span className="text-stone-400">(optional)</span>
      </span>
      <div className="mt-2 grid grid-cols-7 gap-1.5 sm:grid-cols-10">
        {AVATAR_EMOJI_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(value === emoji ? null : emoji)}
            aria-label={emoji}
            aria-pressed={value === emoji}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all ${
              value === emoji
                ? "bg-accent-100 ring-2 ring-accent-500"
                : "hover:bg-cream-100"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
