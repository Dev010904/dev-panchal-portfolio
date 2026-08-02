'use client';

import { useRef } from 'react';

import { ACHIEVEMENT } from '@/config/animation';
import { achievement } from '@/data/credentials';
import { gsap, useGsap } from '@/lib/gsap';
import { useSectionShot } from '@/components/useSectionShot';
import { ArrowLink } from '@/components/ui/ArrowLink';
import { SectionTag, useCursorTarget, useRailFade } from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

/**
 * THE ACHIEVEMENT.
 *
 * Not a card, not a list, not a row of badges. One number set at display size
 * with three lines of monospace beside it, and that is the whole section.
 *
 * The argument for that shape: a rank is a single fact, and the moment it is
 * put in a card next to other cards it becomes an item in a collection, which
 * is precisely the reading that makes an achievement look like padding. Given
 * a full viewport and nothing to compete with, it is a statement.
 *
 * The counter is the only ornament, and it is doing work rather than
 * decoration — it makes you watch the number land.
 */
export function Achievements() {
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useRailFade(rail);
  const number = useRef<HTMLSpanElement>(null);
  const reducedMotion = useScene((s) => s.reducedMotion);
  const block = useCursorTarget<HTMLAnchorElement>();

  // The camera cranes off the work arc here — see SHOTS.credits. Started early
  // (the default 'top 55%' is too late for a move this long) so the travel has
  // settled by the time the number is being read.
  useSectionShot(root, 'credits', 'ACHIEVEMENT', 'top 78%');

  useGsap(
    () => {
      const el = number.current;

      if (reducedMotion) {
        gsap.set('[data-ach]', { autoAlpha: 1, y: 0 });
        if (el) el.textContent = String(achievement.rank);
        return;
      }

      gsap.fromTo(
        '[data-ach]',
        { autoAlpha: 0, y: 22 },
        {
          autoAlpha: 1,
          y: 0,
          duration: ACHIEVEMENT.reveal.duration,
          stagger: ACHIEVEMENT.reveal.stagger,
          ease: ACHIEVEMENT.reveal.ease,
          scrollTrigger: { trigger: root.current, start: 'top 72%' },
        },
      );

      if (!el) return;

      // Counted by tweening a plain object and writing the rounded value, not
      // by animating anything the browser can interpolate itself. There is no
      // CSS property here to animate — the number is text content.
      const state = { v: 0 };
      gsap.to(state, {
        v: achievement.rank,
        duration: ACHIEVEMENT.count.duration,
        delay: ACHIEVEMENT.countDelay,
        ease: ACHIEVEMENT.count.ease,
        onUpdate: () => {
          el.textContent = String(Math.round(state.v));
        },
        onComplete: () => {
          el.textContent = String(achievement.rank);
        },
        scrollTrigger: { trigger: root.current, start: 'top 72%' },
      });
    },
    [reducedMotion],
    root,
  );

  return (
    <section
      ref={root}
      id="achievement"
      aria-label="Achievement"
      className="relative flex min-h-[100svh] flex-col justify-center py-[clamp(6rem,18vh,12rem)]"
    >
      <div className="grid12 gap-y-10">
        {/* Sticky rail, faded before it reaches the bar — see useRailFade. */}
        <div ref={rail} className="col-span-12 flex flex-col gap-y-10">
          <div className="flex items-baseline justify-between">
            <SectionTag name="ACHIEVEMENT" />
            <span className="t-mono text-[var(--color-fg-dim)]">RANK</span>
          </div>
          <div className="h-px bg-[var(--color-rule)]" />
        </div>

        {/* The whole block is the link. A rank with a certificate behind it
            should be one gesture to verify, not a number with a "proof" link
            filed underneath it. */}
        <a
          ref={block}
          data-ach
          href={achievement.certificate}
          target="_blank"
          rel="noopener noreferrer"
          className="group col-span-12 flex flex-col items-start gap-x-[clamp(1.5rem,4vw,4rem)] gap-y-6 opacity-0 md:flex-row md:items-center"
        >
          <span className="flex items-start leading-none text-[var(--color-accent)]">
            <span
              aria-hidden="true"
              className="mt-[0.14em] text-[clamp(2rem,5vw,4.5rem)] font-[500] tracking-[-0.03em] opacity-70"
            >
              #
            </span>
            <span className="sr-only">Ranked number {achievement.rank}. </span>
            <span
              ref={number}
              aria-hidden="true"
              className="block text-[clamp(6rem,20vw,17rem)] font-[700] leading-[0.82] tracking-[-0.045em] tabular-nums"
            >
              0
            </span>
          </span>

          <span className="flex flex-col gap-2.5 border-l border-[var(--color-rule)] pl-[clamp(1rem,2vw,2rem)] transition-colors duration-500 group-hover:border-[var(--color-accent)]">
            {achievement.lines.map((line) => (
              <span key={line} className="t-mono block text-[var(--color-fg-dim)]">
                {line}
              </span>
            ))}
            <span className="t-label mt-2 flex items-center gap-3 text-[var(--color-fg)]">
              CERTIFICATE
              <span
                aria-hidden="true"
                className="text-[var(--color-accent)] transition-transform duration-500 ease-[var(--ease-reveal)] group-hover:translate-x-1"
              >
                ↗
              </span>
            </span>
          </span>
        </a>

        <div className="col-span-12 h-px bg-[var(--color-rule)]" />

        <div className="col-span-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
          <p data-ach className="t-body max-w-[54ch] opacity-0">
            {achievement.footnote}
          </p>
          <span data-ach className="block opacity-0">
            <ArrowLink label="ALL CREDENTIALS" href="/credentials" tone="accent" />
          </span>
        </div>
      </div>
    </section>
  );
}
