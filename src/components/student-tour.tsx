"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  consumePendingStudentTour,
  type Role,
} from "@/lib/onboarding-tour";

type Props = {
  role: Role;
  steps: Step[];
};

/** Picks the onboarding tour back up on a student's page — but only
 *  when <DashboardTour/> just handed off here (see
 *  consumePendingStudentTour). A normal visit to any student's page
 *  renders nothing. */
export default function StudentTour({ role, steps }: Props) {
  const router = useRouter();
  const [run, setRun] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    if (consumePendingStudentTour(role)) {
      setRun(true);
    }
  }, [role]);

  async function finishTour() {
    setRun(false);
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { has_seen_tour: true } });
    router.refresh();
  }

  function handleEvent(data: EventData, controls: Controls) {
    if (data.type === EVENTS.TARGET_NOT_FOUND) {
      controls.next();
      return;
    }
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      finishTour();
    }
  }

  if (!run) return null;

  return (
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
  );
}
