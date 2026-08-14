'use client';

import { useEffect, useRef, useState } from 'react';

import { BLAST } from '@/config/animation';
import { gsap, useGsap } from '@/lib/gsap';
import { useSectionShot } from '@/components/useSectionShot';
import { CornerMarks, SectionTag, useRailFade } from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

/**
 * THE LAB.
 *
 * The section that exists to be played with. The field itself lives in the
 * persistent scene (scenes/LabField); this is the frame around it.
 *
 * The DOM here is deliberately almost empty. Anything placed over the middle
 * of the viewport is something the cursor cannot reach, and the entire point
 * of the section is that the cursor can reach all of it.
 */
export function Lab() {
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useRailFade(rail);
  const [hinted, setHinted] = useState(false);
  const hint = useRef<HTMLSpanElement>(null);

  useSectionShot(root, 'lab', 'LAB');

  const reducedMotion = useScene((s) => s.reducedMotion);
  const active = useScene((s) => s.activeSection === 'LAB');
  const labCount = useScene((s) => s.labCount);

  useGsap(
    () => {
      gsap.fromTo(
        '[data-lab-reveal]',
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          stagger: 0.09,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 65%' },
        },
      );
    },
    [],
    root,
  );

  // The hold-to-detonate hint pulses once, a beat after the section settles.
  // Long enough that it does not compete with the field resolving; short
  // enough that people are still looking.
  useEffect(() => {
    if (!active || hinted || reducedMotion) return;
    const id = window.setTimeout(() => {
      setHinted(true);
      if (hint.current) {
        gsap.fromTo(
          hint.current,
          { color: 'var(--color-fg-dim)' },
          {
            color: 'var(--color-accent)',
            duration: 0.5,
            yoyo: true,
            repeat: 3,
            ease: 'power2.inOut',
          },
        );
      }
    }, 2600);
    return () => window.clearTimeout(id);
  }, [active, hinted, reducedMotion]);

  return (
    <section
      ref={root}
      id="lab"
      aria-label="Interactive particle field"
      className="relative flex min-h-[110svh] flex-col justify-between py-[clamp(5rem,14vh,9rem)]"
    >
      <CornerMarks />

      <div ref={rail} className="grid12 items-start gap-y-4">
        <div className="col-span-12 flex flex-wrap items-baseline justify-between gap-4">
          <SectionTag name="THE LAB" />
          {/* The live count off the resolved tier, never a constant. This said
              "46K POINTS · GPU" while the GPU path was running 350,464. */}
          <span className="t-mono text-[var(--color-fg-dim)]">
            {labCount > 0 ? `${(labCount / 1000).toFixed(0)}K POINTS · GPU` : 'GPU'}
          </span>
        </div>
        <div className="col-span-12 mt-2 h-px bg-[var(--color-rule)]" />
      </div>

      <div className="grid12 mt-auto items-end gap-y-8">
        <div data-blast className="col-span-12 md:col-span-5">
          <p data-lab-reveal className="t-body max-w-[34ch] opacity-0">
            A field of points held in formation by a field you can push around.
            Nothing here is a video.
          </p>
        </div>

        <div
          data-lab-reveal
          className="col-span-12 flex flex-col items-start gap-2 opacity-0 md:col-span-5 md:col-start-8 md:items-end"
        >
          <span className="t-label flex items-center gap-3">
            <span className="h-px w-6 bg-[var(--color-rule)]" />
            MOVE TO SCATTER
          </span>
          <span className="t-label flex items-center gap-3">
            <span className="h-px w-6 bg-[var(--color-rule)]" />
            CLICK FOR A SHOCKWAVE
          </span>
          <span ref={hint} className="t-label flex items-center gap-3">
            <span className="h-px w-6 bg-[var(--color-rule)]" />
            {/* Read off BLAST.holdMs rather than typed, so the label and the
                threshold cannot disagree — which they did when the hold was
                retimed and this still said 3s. */}
            HOLD {BLAST.holdMs / 1000}s TO DETONATE —
          </span>
        </div>
      </div>
    </section>
  );
}
