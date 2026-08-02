'use client';

import { useRef } from 'react';

import { HERO } from '@/config/animation';
import { site } from '@/data/site';
import { gsap, useGsap } from '@/lib/gsap';
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
        <h1 data-blast className="col-span-12 lg:col-span-8">
          <span className="sr-only">Static is a choice. Dev Panchal, web developer.</span>
          <span aria-hidden="true" className="t-display block">
            <span data-hero-line className="line-mask">
              <span className="block will-change-transform">Static is</span>
            </span>
            <span data-hero-line className="line-mask">
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
        <span className="t-label flex items-center gap-2 text-[var(--color-fg)]">
          HOLD TO
          <span aria-hidden="true" className="spark text-[1.05em] leading-none">
            ⚡
          </span>
          BLAST
        </span>
        <span className="t-label flex items-center gap-2">
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
