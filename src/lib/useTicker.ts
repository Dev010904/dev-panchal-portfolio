'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';

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
 *   NOT CONTROL, YET — anything registered here is invisible to the dev QA
 *   harness. `__qa.tick()` advances the global timeline with
 *   `gsap.updateRoot()`, which does NOT dispatch ticker callbacks, so every
 *   consumer of this hook has never been stepped by hand. Any DOM-side
 *   behaviour previously "verified" through the harness was read off a frame
 *   that had not advanced. A step registry to fix this lands separately.
 *
 * `delta` is in seconds and already lag-smoothed off.
 */
export function useTicker(fn: (delta: number, time: number) => void, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    const handler = (time: number, delta: number) => saved.current(delta / 1000, time);
    gsap.ticker.add(handler);
    return () => gsap.ticker.remove(handler);
  }, [enabled]);
}
