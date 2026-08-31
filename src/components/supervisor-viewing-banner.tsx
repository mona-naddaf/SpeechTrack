import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";

type Props = {
  memberName: string;
  /** Where "Back to dashboard" goes — always the supervisor's own
   *  dashboard, regardless of how deep into a member's pages this
   *  banner is rendered. */
  backHref?: string;
};

/** Persistent, impossible-to-miss reminder that a supervisor is looking
 *  at someone else's account, not their own — rendered at the top of
 *  every page under /supervisor/members/[id]/.... Pure display, no
 *  Supabase calls. */
export default function SupervisorViewingBanner({
  memberName,
  backHref = "/supervisor/dashboard",
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-indigo-900">
        <Eye className="h-4 w-4 shrink-0" />
        Viewing {memberName}&apos;s account (read-only)
      </p>
      <Link
        href={backHref}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>
    </div>
  );
}
