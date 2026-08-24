import { formatShortDate } from "@/lib/date";
import type { TrendPoint } from "@/lib/progress";

type Props = {
  points: TrendPoint[];
  label: string;
};

const WIDTH = 320;
const HEIGHT = 140;
const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

/** Small hand-rolled SVG line chart — no charting library needed for a
 *  handful of session data points, and it stays perfectly responsive
 *  (viewBox scales with the container) with zero client-side JS. */
export default function TrendChart({ points, label }: Props) {
  const xFor = (i: number) =>
    points.length <= 1
      ? PAD_LEFT + PLOT_WIDTH / 2
      : PAD_LEFT + (i / (points.length - 1)) * PLOT_WIDTH;
  const yFor = (percent: number) => PAD_TOP + (1 - percent / 100) * PLOT_HEIGHT;

  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.percent)}`).join(" ");
  // Avoid crowding the x-axis once there are more than a handful of sessions.
  const labelStep = points.length > 8 ? Math.ceil(points.length / 8) : 1;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full min-w-[280px]"
        role="img"
        aria-label={`${label} trend over sessions`}
      >
        {[0, 50, 100].map((mark) => (
          <g key={mark}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yFor(mark)}
              y2={yFor(mark)}
              className="stroke-stone-200"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 6}
              y={yFor(mark) + 3}
              textAnchor="end"
              fontSize={9}
              className="fill-stone-400"
            >
              {mark}%
            </text>
          </g>
        ))}

        {points.length > 1 && (
          <polyline
            points={linePoints}
            fill="none"
            className="stroke-brand-500"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={xFor(i)}
            cy={yFor(p.percent)}
            r={3.5}
            className="fill-brand-600"
          />
        ))}

        {points.map((p, i) =>
          i % labelStep === 0 ? (
            <text
              key={p.date}
              x={xFor(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize={8}
              className="fill-stone-400"
            >
              {formatShortDate(p.date)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}
