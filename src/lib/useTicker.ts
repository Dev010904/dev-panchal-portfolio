'use client';

import { useEffect, useRef } from 'react';
import { addStep } from '@/lib/steps';

/**
 * Run a callback on the DOM-side animation frame.
 *
 * ACCURACY NOTE. This comment used to say there was exactly one rAF loop on the
 * site and that gsap.ticker drove the R3F render loop too. That was never true.
 * There are two loops — gsap.ticker for Lenis, ScrollTrigger and DOM readouts,
 * and R3F's own for rendering — and they are deliberately left separate. See
 * docs/PERFORMANCE.md for why unifying them was investigated and rejected.
 *
 * What is actually guaranteed, and it is the guarantee that matters:
 *
 *   ORDERING — gsap.ticker's rAF is registered at module-evaluation time and
 *   R3F's when the Canvas root is configured in a React effect, and both
 *   re-register at the top of their own callback. So gsap runs first, every
 *   frame, permanently. Scroll is integrated and pushed into the scene handles
 *   before `useFrame` reads them. A readout registered here therefore never
 *   paints a value the scene has already moved past.
 *
 *   CONTROL — this routes through the step registry in lib/steps.ts, so the
 *   dev QA harness can advance it by hand. A bare `gsap.ticker.add` cannot be:
 *   `__qa.tick()` advances the global timeline with `gsap.updateRoot()`, which
 *   does not dispatch ticker callbacks. Every DOM-side behaviour "verified"
 *   through the harness before that registry existed was read off a frame that
 *   had not advanced. Use this hook, or `addStep`, and never `ticker.add`.
 *
 * `delta` is in seconds and already lag-smoothed off.
 */
export function useTicker(fn: (delta: number, time: number) => void, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    return addStep((delta, time) => saved.current(delta, time));
  }, [enabled]);
}
