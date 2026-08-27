import type { Locale, Options, Step, Styles } from "react-joyride";

export type Role = "slp" | "teacher";

// ============================================================
// Step content — one array per page each side visits during the tour.
// Targets are `data-tour="..."` attributes added to the real elements
// (see each component for its own attribute) rather than text/class
// selectors, so the tour doesn't break if wording or styling changes.
// ============================================================

export function buildSlpDashboardSteps(hasStudent: boolean): Step[] {
  return [
    {
      target: '[data-tour="dashboard-students"]',
      title: "Your caseload 👋",
      content:
        "Every student you're tracking lives right here. Tap a name any time to open their page.",
    },
    {
      target: '[data-tour="dashboard-add-student"]',
      title: "Add a student",
      content:
        "Start here whenever you pick up someone new — name, class, and how often you plan to see them.",
    },
    {
      target: '[data-tour="toolkit-nav"]',
      title: "Your Toolkit",
      content: hasStudent
        ? "Build reusable goals, response formats, behavior types, and materials up here — set them up once, use them with every student."
        : "Build reusable goals, response formats, behavior types, and materials up here — set them up once, use them with every student. Add your first student above, then open their page to explore goals, sessions, and progress tracking!",
    },
  ];
}

export const SLP_STUDENT_TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="student-goals-section"]',
    title: "Set a goal",
    content:
      "Add a goal here — write one from scratch or pull from your goal bank. Each goal gets its own progress tracking.",
  },
  {
    target: '[data-tour="student-start-session"]',
    title: "Log a session",
    content:
      "Tap here to start tracking trials in real time — one tap per response, auto-saved as you go.",
  },
  {
    target: '[data-tour="student-view-progress"]',
    title: "See the progress",
    content:
      "Charts, trends, and a plain-language summary for every goal — handy for reports or a quick check-in.",
  },
  {
    target: '[data-tour="student-home-practice"]',
    title: "Bring parents in",
    content:
      "Share this student's access code here — parents can log home practice and see shared progress, no account needed.",
  },
];

export function buildTeacherDashboardSteps(hasStudent: boolean): Step[] {
  return [
    {
      target: '[data-tour="dashboard-students"]',
      title: "Your class 👋",
      content:
        "Every student you're tracking lives right here. Tap a name any time to open their page.",
    },
    {
      target: '[data-tour="dashboard-add-student"]',
      title: "Add a student",
      content:
        "Start here whenever a new student joins your caseload — name, class, and how often you plan to see them.",
    },
    {
      target: '[data-tour="toolkit-nav"]',
      title: "Your Toolkit",
      content: hasStudent
        ? "Build reusable goals, subjects, and behavior types up here — set them up once, use them with every student."
        : "Build reusable goals, subjects, and behavior types up here — set them up once, use them with every student. Add your first student above, then open their page to explore goals, sessions, and progress tracking!",
    },
  ];
}

export const TEACHER_STUDENT_TOUR_STEPS: Step[] = SLP_STUDENT_TOUR_STEPS;

// ============================================================
// Cross-page handoff — the dashboard tour's last step lives on
// /dashboard, but the next four steps live on a student's page. Since
// that's a full Next.js navigation (a fresh page, a fresh <Joyride>
// instance), the only thing that needs to survive the trip is "yes,
// pick the tour back up here" — a tiny sessionStorage flag, timestamped
// so an abandoned tour (she navigated away mid-tour, then much later
// happens to open some student page) doesn't unexpectedly resume.
// ============================================================

const PENDING_KEY = "bloomtrack:tour:pending";
const PENDING_MAX_AGE_MS = 2 * 60 * 1000;

type PendingTour = { role: Role; ts: number };

export function setPendingStudentTour(role: Role) {
  try {
    const pending: PendingTour = { role, ts: Date.now() };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // sessionStorage can throw (private browsing, blocked storage) — the
    // tour just won't resume on the next page, a harmless degradation.
  }
}

/** Consumes (removes) the pending flag and reports whether it was ours
 *  to honor — safe to call on every student-page load. */
export function consumePendingStudentTour(role: Role): boolean {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(PENDING_KEY);
    const parsed = JSON.parse(raw) as PendingTour;
    return parsed.role === role && Date.now() - parsed.ts < PENDING_MAX_AGE_MS;
  } catch {
    return false;
  }
}

// ============================================================
// Shared look & feel — brand-700 coral to match the rest of the app,
// rounded to match the card/modal language, "Skip tour" always visible
// alongside a real close (X) button that actually exits rather than
// just advancing a step.
// ============================================================

export const TOUR_OPTIONS: Partial<Options> = {
  primaryColor: "#CC3B1A", // brand-700
  textColor: "#292524", // stone-800
  backgroundColor: "#ffffff",
  arrowColor: "#ffffff",
  overlayColor: "rgba(28, 25, 23, 0.5)", // stone-900/50 — matches modal overlays elsewhere
  zIndex: 10000,
  buttons: ["skip", "back", "close", "primary"],
  closeButtonAction: "skip",
  showProgress: true,
  skipBeacon: true,
  spotlightPadding: 8,
};

export const TOUR_LOCALE: Locale = {
  back: "Back",
  close: "Close tour",
  last: "Finish",
  next: "Next",
  nextWithProgress: "Next ({current} of {total})",
  skip: "Skip tour",
};

export const TOUR_STYLES: Partial<Styles> = {
  tooltip: { borderRadius: 16, fontFamily: "inherit" },
  tooltipTitle: { fontWeight: 700, fontSize: 16, fontFamily: "inherit" },
  tooltipContent: { fontFamily: "inherit" },
  buttonPrimary: { borderRadius: 8, fontWeight: 600, fontFamily: "inherit" },
  buttonBack: { color: "#78716c", fontFamily: "inherit" },
  buttonSkip: { color: "#78716c", fontFamily: "inherit" },
};
