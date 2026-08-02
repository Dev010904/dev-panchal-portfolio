'use client';

import { useEffect, useRef } from 'react';

import { MARQUEE } from '@/config/animation';
import { ScrollTrigger, useGsap } from '@/lib/gsap';
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
      let raf = 0;
      let half = innerEl.offsetWidth / 2;

      const measure = () => {
        half = innerEl.offsetWidth / 2;
      };
      measure();

      const st = ScrollTrigger.create({
        trigger: root.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const v = self.getVelocity();
          velocity = v;
          if (Math.abs(v) > 12) direction = v > 0 ? 1 : -1;
        },
      });

      const ro = new ResizeObserver(measure);
      ro.observe(innerEl);

      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        const speed =
          MARQUEE.baseSpeed + Math.min(Math.abs(velocity) * MARQUEE.velocityFactor, 2600);
        offset -= speed * dt * direction;

        // Wrap. Modulo on the half-width keeps the two copies aligned exactly.
        if (half > 0) offset = ((offset % half) + half) % half;

        const targetSkew = Math.max(
          -MARQUEE.skewMax,
          Math.min(MARQUEE.skewMax, velocity * MARQUEE.skewFactor * 0.01),
        );
        skew += (targetSkew - skew) * MARQUEE.relax;

        // Velocity decays on its own so the band coasts to base speed when
        // scrolling stops instead of dropping to it in one frame.
        velocity *= 0.92;

        trackEl.style.transform = `translate3d(${-offset}px, 0, 0)`;
        innerEl.style.transform = `skewX(${skew}deg)`;

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(raf);
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
