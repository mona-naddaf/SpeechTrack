import { Resvg } from "@resvg/resvg-js";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { formatShortDate } from "./date";
import { ROBOTO_BOLD_TTF_BASE64, ROBOTO_REGULAR_TTF_BASE64 } from "./fonts/roboto-font-data";
import type { LevelBreakdownEntry, TrendPoint } from "./progress";

/** Server-side equivalents of TrendChart.tsx and LevelBreakdownBars.tsx —
 *  same math, same layout, but built as a raw SVG string (no Tailwind
 *  classes, no React) so it can be rasterized to a PNG and embedded in
 *  the .docx report. Colors are hard-coded hex, matching the exact
 *  Tailwind values those two components render in the app (see
 *  tailwind.config.ts for brand/stone, src/lib/colors.ts for the
 *  behavior/cueing-level palette) — kept in sync by hand since neither
 *  Tailwind's generated CSS nor its config values are reachable from
 *  this plain-Node code path. */

const BRAND_LINE = "#FF6B47"; // brand-500
const BRAND_DOT = "#F04E28"; // brand-600
const STONE_GRID = "#e7e5e4"; // stone-200
const STONE_LABEL = "#a8a29e"; // stone-400
const STONE_TEXT = "#57534e"; // stone-600
// Must match the family name baked into the embedded Roboto files below —
// there is no "Arial"/"Calibri" fallback anymore because loadSystemFonts is
// off (see renderSvgToPng): only fonts we hand resvg by file path exist.
const FONT = "Roboto";

/** Mirrors COLOR_OPTIONS' swatchClass in src/lib/colors.ts — the actual
 *  hex behind each bg-{color}-500 (bg-slate-400 for "grey"). */
const LEVEL_COLOR_HEX: Record<string, string> = {
  green: "#22c55e",
  teal: "#14b8a6",
  amber: "#f59e0b",
  clay: "#f97316",
  grey: "#94a3b8",
  blue: "#3b82f6",
  purple: "#a855f7",
  red: "#ef4444",
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---- Trend chart — mirrors src/app/students/[id]/progress/trend-chart.tsx ----

const TREND_WIDTH = 320;
const TREND_HEIGHT = 140;
const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PLOT_WIDTH = TREND_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = TREND_HEIGHT - PAD_TOP - PAD_BOTTOM;

export function buildTrendChartSvg(points: TrendPoint[]): string {
  const xFor = (i: number) =>
    points.length <= 1
      ? PAD_LEFT + PLOT_WIDTH / 2
      : PAD_LEFT + (i / (points.length - 1)) * PLOT_WIDTH;
  const yFor = (percent: number) => PAD_TOP + (1 - percent / 100) * PLOT_HEIGHT;

  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.percent)}`).join(" ");
  const labelStep = points.length > 8 ? Math.ceil(points.length / 8) : 1;

  const gridlines = [0, 50, 100]
    .map(
      (mark) => `
    <line x1="${PAD_LEFT}" x2="${TREND_WIDTH - PAD_RIGHT}" y1="${yFor(mark)}" y2="${yFor(mark)}" stroke="${STONE_GRID}" stroke-width="1" />
    <text x="${PAD_LEFT - 6}" y="${yFor(mark) + 3}" text-anchor="end" font-size="9" font-family="${FONT}" fill="${STONE_LABEL}">${mark}%</text>`
    )
    .join("");

  const line =
    points.length > 1
      ? `<polyline points="${linePoints}" fill="none" stroke="${BRAND_LINE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`
      : "";

  const dots = points
    .map((p, i) => `<circle cx="${xFor(i)}" cy="${yFor(p.percent)}" r="3.5" fill="${BRAND_DOT}" />`)
    .join("");

  const xLabels = points
    .map((p, i) =>
      i % labelStep === 0
        ? `<text x="${xFor(i)}" y="${TREND_HEIGHT - 8}" text-anchor="middle" font-size="8" font-family="${FONT}" fill="${STONE_LABEL}">${escapeXml(formatShortDate(p.date))}</text>`
        : ""
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TREND_WIDTH}" height="${TREND_HEIGHT}" viewBox="0 0 ${TREND_WIDTH} ${TREND_HEIGHT}">
    <rect width="${TREND_WIDTH}" height="${TREND_HEIGHT}" fill="white" />
    ${gridlines}
    ${line}
    ${dots}
    ${xLabels}
  </svg>`;
}

// ---- Level breakdown bars — mirrors level-breakdown-bars.tsx's divs as SVG rects ----

const LEVEL_WIDTH = 320;
const LEVEL_ROW_HEIGHT = 34;
const LEVEL_BAR_HEIGHT = 10;
const LEVEL_TOP_PAD = 4;
const LEVEL_SIDE_PAD = 4;
const LEVEL_BAR_MAX_WIDTH = LEVEL_WIDTH - LEVEL_SIDE_PAD * 2;

export function buildLevelBreakdownSvg(entries: LevelBreakdownEntry[]): string {
  const height = entries.length * LEVEL_ROW_HEIGHT + LEVEL_TOP_PAD;

  const rows = entries
    .map((entry, i) => {
      const y = LEVEL_TOP_PAD + i * LEVEL_ROW_HEIGHT;
      const color = LEVEL_COLOR_HEX[entry.color] ?? LEVEL_COLOR_HEX.grey;
      const barWidth = Math.max(2, (entry.percent / 100) * LEVEL_BAR_MAX_WIDTH);
      const label = entry.isIndependent ? `${entry.name} (independent)` : entry.name;
      return `
    <text x="${LEVEL_SIDE_PAD}" y="${y + 10}" font-size="10" font-family="${FONT}" font-weight="700" fill="${STONE_TEXT}">${escapeXml(label)}</text>
    <text x="${LEVEL_WIDTH - LEVEL_SIDE_PAD}" y="${y + 10}" font-size="10" font-family="${FONT}" text-anchor="end" fill="${STONE_TEXT}">${entry.percent}% (${entry.count})</text>
    <rect x="${LEVEL_SIDE_PAD}" y="${y + 16}" width="${LEVEL_BAR_MAX_WIDTH}" height="${LEVEL_BAR_HEIGHT}" rx="5" fill="${STONE_GRID}" />
    <rect x="${LEVEL_SIDE_PAD}" y="${y + 16}" width="${barWidth}" height="${LEVEL_BAR_HEIGHT}" rx="5" fill="${color}" />`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LEVEL_WIDTH}" height="${height}" viewBox="0 0 ${LEVEL_WIDTH} ${height}">
    <rect width="${LEVEL_WIDTH}" height="${height}" fill="white" />
    ${rows}
  </svg>`;
}

/** Writes the embedded Roboto weights out to real files once per process
 *  (resvg-js's `font.fontFiles` takes file paths, not buffers) and hands
 *  back those paths on every later call. os.tmpdir() is writable both in
 *  local dev and in a Vercel serverless function (each cold start gets its
 *  own /tmp, reused across warm invocations of the same instance), so this
 *  never touches the project's read-only deployment bundle at runtime. */
let fontFilePaths: [string, string] | null = null;

function getFontFiles(): [string, string] {
  if (fontFilePaths) return fontFilePaths;

  const dir = join(tmpdir(), "speechtrack-fonts");
  const regularPath = join(dir, "Roboto-Regular.ttf");
  const boldPath = join(dir, "Roboto-Bold.ttf");

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(regularPath)) {
    writeFileSync(regularPath, Buffer.from(ROBOTO_REGULAR_TTF_BASE64, "base64"));
  }
  if (!existsSync(boldPath)) {
    writeFileSync(boldPath, Buffer.from(ROBOTO_BOLD_TTF_BASE64, "base64"));
  }

  fontFilePaths = [regularPath, boldPath];
  return fontFilePaths;
}

/** Rasterizes an SVG string to a PNG buffer using resvg-js instead of
 *  sharp. sharp's SVG rasterizer (librsvg, via Pango for text layout)
 *  looks up fonts through the host's fontconfig setup — that's what
 *  produced empty tofu boxes for all chart text in production: Vercel's
 *  serverless image has no "Calibri"/"Arial" installed, and unlike local
 *  Windows dev, no fontconfig fallback either. resvg-js is handed the
 *  bundled Roboto files explicitly via `font.fontFiles` and runs with
 *  `loadSystemFonts: false`, so it never consults the host's font store
 *  at all — the exact same two font files are used whether this runs on
 *  a Windows laptop or a Vercel Lambda, so there's no environment-specific
 *  font lookup left to fail.
 *
 *  Renders at 4x zoom (~288 DPI equivalent) so the embedded image stays
 *  crisp if the report is printed, even though the .docx display size
 *  (set via ImageRun's `transformation`) matches the SVG's own on-screen
 *  dimensions. */
export async function renderSvgToPng(
  svg: string,
  dimensions: { width: number; height: number }
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const [regularPath, boldPath] = getFontFiles();
  const resvg = new Resvg(svg, {
    background: "white",
    fitTo: { mode: "zoom", value: 4 },
    font: {
      loadSystemFonts: false,
      fontFiles: [regularPath, boldPath],
      defaultFontFamily: FONT,
      sansSerifFamily: FONT,
    },
  });
  const buffer = resvg.render().asPng();
  return { buffer, ...dimensions };
}
