'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { SCROLL } from '@/config/animation';
import { useScene } from '@/store/scene';

let lenis: Lenis | null = null;
export const getLenis = () => lenis;

/**
 * SCROLL AUTHORITY.
 *
 * Lenis owns the scroll position; GSAP owns everything that reacts to it.
 * The wiring that matters:
 *
 *   - ScrollTrigger.update is called from Lenis' scroll event, not from the
 *     native one. If you leave ScrollTrigger listening to the window, it reads
 *     the real scrollTop while Lenis is still easing toward it, and every
 *     pinned section lags its own trigger by a few frames.
 *   - Lenis is driven from gsap.ticker rather than its own rAF, so there is
 *     exactly one animation frame loop on the page and the order of operations
 *     is deterministic.
 *   - lagSmoothing is off. On a heavy WebGL page a dropped frame would
 *     otherwise make GSAP silently skip time, which desyncs a scrubbed
 *     timeline from the scroll position it is supposed to be locked to.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reducedMotion = useScene((s) => s.reducedMotion);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    if (reducedMotion) {
      ScrollTrigger.refresh();
      return;
    }

    const instance = new Lenis({
      lerp: SCROLL.lerp,
      wheelMultiplier: SCROLL.wheelMultiplier,
      touchMultiplier: SCROLL.touchMultiplier,
      smoothWheel: true,
      autoRaf: false,
    });
    lenis = instance;

    const onScroll = () => ScrollTrigger.update();
    instance.on('scroll', onScroll);

    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    ScrollTrigger.scrollerProxy(document.documentElement, {
      scrollTop(value) {
        if (value !== undefined) instance.scrollTo(value, { immediate: true });
        return instance.scroll;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
    });

    ScrollTrigger.refresh();

    return () => {
      instance.off('scroll', onScroll);
      gsap.ticker.remove(tick);
      instance.destroy();
      lenis = null;
      ScrollTrigger.scrollerProxy(document.documentElement, undefined);
    };
  }, [reducedMotion]);

  return <>{children}</>;
}
