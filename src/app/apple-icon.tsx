import { ImageResponse } from "next/og";

// The "add to home screen" / pinned-tile icon Apple (and some other
// platforms) require as a raster image -- icon.svg above covers the
// browser tab, but Apple never reads an SVG for this. Generated at
// request time via next/og's ImageResponse (bundled with Next, no
// extra tooling) rather than hand-exporting a PNG, so it stays in sync
// with icon.svg's design by construction: same shapes, same color,
// just rasterized at Apple's expected 180x180.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width="180" height="180" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="6" fill="#FFE6DF" />
        <g transform="translate(16 16)">
          <g fill="#F04E28">
            <ellipse cx="0" cy="-6.4" rx="3.3" ry="5.1" />
            <ellipse cx="0" cy="-6.4" rx="3.3" ry="5.1" transform="rotate(90)" />
            <ellipse cx="0" cy="-6.4" rx="3.3" ry="5.1" transform="rotate(180)" />
            <ellipse cx="0" cy="-6.4" rx="3.3" ry="5.1" transform="rotate(270)" />
          </g>
          <circle r="3.1" fill="#FFE6DF" />
        </g>
      </svg>
    ),
    { ...size }
  );
}
