import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Library,
  ListTree,
  Sliders,
  Smile,
  Target,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ReinforcementBoard } from "@/lib/types";
import ReinforcementBoardsList from "./reinforcement-boards-list";

export default async function ReinforcementBoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: boards, error } = await supabase
    .from("reinforcement_boards")
    .select("id, slp_id, name, type, step_count, config, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="flex-1 bg-cream-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/toolkit/assessments"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ClipboardList className="h-4 w-4" />
              Assessments
            </Link>
            <Link
              href="/toolkit/goals"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Target className="h-4 w-4" />
              Goal bank
            </Link>
            <Link
              href="/toolkit/formats"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Sliders className="h-4 w-4" />
              Response formats
            </Link>
            <Link
              href="/toolkit/behavior-types"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Smile className="h-4 w-4" />
              Behavior types
            </Link>
            <Link
              href="/toolkit/materials"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Library className="h-4 w-4" />
              Materials
            </Link>
            <Link
              href="/toolkit/track-templates"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <ListTree className="h-4 w-4" />
              Track templates
            </Link>
            <Link
              href="/toolkit/community"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
            >
              <Users className="h-4 w-4" />
              Community
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-stone-900">
            Reinforcement bank
          </h1>
          <p className="mt-1 text-stone-600">
            Fun mini-game animations to reward a child during live
            sessions. Build a board once here, then tap through it to
            preview and test — session integration is coming later.
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Couldn&apos;t load reinforcement boards: {error.message}
          </p>
        )}

        <div className="mt-6">
          <ReinforcementBoardsList
            initialBoards={(boards ?? []) as ReinforcementBoard[]}
          />
        </div>
      </div>
    </main>
  );
}
