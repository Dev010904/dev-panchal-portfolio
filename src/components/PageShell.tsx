'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import type { PageDef } from '@/data/pages';
import { PAGES } from '@/data/pages';
import { gsap, useGsap } from '@/lib/gsap';
import { PageLoader } from '@/components/PageLoader';
import { PageFooter } from '@/components/PageFooter';
import { ArrowLink } from '@/components/ui/ArrowLink';
import { CornerMarks, SectionTag, useFooterFloor, useRailFade } from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

/**
 * Shared layout for the interior pages.
 *
 * The 3D structure for the page renders in the persistent canvas behind this;
 * the DOM only sets the scene state and composites type over it. There is no
 * per-page canvas and nothing unmounts on navigation, which is why moving
 * between pages is a camera move rather than a reload.
 */
export function PageShell({ page }: { page: PageDef }) {
  const root = useRef<HTMLElement>(null);
  const footer = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const setStructure = useScene((s) => s.setStructure);
  const setShot = useScene((s) => s.setShot);
  const setSection = useScene((s) => s.setSection);
  const entered = useScene((s) => s.entered);

  useFooterFloor(footer);
  useRailFade(rail);

  useEffect(() => {
    setStructure(page.structure);
    setShot(page.shot);
    setSection(page.label.toUpperCase());
    return () => setStructure(null);
  }, [page, setStructure, setShot, setSection]);

  useGsap(
    () => {
      if (!entered) return;

      gsap
        .timeline({ delay: 0.1 })
        .fromTo(
          '[data-page-line] > span',
          { yPercent: 112 },
          { yPercent: 0, duration: 1.15, stagger: 0.08, ease: 'expo.out' },
        )
        .fromTo(
          '[data-page-fade]',
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.06, ease: 'power3.out' },
          '-=0.75',
        );

      gsap.fromTo(
        '[data-entry]',
        { autoAlpha: 0, y: 30 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          stagger: 0.09,
          ease: 'power3.out',
          scrollTrigger: { trigger: '[data-entries]', start: 'top 78%' },
        },
      );
    },
    [entered, page.slug],
    root,
  );

  const others = PAGES.filter((p) => p.slug !== page.slug);

  return (
    <article ref={root} className="relative">
      {/* Keyed on the slug so navigating between two interior pages remounts it
          and the transition plays again. Without the key React would reuse the
          instance, see no state change, and the second route change would
          arrive uncovered. */}
      <PageLoader key={page.slug} label={page.label} spec={page.structureLabel} />

      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      {/*
        Top padding is derived from the bar's own height rather than guessed at
        with a second clamp, so the label starts clear of it at every viewport
        instead of only at the tall ones. See --nav-h in globals.css.
      */}
      <header className="relative flex min-h-[92svh] flex-col pb-[clamp(2rem,6vh,4rem)] pt-[calc(var(--nav-h)+var(--nav-clear))]">
        <CornerMarks />

        {/*
          The label rail sticks under the bar instead of scrolling into it.

          Clearance alone does not fix this: the row is in normal flow under a
          fixed, difference-blended bar, so about 120px of scroll used to put
          `CREDENTIALS` exactly on top of the `DEV PANCHAL` wordmark and the
          spec on top of the MENU chip, with both unreadable.

          The sticky is BOUNDED by this flex-1 wrapper, which ends where the
          headline begins. So the rail holds its place under the bar while the
          masthead is being read and is then carried away by its own container —
          it can neither enter the bar nor cross the headline.
        */}
        <div className="flex-1">
          <div
            ref={rail}
            className="grid12 sticky top-[calc(var(--nav-h)+var(--nav-clear))] z-30 gap-y-6"
          >
            <div className="col-span-12 flex flex-wrap items-baseline justify-between gap-4">
              <SectionTag name={page.label.toUpperCase()} />
              <span className="t-mono text-[var(--color-fg-dim)]">{page.structureLabel}</span>
            </div>
            <div className="col-span-12 h-px bg-[var(--color-rule)]" />
          </div>
        </div>

        <div className="grid12 gap-y-8">
          <h1 className="col-span-12 lg:col-span-7">
            <span className="sr-only">{page.headlineLines.join(' ')}</span>
            <span aria-hidden="true" className="t-display block">
              {page.headlineLines.map((line, i) => (
                <span key={i} data-page-line className="line-mask">
                  <span className="block will-change-transform">{line}</span>
                </span>
              ))}
            </span>
          </h1>

          <p
            data-page-fade
            className="t-lead col-span-12 max-w-[38ch] text-[var(--color-fg-dim)] opacity-0 lg:col-span-5 lg:col-start-8 lg:self-end"
          >
            {page.standfirst}
          </p>
        </div>
      </header>

      {/* ── Entries ──────────────────────────────────────────────────────── */}
      <section data-entries className="relative py-[clamp(3rem,10vh,7rem)]">
        <div className="grid12 gap-y-0">
          {page.entries.map((e) => (
            <div
              key={e.title}
              data-entry
              className="col-span-12 grid grid-cols-12 gap-x-[inherit] gap-y-4 border-t border-[var(--color-rule)] py-[clamp(1.75rem,4vh,3rem)] opacity-0"
            >
              <h2 className="col-span-12 text-[clamp(1.35rem,2.6vw,2.1rem)] font-[700] tracking-[-0.03em] lg:col-span-5">
                {e.title}
              </h2>
              <p className="t-body col-span-12 max-w-[62ch] lg:col-span-6 lg:col-start-7">
                {e.body}
              </p>
            </div>
          ))}
          <div className="col-span-12 border-t border-[var(--color-rule)]" />
        </div>

        <div className="grid12 mt-[clamp(2rem,6vh,4rem)]">
          <p className="t-lead col-span-12 max-w-[44ch] text-[var(--color-fg)] lg:col-span-7">
            {page.outro}
          </p>
        </div>
      </section>

      {/* ── Onward ───────────────────────────────────────────────────────── */}
      <nav
        ref={footer}
        aria-label="More pages"
        className="relative py-[clamp(3rem,10vh,7rem)]"
      >
        <div className="grid12 gap-y-6">
          <span className="t-label col-span-12">KEEP LOOKING</span>
          <div className="col-span-12 h-px bg-[var(--color-rule)]" />

          {others.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className="group col-span-12 flex items-baseline justify-between gap-6 border-b border-[var(--color-rule)] py-[clamp(1.25rem,3vh,2.25rem)]"
            >
              <span className="t-h2 transition-transform duration-700 ease-[var(--ease-reveal)] group-hover:translate-x-3">
                {p.label}
              </span>
              <span className="t-label hidden text-right md:block">{p.standfirst}</span>
              <span aria-hidden="true" className="t-mono text-[var(--color-accent)]">
                ↗
              </span>
            </Link>
          ))}

          <div className="col-span-12 pt-[clamp(1.5rem,4vh,3rem)]">
            <ArrowLink label="BACK TO INDEX" href="/" tone="accent" />
          </div>
        </div>
      </nav>

      {/* Each interior page closes on its own composition — see PageFooter. */}
      <PageFooter slug={page.slug} />
    </article>
  );
}
