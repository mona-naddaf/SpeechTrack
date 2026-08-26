import { User } from "lucide-react";

type Props = {
  avatar: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-8 w-8 text-base",
  md: "h-10 w-10 text-lg",
  lg: "h-12 w-12 text-2xl",
};

const ICON_SIZE_CLASSES: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

/** A student's avatar — their chosen emoji (src/lib/avatar.ts) in a
 *  colored circle, or a neutral person-icon placeholder if they haven't
 *  picked one. Shared by the dashboard list, student page header, and
 *  session page on both the SLP and Teacher sides, so the fallback stays
 *  identical everywhere. */
export default function AvatarBadge({ avatar, size = "md", className }: Props) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent-100 ${SIZE_CLASSES[size]} ${className ?? ""}`}
    >
      {avatar ? (
        <span aria-hidden>{avatar}</span>
      ) : (
        <User className={`${ICON_SIZE_CLASSES[size]} text-accent-700`} />
      )}
    </div>
  );
}
