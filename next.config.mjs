/** @type {import('next').NextConfig} */
const nextConfig = {
  // @resvg/resvg-js (SVG->PNG rasterization for report-charts.ts) ships a
  // native .node addon per platform. Next bundles "sharp" as external by
  // default but doesn't know about this package, so without this, webpack
  // tries to parse the binary as JS and the build fails outright. Marking
  // it external makes Next `require()` it at runtime instead (like sharp),
  // which is what lets npm's per-platform optionalDependencies resolution
  // pick the right native binary for whatever OS actually runs the code.
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;

// Redeploy trigger: force a fresh Vercel build (previous push to main didn't
// get picked up by the GitHub webhook).
