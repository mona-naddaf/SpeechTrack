import { formatDate } from "./date";
import type {
  CueingLevel,
  GoalStatus,
  ResponseFormatConfig,
  ResponseFormatType,
} from "./types";

/** A goal as needed to build its progress report. */
export type ProgressGoal = {
  id: string;
  text: string;
  status: GoalStatus;
  area: { id: string; name: string } | null;
  response_format: {
    id: string;
    name: string;
    type: ResponseFormatType;
    config: ResponseFormatConfig;
  } | null;
};

/** A trial flattened with its parent session's date. */
export type ProgressTrial = {
  id: string;
  goal_id: string;
  value: Record<string, unknown>;
  session_date: string;
};

export type TrendPoint = {
  date: string;
  percent: number;
};

export type LevelBreakdownEntry = {
  name: string;
  color: string;
  count: number;
  percent: number;
  isIndependent: boolean;
};

export type TrendDirection = "up" | "down" | "flat";

/** One "sentence_structure" component's own level breakdown — same shape
 *  as the goal-level one (reuses LevelBreakdownBars as-is, just called
 *  once per component instead of once for the whole goal). */
export type ComponentBreakdown = {
  name: string;
  levelBreakdown: LevelBreakdownEntry[];
  independentPercent: number;
};

export type GoalProgressReport = {
  goal: ProgressGoal;
  totalTrials: number;
  sessionCount: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
  isCueing: boolean;
  isRating: boolean;
  isSentenceStructure: boolean;
  /** What the trend/current-percent numbers represent, for chart/summary labels. */
  metricLabel: string;
  /** For "sentence_structure", this is the *combined* breakdown across
   *  every component (and extra) pick — the per-component detail lives
   *  in componentBreakdown below. Empty when there's nothing to show. */
  levelBreakdown: LevelBreakdownEntry[];
  /** Only populated for "sentence_structure" — one entry per configured
   *  component (extras are excluded here: they're a one-off per attempt,
   *  not a stable dimension to report on across sessions). */
  componentBreakdown: ComponentBreakdown[];
  trend: TrendPoint[];
  currentPercent: number | null;
  trendDirection: TrendDirection;
  summary: string;
};

/** A single component/extra pick flattened out of one trial's value —
 *  `{components: [{name, level}, ...], extras: [{label, level}, ...]}` —
 *  for tallying regardless of which of the two arrays it came from. */
type SentenceStructurePick = { name: string; level: string };

function readStringField(entry: unknown, field: string): string | null {
  if (!entry || typeof entry !== "object") return null;
  const value = (entry as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function extractSentenceStructurePicks(
  value: Record<string, unknown>
): SentenceStructurePick[] {
  const picks: SentenceStructurePick[] = [];

  const components = Array.isArray(value.components) ? value.components : [];
  for (const c of components) {
    const name = readStringField(c, "name");
    const level = readStringField(c, "level");
    if (name && level) picks.push({ name, level });
  }

  const extras = Array.isArray(value.extras) ? value.extras : [];
  for (const e of extras) {
    const label = readStringField(e, "label");
    const level = readStringField(e, "level");
    if (label && level) picks.push({ name: label, level });
  }

  return picks;
}

/** Builds one component's (or the combined, if no `filterName`) level
 *  breakdown from a flat list of picks — same computation cueing_hierarchy
 *  already does, just reused per component. */
function buildLevelBreakdownFromPicks(
  picks: SentenceStructurePick[],
  levels: CueingLevel[],
  filterName: string | null
): { breakdown: LevelBreakdownEntry[]; independentPercent: number } {
  const relevant = filterName === null ? picks : picks.filter((p) => p.name === filterName);
  const counts = new Map<string, number>();
  for (const p of relevant) counts.set(p.level, (counts.get(p.level) ?? 0) + 1);

  const total = relevant.length;
  const breakdown = levels.map((level) => {
    const count = counts.get(level.name) ?? 0;
    return {
      name: level.name,
      color: level.color,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
      isIndependent: level.is_independent,
    };
  });

  const independentCount = breakdown
    .filter((b) => b.isIndependent)
    .reduce((sum, b) => sum + b.count, 0);
  const independentPercent = total > 0 ? Math.round((independentCount / total) * 100) : 0;

  return { breakdown, independentPercent };
}

export function buildGoalReport(
  goal: ProgressGoal,
  allTrials: ProgressTrial[]
): GoalProgressReport {
  const goalTrials = allTrials.filter((t) => t.goal_id === goal.id);
  const isCueing = goal.response_format?.type === "cueing_hierarchy";
  const isRating = goal.response_format?.type === "rating_scale";
  const isSentenceStructure = goal.response_format?.type === "sentence_structure";

  const sessionDates = Array.from(
    new Set(goalTrials.map((t) => t.session_date))
  ).sort();
  const firstSessionDate = sessionDates[0] ?? null;
  const lastSessionDate = sessionDates[sessionDates.length - 1] ?? null;

  const bySessionDate = new Map<string, ProgressTrial[]>();
  for (const trial of goalTrials) {
    const list = bySessionDate.get(trial.session_date) ?? [];
    list.push(trial);
    bySessionDate.set(trial.session_date, list);
  }

  let levelBreakdown: LevelBreakdownEntry[] = [];
  let componentBreakdown: ComponentBreakdown[] = [];
  let trend: TrendPoint[] = [];
  let metricLabel = "% correct";

  if (isSentenceStructure) {
    metricLabel = "% independent";
    const levels = goal.response_format?.config.levels ?? [];
    const components = goal.response_format?.config.components ?? [];

    // Every component/extra pick across every trial, flattened — the
    // combined breakdown/trend below just don't filter by name; the
    // per-component ones (loop further down) filter to one name each.
    const allPicks = goalTrials.flatMap((t) => extractSentenceStructurePicks(t.value));
    const combined = buildLevelBreakdownFromPicks(allPicks, levels, null);
    levelBreakdown = combined.breakdown;

    componentBreakdown = components.map((component) => {
      const { breakdown, independentPercent } = buildLevelBreakdownFromPicks(
        allPicks,
        levels,
        component.name
      );
      return { name: component.name, levelBreakdown: breakdown, independentPercent };
    });

    const independentNames = new Set(levels.filter((l) => l.is_independent).map((l) => l.name));
    trend = sessionDates.map((date) => {
      const dayTrials = bySessionDate.get(date) ?? [];
      const dayPicks = dayTrials.flatMap((t) => extractSentenceStructurePicks(t.value));
      const independentCount = dayPicks.filter((p) => independentNames.has(p.level)).length;
      return {
        date,
        percent: dayPicks.length > 0 ? Math.round((independentCount / dayPicks.length) * 100) : 0,
      };
    });
  } else if (isCueing) {
    metricLabel = "% independent";
    const levels = goal.response_format?.config.levels ?? [];
    const counts = new Map<string, number>();
    for (const trial of goalTrials) {
      const level = typeof trial.value.level === "string" ? trial.value.level : null;
      if (level) counts.set(level, (counts.get(level) ?? 0) + 1);
    }

    const total = goalTrials.length;
    levelBreakdown = levels.map((level) => {
      const count = counts.get(level.name) ?? 0;
      return {
        name: level.name,
        color: level.color,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
        isIndependent: level.is_independent,
      };
    });

    const independentNames = new Set(
      levels.filter((l) => l.is_independent).map((l) => l.name)
    );
    trend = sessionDates.map((date) => {
      const dayTrials = bySessionDate.get(date) ?? [];
      const independentCount = dayTrials.filter(
        (t) =>
          typeof t.value.level === "string" &&
          independentNames.has(t.value.level as string)
      ).length;
      return {
        date,
        percent:
          dayTrials.length > 0
            ? Math.round((independentCount / dayTrials.length) * 100)
            : 0,
      };
    });
  } else if (isRating) {
    const min = goal.response_format?.config.min ?? 0;
    const max = goal.response_format?.config.max ?? 4;
    const range = max - min || 1;
    metricLabel = `% of max rating (out of ${max})`;
    trend = sessionDates.map((date) => {
      const dayTrials = bySessionDate.get(date) ?? [];
      const ratings = dayTrials
        .map((t) => t.value.rating)
        .filter((r): r is number => typeof r === "number");
      const avg =
        ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
          : null;
      return {
        date,
        percent: avg !== null ? Math.round(((avg - min) / range) * 100) : 0,
      };
    });
  } else {
    trend = sessionDates.map((date) => {
      const dayTrials = bySessionDate.get(date) ?? [];
      const correctCount = dayTrials.filter((t) => t.value.correct === true).length;
      return {
        date,
        percent:
          dayTrials.length > 0
            ? Math.round((correctCount / dayTrials.length) * 100)
            : 0,
      };
    });
  }

  const currentPercent = trend.length > 0 ? trend[trend.length - 1].percent : null;
  const trendDirection = computeTrendDirection(trend.map((p) => p.percent));

  const summary = buildSummary(goal, {
    totalTrials: goalTrials.length,
    firstSessionDate,
    currentPercent,
    sessionCount: sessionDates.length,
    trendDirection,
    isCueing,
    isRating,
    isSentenceStructure,
  });

  return {
    goal,
    totalTrials: goalTrials.length,
    sessionCount: sessionDates.length,
    firstSessionDate,
    lastSessionDate,
    isCueing,
    isRating,
    isSentenceStructure,
    componentBreakdown,
    metricLabel,
    levelBreakdown,
    trend,
    currentPercent,
    trendDirection,
    summary,
  };
}

/** Compares the average of the first half of the series to the second
 *  half — resistant to single-session noise, no need for anything fancier
 *  for a handful of session data points. A small threshold avoids flagging
 *  trivial wobble as a trend. */
function computeTrendDirection(values: number[]): TrendDirection {
  if (values.length < 2) return "flat";

  const mid = Math.max(1, Math.floor(values.length / 2));
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);
  const avg = (arr: number[]) => arr.reduce((sum, v) => sum + v, 0) / arr.length;

  const diff = avg(secondHalf) - avg(firstHalf);
  if (diff > 5) return "up";
  if (diff < -5) return "down";
  return "flat";
}

// ============================================================
// Material usage — "Last used: X%" on the session page, once a material
// is selected on a goal. Reuses buildGoalReport's per-session-date trend
// (rather than re-deriving the cueing/rating/correct percent math) by
// calling it with the trial list narrowed to just that material.
// ============================================================

export type MaterialUsageSummary = {
  /** The metric from the most recent session this material was used in
   *  for this goal — see computeLastUsedMaterialStats for why "most
   *  recent" rather than an all-time average. */
  percent: number;
  /** e.g. "% independent", "% correct", "% of max rating (out of 4)" —
   *  same wording buildGoalReport uses, so it reads consistently with
   *  the Progress page. */
  metricLabel: string;
  sessionDate: string;
  trialCount: number;
};

/** "Last used" stats for one material on one goal, from the most recent
 *  session in which a trial was logged against that material — not an
 *  all-time average across every session it's ever been used in. A
 *  material might have been introduced months ago when cueing looked
 *  very different, or used once on an off day; blending all of that into
 *  one running average would wash out exactly the signal she's checking
 *  for in the moment ("is this still working for this student?"). The
 *  most recent session answers that question directly. */
export function computeLastUsedMaterialStats(
  goal: ProgressGoal,
  materialTrials: ProgressTrial[]
): MaterialUsageSummary | null {
  if (materialTrials.length === 0) return null;

  const report = buildGoalReport(goal, materialTrials);
  if (report.trend.length === 0) return null;

  const lastPoint = report.trend[report.trend.length - 1];
  const trialCount = materialTrials.filter(
    (t) => t.session_date === lastPoint.date
  ).length;

  return {
    percent: lastPoint.percent,
    metricLabel: report.metricLabel,
    sessionDate: lastPoint.date,
    trialCount,
  };
}

/** Raw shape of a `trials`/`teacher_trials` row selected with a nested
 *  `session:sessions(date)` (or `teacher_sessions(date)`) join — the
 *  session page fetches exactly this (filtered to `material_id is not
 *  null` for the goals being logged) to seed "Last used" for every
 *  material on every goal in one query. */
export type RawMaterialTrialJoin = {
  goal_id: string;
  material_id: string | null;
  value: Record<string, unknown>;
  session: { date: string } | { date: string }[] | null;
};

/** Groups raw material-tagged trial rows by goal, then by material, and
 *  reduces each group down to its MaterialUsageSummary — everything the
 *  session page needs to show "Last used: ..." under whichever material
 *  ends up selected on each goal. */
export function computeLastUsedStatsByGoalAndMaterial(
  goals: ProgressGoal[],
  rows: RawMaterialTrialJoin[]
): Record<string, Record<string, MaterialUsageSummary>> {
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const trialsByGoalAndMaterial = new Map<string, Map<string, ProgressTrial[]>>();

  for (const row of rows) {
    if (!row.material_id) continue;
    const session = Array.isArray(row.session) ? row.session[0] : row.session;
    if (!session) continue;

    const byMaterial =
      trialsByGoalAndMaterial.get(row.goal_id) ?? new Map<string, ProgressTrial[]>();
    const list = byMaterial.get(row.material_id) ?? [];
    list.push({
      id: "",
      goal_id: row.goal_id,
      value: row.value,
      session_date: session.date,
    });
    byMaterial.set(row.material_id, list);
    trialsByGoalAndMaterial.set(row.goal_id, byMaterial);
  }

  const result: Record<string, Record<string, MaterialUsageSummary>> = {};
  for (const [goalId, byMaterial] of trialsByGoalAndMaterial) {
    const goal = goalById.get(goalId);
    if (!goal) continue;

    const perMaterial: Record<string, MaterialUsageSummary> = {};
    for (const [materialId, trials] of byMaterial) {
      const stats = computeLastUsedMaterialStats(goal, trials);
      if (stats) perMaterial[materialId] = stats;
    }
    result[goalId] = perMaterial;
  }
  return result;
}

function buildSummary(
  goal: ProgressGoal,
  stats: {
    totalTrials: number;
    firstSessionDate: string | null;
    currentPercent: number | null;
    sessionCount: number;
    trendDirection: TrendDirection;
    isCueing: boolean;
    isRating: boolean;
    isSentenceStructure: boolean;
  }
): string {
  if (
    stats.totalTrials === 0 ||
    !stats.firstSessionDate ||
    stats.currentPercent === null
  ) {
    return `No sessions logged yet for "${goal.text}".`;
  }

  const since = formatDate(stats.firstSessionDate);
  const sessionWord = stats.sessionCount === 1 ? "session" : "sessions";

  if (stats.isRating) {
    return `Working on "${goal.text}" since ${since}. Currently averaging ${stats.currentPercent}% of the max rating across ${stats.sessionCount} ${sessionWord}, trending ${stats.trendDirection}.`;
  }

  const metric = stats.isCueing || stats.isSentenceStructure ? "independent" : "correct";
  return `Working on "${goal.text}" since ${since}. Currently at ${stats.currentPercent}% ${metric} responses across ${stats.sessionCount} ${sessionWord}, trending ${stats.trendDirection}.`;
}
