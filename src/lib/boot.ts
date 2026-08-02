/**
 * BOOT PROGRESS.
 *
 * drei's useProgress tracks THREE's loading manager, which is the right answer
 * for a site built out of downloaded assets. This one is built out of
 * procedural geometry: there is almost nothing to *load*, so useProgress sits
 * at zero and a preloader driven by it alone would show 000 until it vanished.
 *
 * The honest measure here is the work that actually delays first paint:
 * extruding the mark, area-sampling its surface for the particle cloud,
 * convolving the environment map, and compiling the shaders. Each of those
 * reports in when it finishes. useProgress is still folded in, so if a project
 * screenshot or a future texture is loading, that counts too.
 *
 * Nothing here is on a timer. If a step is slow the bar waits for it.
 */

export const BOOT_STEPS = ['geometry', 'particles', 'environment', 'firstFrame', 'warm'] as const;
export type BootStep = (typeof BOOT_STEPS)[number];

const done = new Set<BootStep>();
const listeners = new Set<() => void>();

export function markBootStep(step: BootStep) {
  if (done.has(step)) return;
  done.add(step);
  listeners.forEach((l) => l());
}

// Dev-only inspection hook: `__boot()` in the console tells you exactly which
// milestone the preloader is waiting on. Stripped from production builds.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  (window as unknown as { __boot: () => string[] }).__boot = () => [...done];
}

export function bootProgress(): number {
  return done.size / BOOT_STEPS.length;
}

export function onBootProgress(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function bootComplete(): boolean {
  return done.size === BOOT_STEPS.length;
}

/** Test/HMR helper. Not used in production paths. */
export function resetBoot() {
  done.clear();
  listeners.forEach((l) => l());
}
