"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarOff,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Play,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { weekStartOf } from "@/lib/streaks";
import type {
  Countdown,
  Holiday,
  ScheduledDayTime,
  ScheduleEvent,
} from "@/lib/types";
import {
  DAY_LABELS,
  DEFAULT_DURATION_MINUTES,
  DEFAULT_EVENT_COLOR,
  addDaysToDateString,
  datesForWeekOf,
  dayOfWeekOf,
  formatFullDateLabel,
  formatHourLabel,
  formatTime12h,
  formatWeekRangeLabel,
  isWithinScheduleEndDate,
  timeToMinutes,
} from "@/lib/schedule";
import { getColorOption } from "@/lib/colors";
import AvatarBadge from "@/components/avatar-badge";
import ScheduleEventFormModal, {
  type ScheduleEventFormValues,
} from "@/components/schedule-event-form-modal";
import DeleteScheduleEventConfirmModal from "@/components/delete-schedule-event-confirm-modal";
import HolidayFormModal, {
  type HolidayFormValues,
} from "@/components/holiday-form-modal";
import DeleteHolidayConfirmModal from "@/components/delete-holiday-confirm-modal";
import HolidaysSection from "@/components/holidays-section";
import CountdownFormModal, {
  type CountdownFormValues,
} from "@/components/countdown-form-modal";
import DeleteCountdownConfirmModal from "@/components/delete-countdown-confirm-modal";
import CountdownsWidget from "@/components/countdowns-widget";

/** Side-agnostic shape ScheduleView renders from — the SLP and Teacher
 *  schedule pages each map their raw Student/TeacherStudent query
 *  results into this, same "Common..." pattern community-browse.tsx
 *  uses so this component never needs to know "students" vs
 *  "teacher_students" or "slp_id" vs "teacher_id". */
export type CommonScheduleStudent = {
  id: string;
  name: string;
  avatar: string | null;
  scheduledDays: ScheduledDayTime[];
  scheduleEndDate: string | null;
};

type Props = {
  students: CommonScheduleStudent[];
  /** "/students" or "/teacher/students" — a block links to
   *  `${studentBasePath}/${id}` and its "Start session" shortcut to
   *  `${studentBasePath}/${id}/session/new`. */
  studentBasePath: string;
  /** Server-computed today (getTodayLocalDateString()), same pattern the
   *  rest of the app already uses for an initial "today" — seeds the
   *  default view before the live clock below takes over client-side. */
  initialToday: string;
  /** Standalone events (step 3) — schedule_events is one shared table
   *  for both sides (see 0031_schedule_events.sql), so ScheduleView owns
   *  their add/edit/delete here directly (same "client component owns
   *  its own CRUD" pattern as e.g. StudentsSection) rather than each
   *  page reimplementing it. */
  initialEvents: ScheduleEvent[];
  /** Holidays (step 4) — same "one shared table, ScheduleView owns the
   *  CRUD" shape as events above (0032_holidays_and_countdowns.sql). A
   *  marked holiday shows on the Week/Day calendar (see
   *  isHoliday/holidayTitleFor below) and, via
   *  addSharedDatesToEveryStudent in src/lib/caseload.ts, protects every
   *  student's session streak that day — that half happens server-side,
   *  wherever a streak is computed, not here. */
  initialHolidays: Holiday[];
  /** Countdowns (step 4) — same shared-table CRUD shape again. Shown
   *  both here (the interactive management list) and, read-only, as a
   *  preview widget on the dashboard. */
  initialCountdowns: Countdown[];
  /** The signed-in SLP's or Teacher's own id — written into whichever of
   *  schedule_events.slp_id / teacher_id (and holidays' / countdowns')
   *  `ownerField` names. */
  ownerId: string;
  ownerField: "slp_id" | "teacher_id";
};

const PX_PER_MINUTE = 1; // 60px per hour — keeps top/height == minutes, no extra scaling math
const MIN_BLOCK_HEIGHT_PX = 24;

// The timeline always spans the full day rather than some dynamically
// computed "earliest to latest scheduled time" window — that window
// approach used to actively break scrolling (there was nothing to
// scroll *to*, since the whole schedule was already on screen) and hid
// the top hour label by starting the range mid-morning. A full day in
// a fixed-height scrolling viewport is always scrollable and never
// clips an unusually early or late session.
const RANGE_START_MINUTES = 0;
const RANGE_END_MINUTES = 24 * 60;
// A typical start-of-day to land on if, for whatever reason, "now"
// isn't a sensible target (see useAutoScrollToSensibleStart below).
const FALLBACK_SCROLL_HOUR = 8;
// Extra room the auto-scroll leaves above its target time, so the
// target doesn't land flush against the very top edge of the viewport.
const SCROLL_HEADROOM_PX = 48;
// How tall the scrolling viewport itself is — short enough that the
// page doesn't have to scroll just to see the calendar, tall enough to
// show a good chunk of the day (10+ hours) at once.
const TIMELINE_VIEWPORT_HEIGHT = 600;
// Small buffer so a label/gridline sitting exactly at the top of the
// scrollable content never gets visually clipped by the container's
// edge, and so an auto-scroll target isn't flush against the top edge.
const TOP_PADDING_PX = 6;

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type SessionBlock = {
  kind: "session";
  studentId: string;
  studentName: string;
  avatar: string | null;
  startMinutes: number;
  endMinutes: number;
  time: string;
};

type EventBlock = {
  kind: "event";
  /** The original row, kept whole (rather than flattened into its own
   *  title/note/color/time fields) so the click handler can hand it
   *  straight to ScheduleEventFormModal for editing with no separate
   *  by-id lookup. */
  event: ScheduleEvent;
  startMinutes: number;
  endMinutes: number;
};

type Block = SessionBlock | EventBlock;

/** Every block that falls on `dateStr` — one per (student, scheduled
 *  day) whose day-of-week matches and whose schedule_end_date (if any)
 *  hasn't passed as of that specific date, plus one per standalone
 *  event whose own `date` is exactly `dateStr` (events are a single
 *  occurrence, not a recurring weekly pattern like scheduled_days, so
 *  no day-of-week matching applies to them). Student blocks are
 *  evaluated fresh per date shown, not just "hide the whole student
 *  once their end date is in the past" — a week that's partly before
 *  and partly after an end date shows exactly the days that are still
 *  in range. */
function blocksForDate(
  students: CommonScheduleStudent[],
  events: ScheduleEvent[],
  dateStr: string
): Block[] {
  const dow = dayOfWeekOf(dateStr);
  const blocks: Block[] = [];
  for (const student of students) {
    for (const entry of student.scheduledDays) {
      if (entry.day !== dow) continue;
      if (!isWithinScheduleEndDate(dateStr, student.scheduleEndDate)) continue;
      const start = timeToMinutes(entry.time);
      // Falls back to the shared default only for a row saved before
      // migration 0030 added duration_minutes and somehow not yet
      // backfilled — every entry read back from the DB today carries
      // its own real value.
      const duration = entry.duration_minutes ?? DEFAULT_DURATION_MINUTES;
      blocks.push({
        kind: "session",
        studentId: student.id,
        studentName: student.name,
        avatar: student.avatar,
        startMinutes: start,
        endMinutes: start + duration,
        time: entry.time,
      });
    }
  }
  for (const event of events) {
    if (event.date !== dateStr) continue;
    const start = timeToMinutes(event.start_time);
    blocks.push({
      kind: "event",
      event,
      startMinutes: start,
      endMinutes: start + event.duration_minutes,
    });
  }
  return blocks.sort((a, b) => a.startMinutes - b.startMinutes);
}

type LanedBlock = Block & { lane: number; laneCount: number };
type LanedEventBlock = EventBlock & { lane: number; laneCount: number };

/** Simple greedy interval-graph coloring: blocks that don't overlap in
 *  time share lane 0; anything that would collide gets pushed to the
 *  next lane. Not optimal packing, but this is a caseload of a handful
 *  of students, not a company-wide room booking system — simple and
 *  correct (no visual overlap) is what matters here.
 *
 *  Each block's *width* comes from its own overlapping cluster, not the
 *  day's overall lane count — a solo 2pm block shouldn't get squeezed to
 *  half-width just because two other students overlapped at 10am. */
function assignLanes(blocks: Block[]): LanedBlock[] {
  const laneEndTimes: number[] = [];
  const withLane = blocks.map((b) => {
    let lane = laneEndTimes.findIndex((end) => end <= b.startMinutes);
    if (lane === -1) {
      lane = laneEndTimes.length;
      laneEndTimes.push(b.endMinutes);
    } else {
      laneEndTimes[lane] = b.endMinutes;
    }
    return { ...b, lane };
  });
  return withLane.map((b) => {
    const overlapping = withLane.filter(
      (other) =>
        other.startMinutes < b.endMinutes && other.endMinutes > b.startMinutes
    );
    const laneCount = Math.max(...overlapping.map((o) => o.lane)) + 1;
    return { ...b, laneCount };
  });
}

/** One scheduled-session OR standalone-event block, positioned
 *  absolutely within its column's relatively-positioned timeline.
 *  Shared by Week (compact) and Day (detailed) views via `variant`. The
 *  block itself is a div with a click/keyboard handler rather than a
 *  Link — a session block contains its own "Start session" button, and
 *  a button or link can't legally nest inside an <a>, so navigation
 *  goes through next/navigation's router instead for both; an event
 *  block has no student page to link to at all, so its click just opens
 *  its own edit form (never onOpenStudent/onStartSession — see
 *  EventBlockView below). Geometry (top/height/lane width) is identical
 *  for both kinds, computed once here and handed off to whichever
 *  renderer applies. */
function ScheduleBlock({
  block,
  rangeStart,
  variant,
  onOpenStudent,
  onStartSession,
  onOpenEvent,
}: {
  block: LanedBlock;
  rangeStart: number;
  variant: "week" | "day";
  onOpenStudent: (id: string) => void;
  onStartSession: (id: string) => void;
  onOpenEvent: (event: ScheduleEvent) => void;
}) {
  const top = (block.startMinutes - rangeStart) * PX_PER_MINUTE + TOP_PADDING_PX;
  const height = Math.max(
    MIN_BLOCK_HEIGHT_PX,
    (block.endMinutes - block.startMinutes) * PX_PER_MINUTE
  );
  const widthPct = 100 / block.laneCount;
  const leftPct = block.lane * widthPct;

  if (block.kind === "event") {
    return (
      <EventBlockView
        block={block}
        variant={variant}
        geometry={{ top, height, widthPct, leftPct }}
        onOpenEvent={onOpenEvent}
      />
    );
  }

  // A laned (overlapping) block is narrower — give its name more room
  // to breathe by letting it wrap onto a second line there, instead of
  // truncating to a sliver of the name on one line. A solo block at
  // full width usually fits comfortably on one line already.
  const nameCanWrap = block.laneCount > 1 || height >= 44;

  // An arrow function, not `function handleKeyDown() {}` — a hoisted
  // function declaration would make TS treat `block` as possibly still
  // the wider LanedBlock union inside it (hoisting means it could in
  // principle be called before the `block.kind === "event"` narrowing
  // above), so it loses the narrowing to SessionBlock this whole rest
  // of the function relies on. A const arrow function has no such
  // hoisting concern and keeps the narrowed type.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenStudent(block.studentId);
    }
  };

  if (variant === "day") {
    // A short duration (as little as 15 minutes) laned alongside other
    // students can land at MIN_BLOCK_HEIGHT_PX, too short to fit the
    // usual avatar + two-line name + time + "Start" pill without any of
    // it visibly overflowing its own block. Below this height, fall
    // back to a single condensed row — same idea as the week variant
    // already applies at its own (smaller) scale.
    const isCompact = height < 40;

    return (
      <div
        role="button"
        tabIndex={0}
        title={block.studentName}
        onClick={() => onOpenStudent(block.studentId)}
        onKeyDown={handleKeyDown}
        className={`absolute cursor-pointer overflow-hidden rounded-xl border border-accent-200 bg-accent-50 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500 ${
          isCompact ? "px-1.5 py-1" : "p-2"
        }`}
        style={{
          top,
          height,
          left: `calc(${leftPct}% + 4px)`,
          width: `calc(${widthPct}% - 8px)`,
        }}
      >
        {isCompact ? (
          <div className="flex h-full min-w-0 items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-accent-900">
              {block.studentName}
            </span>
            {block.laneCount === 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartSession(block.studentId);
                }}
                aria-label={`Start session for ${block.studentName}`}
                className="ml-auto shrink-0 rounded p-0.5 text-accent-700 hover:bg-accent-200"
              >
                <Play className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 items-start gap-2">
            <AvatarBadge avatar={block.avatar} size="sm" />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-semibold text-accent-900 ${
                  nameCanWrap ? "line-clamp-2 break-words" : "truncate"
                }`}
              >
                {block.studentName}
              </p>
              <p className="text-xs text-accent-700">
                {formatTime12h(block.time)}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartSession(block.studentId);
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent-600 px-2 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
            >
              <Play className="h-3 w-3" />
              Start
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      title={block.studentName}
      onClick={() => onOpenStudent(block.studentId)}
      onKeyDown={handleKeyDown}
      className="absolute cursor-pointer overflow-hidden rounded-lg border border-accent-200 bg-accent-50 px-1.5 py-1 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
    >
      <div className="flex min-w-0 items-start gap-1">
        {/* Three or more students sharing this slot leaves each lane too
            narrow to spare room for the avatar too — dropping it hands
            those few extra pixels back to the name, which is the more
            useful thing to read for a block already this tight. */}
        {block.laneCount < 3 && (
          <span className="shrink-0 text-xs leading-none" aria-hidden>
            {block.avatar ?? "🧑"}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 text-xs font-medium leading-tight text-accent-900 ${
            nameCanWrap ? "line-clamp-2 break-words" : "truncate"
          }`}
        >
          {block.studentName}
        </span>
        {/* A laned (overlapping) block is too narrow to also fit an icon
            button next to avatar+name — the block itself is still fully
            clickable through to the student page either way, this just
            skips the redundant, unusably-tiny extra tap target. */}
        {block.laneCount === 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartSession(block.studentId);
            }}
            aria-label={`Start session for ${block.studentName}`}
            className="ml-auto shrink-0 rounded p-0.5 text-accent-700 hover:bg-accent-200"
          >
            <Play className="h-3 w-3" />
          </button>
        )}
      </div>
      {height >= 34 && (
        <p className="truncate text-[10px] text-accent-700">
          {formatTime12h(block.time)}
        </p>
      )}
    </div>
  );
}

/** A standalone event's block — same geometry as ScheduleBlock's session
 *  rendering (computed once by the caller and handed down), but its own
 *  simpler content: a small calendar icon instead of a student avatar,
 *  no "Start session" shortcut, and colored from the event's own
 *  src/lib/colors.ts palette pick rather than the fixed teal
 *  accent-* classes every session block uses — that color difference is
 *  what makes an event visually read as "not a student session" at a
 *  glance, on top of the icon and the missing Start button. Clicking
 *  anywhere on the block (or Enter/Space) opens it for editing via
 *  onOpenEvent — deliberately never onOpenStudent/onStartSession, since
 *  an event has no student to navigate to. */
function EventBlockView({
  block,
  variant,
  geometry,
  onOpenEvent,
}: {
  block: LanedEventBlock;
  variant: "week" | "day";
  geometry: { top: number; height: number; widthPct: number; leftPct: number };
  onOpenEvent: (event: ScheduleEvent) => void;
}) {
  const { top, height, widthPct, leftPct } = geometry;
  const color = getColorOption(block.event.color ?? DEFAULT_EVENT_COLOR);
  const isDay = variant === "day";
  // Same isCompact threshold ScheduleBlock's own Day-variant session
  // rendering uses — below this height there's no room for icon + title
  // + time without any of it overflowing.
  const isDayCompact = isDay && height < 40;
  const showTime = isDay ? !isDayCompact : height >= 34;
  const nameCanWrap = isDay ? !isDayCompact : block.laneCount > 1;
  const showIcon = isDay ? !isDayCompact : block.laneCount < 3;

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenEvent(block.event);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      title={block.event.title}
      onClick={() => onOpenEvent(block.event)}
      onKeyDown={handleKeyDown}
      className={`absolute cursor-pointer overflow-hidden border text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500 ${color.badgeClass} ${color.borderClass} ${
        isDay
          ? `rounded-xl ${isDayCompact ? "px-1.5 py-1" : "p-2"}`
          : "rounded-lg px-1.5 py-1"
      }`}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + ${isDay ? 4 : 2}px)`,
        width: `calc(${widthPct}% - ${isDay ? 8 : 4}px)`,
      }}
    >
      <div className="flex min-w-0 items-start gap-1">
        {showIcon && (
          <CalendarClock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        )}
        <span
          className={`min-w-0 flex-1 font-semibold leading-tight ${
            isDay ? "text-sm" : "text-xs"
          } ${nameCanWrap ? "line-clamp-2 break-words" : "truncate"}`}
        >
          {block.event.title}
        </span>
      </div>
      {showTime && (
        <p className="truncate text-[10px] opacity-80">
          {formatTime12h(block.event.start_time)}
        </p>
      )}
    </div>
  );
}

/** The horizontal "current time" marker — only ever rendered by a
 *  caller that has already confirmed the column being drawn is today
 *  and that the live clock has ticked at least once (see ScheduleView's
 *  hydration-safety note). A plain line + dot, same weight/less visual
 *  competition than a full block since it's a marker, not content. */
function NowLine({ top }: { top: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-brand-600"
      style={{ top }}
    >
      <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-brand-600" />
    </div>
  );
}

function TimeAxis({
  hours,
  rangeStart,
  totalHeight,
}: {
  hours: number[];
  rangeStart: number;
  totalHeight: number;
}) {
  return (
    <div className="relative" style={{ height: totalHeight }}>
      {hours.map((h) => (
        <div
          key={h}
          // Top-aligned to the gridline (with a small nudge up so it
          // visually straddles the line) rather than centered on it —
          // centering an 11px label with -translate-y-1/2 pushes the
          // very first (topmost) label half above the container's own
          // top edge, where it's clipped by the scroll viewport. Top-
          // aligning instead means every label, including the first,
          // always renders fully inside the content it's positioned in.
          className="absolute right-0 -translate-y-[3px] pr-2 text-right text-[11px] text-stone-400"
          style={{ top: (h * 60 - rangeStart) * PX_PER_MINUTE + TOP_PADDING_PX }}
        >
          {formatHourLabel(h)}
        </div>
      ))}
    </div>
  );
}

function HourGridlines({
  hours,
  rangeStart,
}: {
  hours: number[];
  rangeStart: number;
}) {
  return (
    <>
      {hours.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-stone-100"
          style={{ top: (h * 60 - rangeStart) * PX_PER_MINUTE + TOP_PADDING_PX }}
        />
      ))}
    </>
  );
}

/** Scrolls `ref`'s element to a sensible starting position the moment
 *  it mounts: the current time of day if that falls within the visible
 *  range, else FALLBACK_SCROLL_HOUR. Reads `new Date()` directly rather
 *  than through ScheduleView's `nowMinutes` state — effects run bottom-
 *  up on mount, so a child's own mount effect fires before the parent's
 *  tick() effect has had a chance to populate `nowMinutes`, which would
 *  make this always see it as still `null` and fall back to 8am even
 *  when opened at, say, 2pm. Reading the clock here directly sidesteps
 *  that ordering entirely — it's still a client-only read (effects never
 *  run during server rendering or hydration), so this carries none of
 *  the hydration-mismatch risk `nowMinutes` was designed around. Runs
 *  once per mount only (not on every prop change) so paging between
 *  weeks/days with Prev/Next doesn't keep yanking the scroll position
 *  back — only switching Week/Day view (which mounts a fresh instance)
 *  or first loading the page re-triggers it. */
function useAutoScrollToSensibleStart(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes =
      nowMinutes >= RANGE_START_MINUTES && nowMinutes <= RANGE_END_MINUTES
        ? nowMinutes
        : FALLBACK_SCROLL_HOUR * 60;
    el.scrollTop = Math.max(
      0,
      (targetMinutes - RANGE_START_MINUTES) * PX_PER_MINUTE +
        TOP_PADDING_PX -
        SCROLL_HEADROOM_PX
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only, see comment above
  }, []);
}

function WeekGrid({
  dates,
  students,
  events,
  holidaysByDate,
  rangeStart,
  rangeEnd,
  hours,
  totalHeight,
  todayDateStr,
  nowMinutes,
  onOpenStudent,
  onStartSession,
  onOpenEvent,
  onOpenDay,
}: {
  dates: string[];
  students: CommonScheduleStudent[];
  events: ScheduleEvent[];
  /** date -> holiday title, for the badge tooltip and to know which day
   *  columns get the holiday tint. */
  holidaysByDate: Map<string, string>;
  rangeStart: number;
  rangeEnd: number;
  hours: number[];
  totalHeight: number;
  todayDateStr: string;
  nowMinutes: number | null;
  onOpenStudent: (id: string) => void;
  onStartSession: (id: string) => void;
  onOpenEvent: (event: ScheduleEvent) => void;
  onOpenDay: (date: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useAutoScrollToSensibleStart(scrollRef);

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-stone-200">
          <div />
          {dates.map((date) => {
            const isToday = date === todayDateStr;
            const holidayTitle = holidaysByDate.get(date);
            const d = new Date(`${date}T00:00:00`);
            return (
              <button
                key={date}
                type="button"
                onClick={() => onOpenDay(date)}
                title={holidayTitle}
                className={`flex flex-col items-center gap-0.5 border-l border-stone-200 py-2.5 transition-colors hover:bg-cream-50 ${
                  holidayTitle ? "bg-amber-50" : ""
                }`}
              >
                <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                  {DAY_LABELS[dayOfWeekOf(date)]}
                </span>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday ? "bg-brand-700 text-white" : "text-stone-700"
                  }`}
                >
                  {d.getDate()}
                </span>
                {holidayTitle && (
                  <span className="flex items-center gap-0.5 truncate px-1 text-[10px] font-medium text-amber-700">
                    <CalendarOff className="h-2.5 w-2.5 shrink-0" aria-hidden />
                    <span className="truncate">{holidayTitle}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* The day-header row above stays put; only this body scrolls
            vertically. It's a separate overflow-y-auto container nested
            inside the outer overflow-x-auto one so horizontal scrolling
            still moves the header and body together, while vertical
            scrolling is confined to the timeline itself. */}
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: TIMELINE_VIEWPORT_HEIGHT }}
        >
          <div className="grid grid-cols-[56px_repeat(7,1fr)]">
            <TimeAxis hours={hours} rangeStart={rangeStart} totalHeight={totalHeight} />

            {dates.map((date) => {
              const laned = assignLanes(blocksForDate(students, events, date));
              const isToday = date === todayDateStr;
              const isHoliday = holidaysByDate.has(date);
              const showNow =
                isToday &&
                nowMinutes !== null &&
                nowMinutes >= rangeStart &&
                nowMinutes <= rangeEnd;
              return (
                <div
                  key={date}
                  className={`relative border-l border-stone-200 ${
                    isHoliday ? "bg-amber-50/60" : ""
                  }`}
                  style={{ height: totalHeight }}
                >
                  <HourGridlines hours={hours} rangeStart={rangeStart} />
                  {showNow && (
                    <NowLine
                      top={(nowMinutes! - rangeStart) * PX_PER_MINUTE + TOP_PADDING_PX}
                    />
                  )}
                  {laned.map((block) => (
                    <ScheduleBlock
                      key={
                        block.kind === "session"
                          ? `session-${block.studentId}-${block.time}`
                          : `event-${block.event.id}`
                      }
                      block={block}
                      rangeStart={rangeStart}
                      variant="week"
                      onOpenStudent={onOpenStudent}
                      onStartSession={onStartSession}
                      onOpenEvent={onOpenEvent}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayTimeline({
  date,
  students,
  events,
  holidaysByDate,
  rangeStart,
  rangeEnd,
  hours,
  totalHeight,
  isToday,
  nowMinutes,
  onOpenStudent,
  onStartSession,
  onOpenEvent,
}: {
  date: string;
  students: CommonScheduleStudent[];
  events: ScheduleEvent[];
  holidaysByDate: Map<string, string>;
  rangeStart: number;
  rangeEnd: number;
  hours: number[];
  totalHeight: number;
  isToday: boolean;
  nowMinutes: number | null;
  onOpenStudent: (id: string) => void;
  onStartSession: (id: string) => void;
  onOpenEvent: (event: ScheduleEvent) => void;
}) {
  const laned = assignLanes(blocksForDate(students, events, date));
  const showNow =
    isToday && nowMinutes !== null && nowMinutes >= rangeStart && nowMinutes <= rangeEnd;
  const scrollRef = useRef<HTMLDivElement>(null);
  useAutoScrollToSensibleStart(scrollRef);
  const holidayTitle = holidaysByDate.get(date);

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
      {holidayTitle && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
          <CalendarOff className="h-4 w-4 shrink-0" aria-hidden />
          {holidayTitle} — no sessions expected today
        </div>
      )}
      <div
        ref={scrollRef}
        className={`min-w-[420px] overflow-y-auto ${holidayTitle ? "bg-amber-50/40" : ""}`}
        style={{ maxHeight: TIMELINE_VIEWPORT_HEIGHT }}
      >
        <div className="grid grid-cols-[64px_1fr]">
          <TimeAxis hours={hours} rangeStart={rangeStart} totalHeight={totalHeight} />
          <div className="relative border-l border-stone-200" style={{ height: totalHeight }}>
            <HourGridlines hours={hours} rangeStart={rangeStart} />
            {showNow && (
              <NowLine top={(nowMinutes! - rangeStart) * PX_PER_MINUTE + TOP_PADDING_PX} />
            )}
            {laned.length === 0 ? (
              <p className="absolute inset-x-0 top-6 text-center text-sm text-stone-400">
                Nothing scheduled this day.
              </p>
            ) : (
              laned.map((block) => (
                <ScheduleBlock
                  key={
                    block.kind === "session"
                      ? `session-${block.studentId}-${block.time}`
                      : `event-${block.event.id}`
                  }
                  block={block}
                  rangeStart={rangeStart}
                  variant="day"
                  onOpenStudent={onOpenStudent}
                  onStartSession={onStartSession}
                  onOpenEvent={onOpenEvent}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleView({
  students,
  studentBasePath,
  initialToday,
  initialEvents,
  initialHolidays,
  initialCountdowns,
  ownerId,
  ownerField,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<"week" | "day">("week");
  const [anchorDate, setAnchorDate] = useState(initialToday);
  const [todayDateStr, setTodayDateStr] = useState(initialToday);
  // null until the first client-side tick — see the hydration note below.
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  // Standalone events (step 3) — same "client component owns its own
  // CRUD against a shared table" pattern as StudentsSection/
  // AttendanceSection, just living here instead of a dedicated section
  // component since the Schedule page has only the one section.
  const [events, setEvents] = useState<ScheduleEvent[]>(initialEvents);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<ScheduleEvent | null>(
    null
  );

  async function handleAddEvent(values: ScheduleEventFormValues) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("schedule_events")
      .insert({
        [ownerField]: ownerId,
        title: values.title,
        date: values.date,
        start_time: values.startTime,
        duration_minutes: values.durationMinutes,
        note: values.note,
        color: values.color,
      })
      .select("id, title, date, start_time, duration_minutes, note, color, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setEvents((prev) => [...prev, data]);
    setShowAddEventModal(false);
    return null;
  }

  async function handleEditEvent(values: ScheduleEventFormValues) {
    if (!editingEvent) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("schedule_events")
      .update({
        title: values.title,
        date: values.date,
        start_time: values.startTime,
        duration_minutes: values.durationMinutes,
        note: values.note,
        color: values.color,
      })
      .eq("id", editingEvent.id)
      .select("id, title, date, start_time, duration_minutes, note, color, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setEvents((prev) => prev.map((e) => (e.id === data.id ? data : e)));
    setEditingEvent(null);
    return null;
  }

  async function handleDeleteEvent() {
    if (!deletingEvent) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("schedule_events")
      .delete()
      .eq("id", deletingEvent.id);

    if (error) {
      return error.message;
    }

    setEvents((prev) => prev.filter((e) => e.id !== deletingEvent.id));
    setDeletingEvent(null);
    return null;
  }

  // Holidays (step 4) — same CRUD-owning shape as events above.
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [showAddHolidayModal, setShowAddHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);

  async function handleAddHoliday(values: HolidayFormValues) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("holidays")
      .insert({ [ownerField]: ownerId, title: values.title, date: values.date })
      .select("id, title, date, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setHolidays((prev) => [...prev, data]);
    setShowAddHolidayModal(false);
    return null;
  }

  async function handleEditHoliday(values: HolidayFormValues) {
    if (!editingHoliday) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("holidays")
      .update({ title: values.title, date: values.date })
      .eq("id", editingHoliday.id)
      .select("id, title, date, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setHolidays((prev) => prev.map((h) => (h.id === data.id ? data : h)));
    setEditingHoliday(null);
    return null;
  }

  async function handleDeleteHoliday() {
    if (!deletingHoliday) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("holidays")
      .delete()
      .eq("id", deletingHoliday.id);

    if (error) {
      return error.message;
    }

    setHolidays((prev) => prev.filter((h) => h.id !== deletingHoliday.id));
    setDeletingHoliday(null);
    return null;
  }

  // date -> title, for the calendar's holiday tint/badge (WeekGrid/
  // DayTimeline) — computed once here rather than by every callee.
  const holidaysByDate = useMemo(
    () => new Map(holidays.map((h) => [h.date, h.title])),
    [holidays]
  );

  // Countdowns (step 4) — same CRUD-owning shape again.
  const [countdowns, setCountdowns] = useState<Countdown[]>(initialCountdowns);
  const [showAddCountdownModal, setShowAddCountdownModal] = useState(false);
  const [editingCountdown, setEditingCountdown] = useState<Countdown | null>(
    null
  );
  const [deletingCountdown, setDeletingCountdown] = useState<Countdown | null>(
    null
  );

  async function handleAddCountdown(values: CountdownFormValues) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("countdowns")
      .insert({
        [ownerField]: ownerId,
        title: values.title,
        target_date: values.targetDate,
      })
      .select("id, title, target_date, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setCountdowns((prev) => [...prev, data]);
    setShowAddCountdownModal(false);
    return null;
  }

  async function handleEditCountdown(values: CountdownFormValues) {
    if (!editingCountdown) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("countdowns")
      .update({ title: values.title, target_date: values.targetDate })
      .eq("id", editingCountdown.id)
      .select("id, title, target_date, created_at")
      .single();

    if (error || !data) {
      return error?.message ?? "Something went wrong. Please try again.";
    }

    setCountdowns((prev) => prev.map((c) => (c.id === data.id ? data : c)));
    setEditingCountdown(null);
    return null;
  }

  async function handleDeleteCountdown() {
    if (!deletingCountdown) return null;

    const supabase = createClient();
    const { error } = await supabase
      .from("countdowns")
      .delete()
      .eq("id", deletingCountdown.id);

    if (error) {
      return error.message;
    }

    setCountdowns((prev) => prev.filter((c) => c.id !== deletingCountdown.id));
    setDeletingCountdown(null);
    return null;
  }

  // The live "now" line: ticks every 30s via the browser's own clock,
  // not the server's. A full real-time (per-second) line would be
  // overkill for a scheduling overview and just churns re-renders for
  // no visible benefit at this granularity; 30s keeps it visually live
  // without that cost. nowMinutes starts as `null` (rather than reading
  // `new Date()` in the initial render) specifically so the server-
  // rendered HTML and the client's first render match exactly — the
  // server has no meaningful "current wall-clock time" for whoever is
  // about to view the page, so computing it during render would risk a
  // hydration mismatch. The effect below fills it in immediately after
  // mount instead, which is a normal post-hydration state update, not a
  // mismatch. todayDateStr, by contrast, starts from the `initialToday`
  // server prop, which the client's first render reads unchanged too --
  // safe to show immediately, and then this same effect keeps it correct
  // if the page is left open across midnight.
  useEffect(() => {
    function tick() {
      const now = new Date();
      setTodayDateStr(toLocalDateStr(now));
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const hasAnythingToShow = useMemo(
    () =>
      students.some((s) => s.scheduledDays.length > 0) ||
      events.length > 0 ||
      holidays.length > 0,
    [students, events, holidays]
  );

  // Fixed full-day range (see the constants' own comments) rather than
  // a window computed from students' scheduled times — that dynamic
  // window used to just show whatever fit, with nothing left to scroll
  // to. rangeStart/rangeEnd are still threaded through as props (rather
  // than every callee reaching for the module constants directly) so
  // this is the one place that would need to change if that ever
  // becomes configurable again.
  const rangeStart = RANGE_START_MINUTES;
  const rangeEnd = RANGE_END_MINUTES;

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = Math.floor(rangeStart / 60); h < Math.ceil(rangeEnd / 60); h++) {
      list.push(h);
    }
    return list;
  }, [rangeStart, rangeEnd]);

  const totalHeight = (rangeEnd - rangeStart) * PX_PER_MINUTE;
  const weekDates = useMemo(() => datesForWeekOf(anchorDate), [anchorDate]);

  function goPrev() {
    setAnchorDate((d) => addDaysToDateString(d, view === "week" ? -7 : -1));
  }
  function goNext() {
    setAnchorDate((d) => addDaysToDateString(d, view === "week" ? 7 : 1));
  }
  function goToday() {
    setAnchorDate(todayDateStr);
  }
  function studentHref(id: string) {
    return `${studentBasePath}/${id}`;
  }
  function sessionHref(id: string) {
    return `${studentBasePath}/${id}/session/new`;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={goPrev}
            aria-label={view === "week" ? "Previous week" : "Previous day"}
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-cream-100"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label={view === "week" ? "Next week" : "Next day"}
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-1.5 text-sm font-semibold text-stone-900 sm:text-base">
            {view === "week"
              ? formatWeekRangeLabel(weekStartOf(anchorDate))
              : formatFullDateLabel(anchorDate)}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddEventModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Add event
          </button>
          <div className="inline-flex rounded-lg border border-stone-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("week")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "week"
                  ? "bg-brand-700 text-white"
                  : "text-stone-600 hover:bg-cream-100"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView("day")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "day"
                  ? "bg-brand-700 text-white"
                  : "text-stone-600 hover:bg-cream-100"
              }`}
            >
              Day
            </button>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-stone-400">
        Showing the full day — scroll within the timeline to see earlier
        or later hours.
      </p>

      {!hasAnythingToShow ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100">
            <CalendarX2 className="h-6 w-6 text-accent-600" />
          </div>
          <p className="text-stone-500">
            Nothing scheduled yet — add scheduled days from a student&apos;s
            edit form, or add a standalone event above, to see them here.
          </p>
        </div>
      ) : view === "week" ? (
        <WeekGrid
          dates={weekDates}
          students={students}
          events={events}
          holidaysByDate={holidaysByDate}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          hours={hours}
          totalHeight={totalHeight}
          todayDateStr={todayDateStr}
          nowMinutes={nowMinutes}
          onOpenStudent={(id) => router.push(studentHref(id))}
          onStartSession={(id) => router.push(sessionHref(id))}
          onOpenEvent={(event) => setEditingEvent(event)}
          onOpenDay={(d) => {
            setAnchorDate(d);
            setView("day");
          }}
        />
      ) : (
        <DayTimeline
          date={anchorDate}
          students={students}
          events={events}
          holidaysByDate={holidaysByDate}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          hours={hours}
          totalHeight={totalHeight}
          isToday={anchorDate === todayDateStr}
          nowMinutes={nowMinutes}
          onOpenStudent={(id) => router.push(studentHref(id))}
          onStartSession={(id) => router.push(sessionHref(id))}
          onOpenEvent={(event) => setEditingEvent(event)}
        />
      )}

      <HolidaysSection
        holidays={holidays}
        onAdd={() => setShowAddHolidayModal(true)}
        onEdit={(holiday) => setEditingHoliday(holiday)}
      />

      <div className="mt-4">
        <CountdownsWidget
          countdowns={countdowns}
          today={todayDateStr}
          onAdd={() => setShowAddCountdownModal(true)}
          onEdit={(countdown) => setEditingCountdown(countdown)}
        />
      </div>

      {showAddEventModal && (
        <ScheduleEventFormModal
          mode="add"
          initialDate={anchorDate}
          onCancel={() => setShowAddEventModal(false)}
          onSubmit={handleAddEvent}
        />
      )}

      {editingEvent && (
        <ScheduleEventFormModal
          mode="edit"
          initialEvent={editingEvent}
          initialDate={anchorDate}
          onCancel={() => setEditingEvent(null)}
          onSubmit={handleEditEvent}
          onDelete={() => {
            setDeletingEvent(editingEvent);
            setEditingEvent(null);
          }}
        />
      )}

      {deletingEvent && (
        <DeleteScheduleEventConfirmModal
          event={deletingEvent}
          onCancel={() => setDeletingEvent(null)}
          onConfirm={handleDeleteEvent}
        />
      )}

      {showAddHolidayModal && (
        <HolidayFormModal
          mode="add"
          onCancel={() => setShowAddHolidayModal(false)}
          onSubmit={handleAddHoliday}
        />
      )}

      {editingHoliday && (
        <HolidayFormModal
          mode="edit"
          initialHoliday={editingHoliday}
          onCancel={() => setEditingHoliday(null)}
          onSubmit={handleEditHoliday}
          onDelete={() => {
            setDeletingHoliday(editingHoliday);
            setEditingHoliday(null);
          }}
        />
      )}

      {deletingHoliday && (
        <DeleteHolidayConfirmModal
          holiday={deletingHoliday}
          onCancel={() => setDeletingHoliday(null)}
          onConfirm={handleDeleteHoliday}
        />
      )}

      {showAddCountdownModal && (
        <CountdownFormModal
          mode="add"
          onCancel={() => setShowAddCountdownModal(false)}
          onSubmit={handleAddCountdown}
        />
      )}

      {editingCountdown && (
        <CountdownFormModal
          mode="edit"
          initialCountdown={editingCountdown}
          onCancel={() => setEditingCountdown(null)}
          onSubmit={handleEditCountdown}
          onDelete={() => {
            setDeletingCountdown(editingCountdown);
            setEditingCountdown(null);
          }}
        />
      )}

      {deletingCountdown && (
        <DeleteCountdownConfirmModal
          countdown={deletingCountdown}
          onCancel={() => setDeletingCountdown(null)}
          onConfirm={handleDeleteCountdown}
        />
      )}
    </div>
  );
}
