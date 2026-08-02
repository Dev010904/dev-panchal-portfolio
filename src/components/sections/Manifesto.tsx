'use client';

import { useRef } from 'react';

import { gsap, useGsap } from '@/lib/gsap';
import { CornerMarks, SectionTag, useRailFade } from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

/**
 * THE MANIFESTO.
 *
 * A statement about how the work actually gets made, delivered one line at a
 * time as the scroll passes through it.
 *
 * WHY LINE BY LINE AND NOT WORD BY WORD
 * About already does the reference site's word-opacity resolve, and doing it
 * twice on one page turns a signature move into a tic. More importantly this
 * copy is argued rather than descriptive — each line is a separate beat, and
 * revealing it a word at a time would let the eye run ahead and read the
 * conclusion before the setup. A line is the unit of meaning here, so a line is
 * the unit of reveal.
 *
 * The stagger is scrubbed rather than played, so scrolling back up un-reveals
 * it in order instead of leaving the whole block lit.
 */

/** Each string is one beat. Blank-ish short lines are deliberate pauses. */
const LINES = [
  'People really believe AI made this...',
  'That’s one of the biggest misconceptions I see.',
  'AI didn’t wake up and design an incredible website on its own.',
  'Behind every premium project is someone making creative decisions, refining the output, and knowing exactly what to ask for.',
  'AI is a multiplier.',
  'Not a replacement for good thinking.',
  'The better your direction, the better your result.',
  'That’s why two people using the same tool can create completely different outcomes.',
] as const;

/**
 * Lines that carry the argument's turn, set larger and in the full foreground.
 * The rest sit a step down, so the block has a rhythm rather than being eight
 * equal sentences stacked up.
 */
const EMPHASIS = new Set([4, 5, 6]);

export function Manifesto() {
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useRailFade(rail);
  const reducedMotion = useScene((s) => s.reducedMotion);

  useGsap(
    () => {
      if (reducedMotion) {
        gsap.set('[data-manifesto-line]', { opacity: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        '[data-manifesto-line]',
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          ease: 'power2.out',
          // Each line gets its own slice of the scroll. `stagger` with a scrub
          // is what makes them arrive strictly in order at any scroll speed —
          // a set of independent triggers would let a fast flick fire several
          // at once and the argument would land out of sequence.
          stagger: 0.55,
          duration: 0.7,
          scrollTrigger: {
            trigger: root.current,
            // Eight lines need more than one viewport of scroll between them,
            // or the last three arrive almost together and the argument stops
            // reading as a sequence. Paired with the taller section below.
            start: 'top 78%',
            end: 'bottom 55%',
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
      id="notes-on-ai"
      aria-label="On how this was made"
      className="relative flex min-h-[135svh] flex-col justify-center py-[clamp(6rem,18vh,12rem)]"
    >
      <CornerMarks />

      <div className="grid12 gap-y-10">
        {/* Sticky rail, faded before it reaches the bar — see useRailFade. */}
        <div ref={rail} className="col-span-12 flex flex-col gap-y-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <SectionTag name="ON THE WORK" />
            <span className="t-mono text-[var(--color-fg-dim)]">DIRECTION · NOT PROMPTS</span>
          </div>
          <div className="h-px bg-[var(--color-rule)]" />
        </div>

        <div className="col-span-12 flex flex-col gap-[clamp(0.9rem,2.4vh,1.9rem)] lg:col-span-10">
          {LINES.map((line, i) => (
            <p
              key={i}
              data-manifesto-line
              className={
                EMPHASIS.has(i)
                  ? 'max-w-[24ch] text-[clamp(1.5rem,3.4vw,2.9rem)] font-[500] leading-[1.14] tracking-[-0.03em] text-[var(--color-fg)] opacity-0'
                  : 'max-w-[46ch] text-[clamp(1.05rem,1.9vw,1.55rem)] font-[400] leading-[1.36] tracking-[-0.015em] text-[var(--color-fg-dim)] opacity-0'
              }
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
