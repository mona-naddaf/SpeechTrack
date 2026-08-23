import { formatDate } from "./date";
import type { CueingLevel, GoalStatus, ResponseFormatType } from "./types";

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
    config: { levels?: CueingLevel[] } & Record<string, unknown>;
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

export type GoalProgressReport = {
  goal: ProgressGoal;
  totalTrials: number;
  sessionCount: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
  isCueing: boolean;
  levelBreakdown: LevelBreakdownEntry[];
  trend: TrendPoint[];
  currentPercent: number | null;
  trendDirection: TrendDirection;
  summary: string;
};

export function buildGoalReport(
  goal: ProgressGoal,
  allTrials: ProgressTrial[]
): GoalProgressReport {
  const goalTrials = allTrials.filter((t) => t.goal_id === goal.id);
  const isCueing = goal.response_format?.type === "cueing_hierarchy";

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
  let trend: TrendPoint[] = [];

  if (isCueing) {
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
  });

  return {
    goal,
    totalTrials: goalTrials.length,
    sessionCount: sessionDates.length,
    firstSessionDate,
    lastSessionDate,
    isCueing,
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

function buildSummary(
  goal: ProgressGoal,
  stats: {
    totalTrials: number;
    firstSessionDate: string | null;
    currentPercent: number | null;
    sessionCount: number;
    trendDirection: TrendDirection;
    isCueing: boolean;
  }
): string {
  if (
    stats.totalTrials === 0 ||
    !stats.firstSessionDate ||
    stats.currentPercent === null
  ) {
    return `No sessions logged yet for "${goal.text}".`;
  }

  const metric = stats.isCueing ? "independent" : "correct";
  const since = formatDate(stats.firstSessionDate);
  const sessionWord = stats.sessionCount === 1 ? "session" : "sessions";

  return `Working on "${goal.text}" since ${since}. Currently at ${stats.currentPercent}% ${metric} responses across ${stats.sessionCount} ${sessionWord}, trending ${stats.trendDirection}.`;
}
