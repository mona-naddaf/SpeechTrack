"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import {
  EVENTS,
  Joyride,
  STATUS,
  type Controls,
  type EventData,
  type Step,
} from "react-joyride";
import { createClient } from "@/lib/supabase/client";
import {
  TOUR_LOCALE,
  TOUR_OPTIONS,
  TOUR_STYLES,
  setPendingStudentTour,
  type Role,
} from "@/lib/onboarding-tour";

type Props = {
  role: Role;
  steps: Step[];
  /** True the first time a brand-new account (or anyone who hasn't seen
   *  it yet) reaches the dashboard — see user_metadata.has_seen_tour. */
  autoStart: boolean;
  /** Where the tour continues after these dashboard steps — the first
   *  student's page — or null when there's no student yet, in which
   *  case the tour just ends after the dashboard steps. */
  continueHref: string | null;
};

/** Renders both the always-visible "Take the tour" link and the tour
 *  overlay itself (Joyride portals its own UI, so this can live
 *  anywhere in the page). Auto-starts once for a fresh account; replays
 *  any time via the link. On finishing its last step it hands off to
 *  <StudentTour/> on the first student's page when one exists. */
export default function DashboardTour({
  role,
  steps,
  autoStart,
  continueHref,
}: Props) {
  const router = useRouter();
  const [run, setRun] = useState(false);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (autoStart && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setRun(true);
    }
  }, [autoStart]);

  async function finishTour() {
    setRun(false);
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { has_seen_tour: true } });
    router.refresh();
  }

  function handleEvent(data: EventData, controls: Controls) {
    // A target that isn't on the page (unexpected DOM, slow render,
    // whatever) shouldn't stall or error the tour — just move on.
    if (data.type === EVENTS.TARGET_NOT_FOUND) {
      controls.next();
      return;
    }

    if (data.status === STATUS.FINISHED) {
      if (continueHref) {
        setPendingStudentTour(role);
        setRun(false);
        router.push(continueHref);
        return;
      }
      finishTour();
      return;
    }

    if (data.status === STATUS.SKIPPED) {
      finishTour();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setRun(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-brand-800"
      >
        <Compass className="h-4 w-4" />
        Take the tour
      </button>
      <Joyride
        run={run}
        steps={steps}
        continuous
        scrollToFirstStep
        options={TOUR_OPTIONS}
        styles={TOUR_STYLES}
        locale={TOUR_LOCALE}
        onEvent={handleEvent}
      />
    </>
  );
}
