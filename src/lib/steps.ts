'use client';

import { gsap } from '@/lib/gsap';

/**
 * THE STEP REGISTRY.
 *
 * A per-frame callback registered here is driven by `gsap.ticker` in
 * production, exactly as a bare `gsap.ticker.add` would be, AND is reachable by
 * the dev QA harness so it can be advanced by hand.
 *
 * WHY THIS EXISTS
 *
 * `__qa.tick()` advances the 3D scene with R3F's `advance()` and the GSAP
 * global timeline with `gsap.updateRoot()`. Neither dispatches `gsap.ticker`
 * callbacks — GSAP has no manual-advance API for its ticker — so every DOM-side
 * readout on this site was invisible to the harness. The preloader counter, the
 * manifesto stagger, the section rails and the cursor were all "verified" at
 * various points by stepping frames and screenshotting a value that had not
 * moved since the last real frame.
 *
 * That is the same class of defect as `gl.info` resetting per render: an
 * instrument reporting confidently about something it was not connected to.
 * The workaround was exporting `cursorStep(dt)` from Cursor.tsx and calling it
 * by hand, which fixed exactly one consumer and left the rest.
 *
 * ORDERING IS PRESERVED, DELIBERATELY. Registration still goes through
 * `gsap.ticker.add`, so production ordering is byte-for-byte what it was:
 * gsap's own root update, then Lenis, then these, then R3F's loop. The registry
 * is a second reference to the same function, not a second dispatch path.
 *
 * WHAT MUST NOT BE REGISTERED HERE
 *
 *   - Lenis. `__qa.tick()` already drives `lenis.raf(stamp)` with a controlled
 *     timestamp; registering it too would integrate the same frame twice
 *     against two different clocks.
 *   - The harness's own probes, for the same reason.
 */

type StepFn = (delta: number, time: number) => void;

/**
 * A Set rather than an array so a double-registration cannot silently
 * double-step a callback, which would look exactly like damping running at
 * twice its configured rate.
 */
const steps = new Set<StepFn>();

/**
 * Register a per-frame callback. Returns its unsubscribe.
 *
 * `delta` is in seconds. Prefer the `useTicker` hook inside components; this is
 * the imperative form, for callbacks created inside a `useGsap` context or an
 * effect that already manages its own lifetime.
 */
export function addStep(fn: StepFn): () => void {
  const handler = (time: number, deltaMs: number) => fn(deltaMs / 1000, time);

  // The registry holds the SAME wrapper gsap holds, so manual stepping and
  // real frames cannot diverge.
  const manual: StepFn = (delta, time) => fn(delta, time);

  gsap.ticker.add(handler);
  steps.add(manual);

  return () => {
    gsap.ticker.remove(handler);
    steps.delete(manual);
  };
}

/**
 * Drive every registered step by hand. Returns how many ran, so a caller can
 * assert it is actually connected to something rather than stepping an empty
 * registry and reading a frozen frame — which is the failure this whole module
 * exists to make impossible.
 *
 * Dev harness only. On a visible tab `gsap.ticker` is still running, so a
 * stepped frame is stepped TWICE — once here and once by the real ticker. That
 * is acceptable for determinism work and it is why measured damping through the
 * harness reads slightly tighter than production. Noted in docs/PERFORMANCE.md.
 */
export function runSteps(delta: number, time = performance.now()): number {
  for (const fn of steps) fn(delta, time);
  return steps.size;
}

/** How many callbacks are currently registered. */
export function stepCount(): number {
  return steps.size;
}
