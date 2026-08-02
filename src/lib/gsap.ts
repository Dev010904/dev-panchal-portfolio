'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Every GSAP setup on this site goes through here.
 *
 * gsap.context() scopes selectors to the component's own DOM and, critically,
 * gives one revert() that kills every tween, timeline and ScrollTrigger the
 * setup created. Without it, a section that unmounts leaves its ScrollTriggers
 * registered against detached nodes; they keep recalculating on every scroll
 * and pin spacing quietly drifts. The leak is invisible until the third or
 * fourth route change, which is the worst time to find it.
 */
export function useGsap(
  setup: (ctx: gsap.Context) => void,
  deps: React.DependencyList = [],
  scope?: React.RefObject<HTMLElement | null>,
) {
  const saved = useRef(setup);
  saved.current = setup;

  useLayoutEffect(() => {
    const ctx = gsap.context((self) => saved.current(self), scope?.current ?? undefined);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export { gsap, ScrollTrigger };
