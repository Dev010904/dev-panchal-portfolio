'use client';

import { useRef } from 'react';

import { MARQUEE } from '@/config/animation';
import { ScrollTrigger, useGsap } from '@/lib/gsap';
import { addStep } from '@/lib/steps';
import { useScene } from '@/store/scene';

/**
 * MARQUEE BAND.
 *
 * Full-bleed oversized display type. Three things make it feel physical rather
 * than a CSS animation:
 *
 *   1. Direction follows scroll direction — scroll up and the band reverses.
 *   2. Speed is scroll velocity plus a base drift, so it never fully stops.
 *   3. The whole band skews with velocity and relaxes back to zero. That
 *      elastic lag is the part that sells it as mass being dragged.
 *
 * The track is duplicated once and wrapped with a modulo on its own width, so
 * the loop is seamless at any speed and never accumulates float drift the way
 * a `%`-based CSS keyframe does when you change its duration mid-flight.
 */
export function Marquee() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  const reducedMotion = useScene((s) => s.reducedMotion);

  useGsap(
    () => {
      if (reducedMotion) return;

      const trackEl = track.current;
      const innerEl = inner.current;
      if (!trackEl || !innerEl) return;

      let offset = 0;
      let velocity = 0;
      let skew = 0;
      let direction = 1;
      let half = innerEl.offsetWidth / 2;

      // Last values actually written to the DOM, at the precision they were
      // written. Compared against before every write so a frame that would
      // paint an identical transform does no work and allocates no string.
      let wroteOffset = NaN;
      let wroteSkew = NaN;

      /**
       * Whether the band is anywhere near the viewport.
       *
       * The band never stops moving — that is the point of `baseSpeed` — so
       * without this it built two transform strings and wrote two style
       * properties every frame for the whole length of the page, including the
       * ~90% of it where the band is nowhere near the screen. ScrollTrigger
       * already knows the answer and costs nothing to ask.
       */
      let onScreen = false;

      const measure = () => {
        half = innerEl.offsetWidth / 2;
      };
      measure();

      const st = ScrollTrigger.create({
        trigger: root.current,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          onScreen = self.isActive;
        },
        onUpdate: (self) => {
          const v = self.getVelocity();
          velocity = v;
          if (Math.abs(v) > 12) direction = v > 0 ? 1 : -1;
        },
      });
      onScreen = st.isActive;

      const ro = new ResizeObserver(measure);
      ro.observe(innerEl);

      /**
       * Runs on gsap.ticker rather than a requestAnimationFrame of its own.
       *
       * This was the site's third rAF loop, and the README's claim that no
       * component owned one. It is not a correctness fix — the band reads the
       * same either way, because ScrollTrigger writes `velocity` during the
       * gsap dispatch and gsap's rAF is registered first regardless. It is
       * removed because an independent loop is a second callback dispatch and
       * a second chance to force a style recalculation every frame, for
       * nothing, and because the invariant is worth actually holding.
       *
       * `delta` arrives in seconds already, so the manual performance.now()
       * bookkeeping goes with it.
       */
      const tick = (delta: number) => {
        const dt = Math.min(delta, 0.05);

        // Velocity decays on its own so the band coasts to base speed when
        // scrolling stops instead of dropping to it in one frame. Exponential
        // in dt, so the coast lasts the same wall-clock time at any refresh
        // rate — this was `velocity *= 0.92`, which coasted 2.4× shorter at
        // 144Hz.
        velocity *= Math.exp(-MARQUEE.velocityDecay * dt);

        const targetSkew = Math.max(
          -MARQUEE.skewMax,
          Math.min(MARQUEE.skewMax, velocity * MARQUEE.skewFactor * 0.01),
        );
        skew += (targetSkew - skew) * (1 - Math.exp(-MARQUEE.relaxRate * dt));
        // An exponential chase toward zero never arrives — left alone it walks
        // off into denormals and the band was observed sitting at
        // `skewX(-1.8639e-74deg)`. Harmless to render, but it means the value
        // never settles and so never stops being written. Snapping below the
        // point where a degree of skew could change a pixel makes it settle.
        if (skew !== 0 && Math.abs(skew) < 1e-4) skew = 0;

        const speed =
          MARQUEE.baseSpeed + Math.min(Math.abs(velocity) * MARQUEE.velocityFactor, 2600);
        offset -= speed * dt * direction;

        // Wrap. Modulo on the half-width keeps the two copies aligned exactly.
        if (half > 0) offset = ((offset % half) + half) % half;

        // Simulation above always runs, so the band is never caught up when it
        // scrolls back into view. Only the DOM writes are skipped.
        if (!onScreen) return;

        // Quantised to the precision that can actually change a pixel, then
        // written only on change. At rest the skew is settled and its write
        // disappears entirely; the offset still moves on base drift, so that
        // one keeps going, which is correct.
        const nextOffset = Math.round(offset * 100) / 100;
        if (nextOffset !== wroteOffset) {
          wroteOffset = nextOffset;
          trackEl.style.transform = `translate3d(${-nextOffset}px, 0, 0)`;
        }

        const nextSkew = Math.round(skew * 1000) / 1000;
        if (nextSkew !== wroteSkew) {
          wroteSkew = nextSkew;
          innerEl.style.transform = `skewX(${nextSkew}deg)`;
        }
      };

      const unstep = addStep(tick);

      return () => {
        unstep();
        ro.disconnect();
        st.kill();
      };
    },
    [reducedMotion],
    root,
  );

  const words = MARQUEE.words;
  const run = (
    <span className="flex shrink-0 items-center">
      {words.map((w) => (
        <span key={w} className="flex shrink-0 items-center">
          <span className="px-[0.14em]">{w}</span>
          <span
            aria-hidden="true"
            className="px-[0.14em] text-[var(--color-accent)] opacity-70"
          >
            +
          </span>
        </span>
      ))}
    </span>
  );

  return (
    <div
      ref={root}
      className="relative z-10 select-none overflow-hidden py-[clamp(3rem,10vh,7rem)]"
      aria-hidden="true"
    >
      <div className="h-px w-full bg-[var(--color-rule)]" />
      <div className="marquee-track py-[clamp(1rem,3vh,2rem)]">
        <div ref={inner} className="will-change-transform">
          <div
            ref={track}
            className="flex w-max items-center whitespace-nowrap text-[clamp(3rem,11vw,10rem)] font-[700] leading-[0.9] tracking-[-0.04em] text-[var(--color-fg)] will-change-transform"
          >
            {run}
            {run}
          </div>
        </div>
      </div>
      <div className="h-px w-full bg-[var(--color-rule)]" />
      <span className="sr-only">
        Technologies: Three.js, WebGL, GSAP, React, Motion.
      </span>
    </div>
  );
}
