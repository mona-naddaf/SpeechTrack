import { BookmarkPlus, Check, ChevronDown, ChevronUp, Lock, Pause } from "lucide-react";
import type { GoalStatus } from "@/lib/types";

export type TrackLadderStep = {
  id: string;
  text: string;
  status: GoalStatus;
  step_order: number;
};

type Props = {
  trackName: string;
  steps: TrackLadderStep[];
  onStepClick: (stepId: string) => void;
  onReorder: (stepId: string, direction: "up" | "down") => void;
  /** Omit to hide the "Save as template" action entirely. */
  onSaveAsTemplate?: () => void;
};

const NODE_CLASSES: Record<GoalStatus, string> = {
  mastered: "bg-accent-500 text-white ring-4 ring-accent-100",
  active: "bg-brand-500 text-white ring-4 ring-brand-100",
  on_hold: "bg-amber-400 text-white ring-4 ring-amber-100",
  queued: "bg-stone-200 text-stone-400",
};

function StepNode({ status }: { status: GoalStatus }) {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${NODE_CLASSES[status]} ${
        status === "active" ? "animate-pulse" : ""
      }`}
    >
      {status === "mastered" && <Check className="h-4 w-4" strokeWidth={3} />}
      {status === "on_hold" && <Pause className="h-3.5 w-3.5" />}
      {status === "queued" && <Lock className="h-3.5 w-3.5" />}
      {status === "active" && (
        <span className="h-2.5 w-2.5 rounded-full bg-white" />
      )}
    </div>
  );
}

const TEXT_CLASSES: Record<GoalStatus, string> = {
  mastered: "text-stone-500 line-through decoration-stone-300",
  active: "font-medium text-stone-900",
  on_hold: "text-stone-500",
  queued: "text-stone-400",
};

/** A student's treatment-plan track, drawn as a vertical connected ladder
 *  of steps rather than a grid of identical goal cards — mastered steps
 *  filled/checked, the current step highlighted, and steps still waiting
 *  their turn shown locked/greyed. Clicking a step opens the same edit
 *  modal a normal goal card's "Edit" button does; the up/down arrows swap
 *  step_order with the adjacent step (goals-section.tsx's
 *  handleReorderStep — status is never touched by a reorder). */
export default function TrackLadder({
  trackName,
  steps,
  onStepClick,
  onReorder,
  onSaveAsTemplate,
}: Props) {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  const masteredCount = sorted.filter((s) => s.status === "mastered").length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-stone-900">{trackName}</h3>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
            {masteredCount}/{sorted.length} mastered
          </span>
          {onSaveAsTemplate && (
            <button
              type="button"
              onClick={onSaveAsTemplate}
              title="Save this track's step sequence as a reusable template"
              className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-brand-700"
            >
              <BookmarkPlus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        {sorted.map((step, i) => {
          const isLast = i === sorted.length - 1;
          return (
            <div key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepNode status={step.status} />
                {!isLast && (
                  <div
                    className={`my-0.5 w-0.5 flex-1 rounded ${
                      step.status === "mastered" ? "bg-accent-300" : "bg-stone-200"
                    }`}
                  />
                )}
              </div>

              <div
                className={`flex flex-1 items-start justify-between gap-2 ${isLast ? "" : "pb-4"}`}
              >
                <button
                  type="button"
                  onClick={() => onStepClick(step.id)}
                  className={`flex-1 rounded-lg py-1 text-left text-sm transition-colors hover:text-brand-700 ${TEXT_CLASSES[step.status]}`}
                >
                  {step.text}
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onReorder(step.id, "up")}
                    disabled={i === 0}
                    aria-label="Move step earlier"
                    className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReorder(step.id, "down")}
                    disabled={isLast}
                    aria-label="Move step later"
                    className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
