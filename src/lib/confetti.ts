/** canvas-confetti is small but purely decorative — loaded on demand so it
 *  doesn't add to every page's bundle, only the couple of places that
 *  actually celebrate something (goal mastery, a parent's practice log). */
async function loadConfetti() {
  const mod = await import("canvas-confetti");
  return mod.default;
}

// Warm palette matching the app's brand/accent colors (see tailwind.config.ts)
// plus a couple of friendly extras, so the burst reads as "this app" rather
// than a generic confetti effect.
const CONFETTI_COLORS = ["#FF6B47", "#22A390", "#FFA98F", "#7ED7C8", "#FBBF24"];

/** A brief, centered confetti burst — used for both goal-mastery and
 *  parent practice-log celebrations. Respects prefers-reduced-motion, and
 *  fails silently on any error (e.g. the dynamic import or canvas creation
 *  failing in some odd environment): a missing animation should never
 *  block the save it's celebrating. */
export async function fireCelebrationConfetti() {
  try {
    const confetti = await loadConfetti();
    await confetti({
      particleCount: 80,
      spread: 70,
      startVelocity: 35,
      origin: { y: 0.6 },
      colors: CONFETTI_COLORS,
      disableForReducedMotion: true,
    });
  } catch {
    // Purely decorative — never let this break the flow it's celebrating.
  }
}
