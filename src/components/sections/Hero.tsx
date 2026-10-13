'use client';

import { useRef } from 'react';

import { HERO } from '@/config/animation';
import { site } from '@/data/site';
import { gsap, useGsap } from '@/lib/gsap';
import { playWhenUncovered } from '@/components/SheetTransition';
import { useSectionShot } from '@/components/useSectionShot';
import { ArrowLink } from '@/components/ui/ArrowLink';
import { CornerMarks } from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

/**
 * HERO.
 *
 * The mark is in the canvas behind this; everything here composites over it.
 * The composition is deliberately off-centre — headline hard left on the grid,
 * chip hard bottom-right, hint label bottom-centre — so the object owns the
 * optical middle without anything being centred.
 */
/** An eight-ray burst that charges and releases, like the hold it labels. */
function BlastGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="blast-glyph h-[1.25em] w-[1.25em]" fill="none">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const r0 = 3.4;
        const r1 = i % 2 === 0 ? 7.4 : 5.8;
        return (
          <line
            key={i}
            x1={8 + Math.cos(a) * r0}
            y1={8 + Math.sin(a) * r0}
            x2={8 + Math.cos(a) * r1}
            y2={8 + Math.sin(a) * r1}
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={8} cy={8} r={1.7} fill="currentColor" />
    </svg>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const entered = useScene((s) => s.entered);

  useSectionShot(root, 'hero', 'INDEX');

  useGsap(
    () => {
      if (!entered) return;

      const tl = gsap.timeline({ delay: 0.15 });

      tl.fromTo(
        '[data-hero-line] > span',
        { yPercent: 112 },
        {
          yPercent: 0,
          duration: HERO.intro.duration,
          stagger: HERO.intro.stagger * 1.6,
          ease: HERO.intro.ease,
        },
      )
        .fromTo(
          '[data-hero-fade]',
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.95,
            stagger: HERO.intro.stagger,
            ease: 'power3.out',
          },
          '-=0.7',
        )
        .fromTo(
          '[data-hero-rule]',
          { scaleX: 0 },
          { scaleX: 1, duration: 1.1, ease: 'expo.out', transformOrigin: 'left center' },
          '-=0.85',
        );

      // Back home from an interior page, behind the sheet: rise as it opens.
      return playWhenUncovered(tl);
    },
    [entered],
    root,
  );


  return (
    <section
      ref={root}
      id="index"
      className="relative flex min-h-[100svh] flex-col justify-between pt-[clamp(6rem,16vh,11rem)] pb-[clamp(1.5rem,5vh,3rem)]"
      aria-label="Introduction"
    >
      <CornerMarks />

      <div className="grid12 items-start">
        {/* The blast targets are the two LINES, not the heading: each is
            struck on its own as the front crosses it. The line masks are the
            targets rather than the words inside them, because the mask clips —
            a word thrown out of its own mask would simply vanish. */}
        <h1 className="col-span-12 lg:col-span-8">
          <span className="sr-only">Static is a choice. Dev Panchal, web developer.</span>
          <span aria-hidden="true" className="t-display block">
            <span data-hero-line data-blast className="line-mask">
              <span className="block will-change-transform">Static is</span>
            </span>
            <span data-hero-line data-blast className="line-mask">
              <span className="block will-change-transform">a choice.</span>
            </span>
          </span>
        </h1>
      </div>

      <div className="grid12 mt-auto items-end gap-y-10">
        <div data-blast className="col-span-12 flex flex-col gap-6 md:col-span-6 lg:col-span-5">
          <span
            data-hero-rule
            className="block h-px w-full origin-left scale-x-0 bg-[var(--color-rule)]"
          />

          <p data-hero-fade className="t-lead max-w-[34ch] text-[var(--color-fg)] opacity-0">
            Web developer — websites, WebGL, motion.
          </p>

          <span data-hero-fade className="block opacity-0">
            <ArrowLink
              label="START A PROJECT"
              href={site.whatsapp.href}
              external
              tone="accent"
            />
          </span>
        </div>

        <div data-blast className="col-span-12 flex flex-col items-start gap-4 md:col-span-6 md:items-end lg:col-start-9 lg:col-span-4">
          <div data-hero-fade className="chip opacity-0">
            <span className="t-label text-[var(--color-fg)]">WEB · 3D · MOTION</span>
            <span aria-hidden="true" className="h-3 w-px bg-[var(--color-rule)]" />
            <span className="t-mono text-[var(--color-accent)]">DP—01</span>
          </div>
          <p data-hero-fade className="t-body max-w-[30ch] opacity-0 md:text-right">
            Independent. Building sites and interactive 3D for the browser.
            Currently taking on freelance work.
          </p>
        </div>
      </div>

      {/*
        INTERACTION HINTS — bottom centre, stacked.

        Both of the hero's interactions were previously either unlabelled or
        buried in the right-hand column. Hold-to-blast in particular had no
        label at all, which makes a hold-to-fire gesture undiscoverable: nobody
        holds a mouse button down on a page for two seconds unless something
        told them to.

        Centred at the foot of the viewport, which is the one band no section
        column occupies. Hidden below `lg` — neither interaction exists on
        touch, so the label would be a lie.
      */}
      <div
        data-hero-fade
        className="pointer-events-none absolute inset-x-0 bottom-[clamp(1.25rem,4vh,2.5rem)] z-10 hidden flex-col items-center gap-1.5 opacity-0 lg:flex"
      >
        <span data-blast className="t-label flex items-center gap-2 text-[var(--color-fg)]">
          HOLD TO
          {/* A detonation, not a spark: the lightning belongs to the lines
              below. Drawn rather than an emoji, so it is the ember and the
              site's line weight instead of the platform's colour font. */}
          <BlastGlyph />
          BLAST
        </span>
        <span data-blast className="t-label flex items-center gap-2">
          DARE
          <span aria-hidden="true" className="spark text-[1.05em] leading-none">
            ⚡
          </span>
          TO TOUCH THE LINES
        </span>
      </div>
    </section>
  );
}
