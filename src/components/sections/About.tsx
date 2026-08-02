'use client';

import { useRef } from 'react';

import { site } from '@/data/site';
import { gsap, useGsap } from '@/lib/gsap';
import { useSectionShot } from '@/components/useSectionShot';
import { SectionTag, useRailFade } from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

const COPY =
  'I build websites, and I make things move in the browser. Most of what I make sits somewhere between design and engineering. Currently taking on freelance work.';

/**
 * ABOUT — three sentences, first person, no register above plain.
 *
 * The reveal is word-by-word opacity across a pinned scroll: unread words sit
 * at 22% and resolve to full as the scroll passes through them. It is the
 * reference site's best move and it is worth taking, because it makes reading
 * the paragraph the thing the scroll is *for* rather than something you do
 * while waiting for the next section.
 */
export function About() {
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useRailFade(rail);
  const reducedMotion = useScene((s) => s.reducedMotion);

  useSectionShot(root, 'about', 'ABOUT');

  useGsap(
    () => {
      if (reducedMotion) {
        gsap.set('[data-word]', { opacity: 1 });
        return;
      }

      gsap.fromTo(
        '[data-word]',
        { opacity: 0.22 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.4,
          scrollTrigger: {
            trigger: root.current,
            start: 'top 78%',
            end: 'bottom 62%',
            scrub: 1,
          },
        },
      );
    },
    [reducedMotion],
    root,
  );

  return (
    <section
      ref={root}
      id="about"
      aria-label="About"
      className="relative flex min-h-[100svh] flex-col justify-center py-[clamp(6rem,18vh,12rem)]"
    >
      <div className="grid12 gap-y-10">
        {/* The rail sticks under the bar for the length of the section and
            fades before it can reach it — see useRailFade. Row and rule are
            wrapped together so they travel as one; the inner gap reproduces
            the grid's own gap-y-10, so the layout is unchanged. */}
        <div ref={rail} className="col-span-12 flex flex-col gap-y-10">
          <div className="flex items-baseline justify-between">
            <SectionTag name="ABOUT" />
            <span className="t-mono text-[var(--color-fg-dim)]">{site.location}</span>
          </div>
          <div className="h-px bg-[var(--color-rule)]" />
        </div>

        <p className="col-span-12 lg:col-span-9">
          <span className="sr-only">{COPY}</span>
          <span
            aria-hidden="true"
            className="block text-[clamp(1.35rem,3.6vw,3.1rem)] font-[500] leading-[1.16] tracking-[-0.028em]"
          >
            {COPY.split(' ').map((w, i) => (
              <span key={`${w}-${i}`} data-word className="inline-block">
                {w}
                {' '}
              </span>
            ))}
          </span>
        </p>

        <div className="col-span-12 flex flex-wrap gap-x-12 gap-y-4 lg:col-span-9">
          <Meta label="AVAILABLE" value="FREELANCE" accent />
          <Meta label="DISCIPLINES" value="WEB · WEBGL · MOTION" />
          <Meta label="TOOLS" value="NEXT · THREE · GSAP" />
        </div>
      </div>
    </section>
  );
}

function Meta({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span className="flex flex-col gap-1.5">
      <span className="t-label">{label}</span>
      <span
        className={`t-mono ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg)]'}`}
      >
        {value}
      </span>
    </span>
  );
}
