'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';

/**
 * Run a callback on the single shared animation frame.
 *
 * Nothing on this site is allowed its own requestAnimationFrame loop. There is
 * exactly one, gsap.ticker, and Lenis, ScrollTrigger, the R3F render loop and
 * every DOM readout hang off it. That buys three things:
 *
 *   ORDERING — scroll is integrated, then triggers update, then the scene
 *   renders, then readouts paint. Independent rAF loops interleave in whatever
 *   order they were registered, so a readout can paint a value from the
 *   previous frame and you get a one-frame lag that looks like jank.
 *
 *   COST — n loops means n callback dispatches and n chances to force a style
 *   recalculation. One loop means one.
 *
 *   CONTROL — a single loop can be driven manually, which is what makes the
 *   dev QA harness and any offline frame capture possible at all.
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
