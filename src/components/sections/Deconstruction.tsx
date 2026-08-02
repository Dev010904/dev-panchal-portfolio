'use client';

import { useEffect, useRef } from 'react';

import { DECONSTRUCTION, SCROLL } from '@/config/animation';
import { PARTS } from '@/lib/mark/paths';
import { gsap, ScrollTrigger, useGsap } from '@/lib/gsap';
import { useTicker } from '@/lib/useTicker';
import { annotationScreen, markHandles } from '@/scenes/handles';
import { RAIL_TOP, SectionTag, useRailFade } from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

const ANNOTATIONS = DECONSTRUCTION.annotations;
const K = DECONSTRUCTION.keys;

/**
 * THE DECONSTRUCTION — pinned, scroll-scrubbed.
 *
 * One ScrollTrigger with `scrub: 1` writes a single number into
 * markHandles.progress. Everything downstream — part positions, material
 * crossfades, the particle dissolve, the camera track — is a pure function of
 * that number. Nothing here holds animation state of its own, which is what
 * makes the sequence scrub cleanly backwards.
 *
 * `scrub: 1` and not `true`: `true` locks the timeline to the scroll position
 * exactly, and with Lenis already easing the scroll you get a double-eased,
 * slightly rubbery feel. A 1-second catch-up smooths the scrub's own jitter
 * while still tracking the gesture.
 *
 * The annotations are DOM, not 3D text. Real type at real subpixel precision
 * beats an SDF texture at this size, it stays selectable and translatable, and
 * the leader lines can be hairline-crisp because they are SVG.
 */
export function Deconstruction() {
  const root = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useRailFade(rail);
  const annoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const readout = useRef<HTMLSpanElement>(null);

  const reducedMotion = useScene((s) => s.reducedMotion);

  useGsap(
    () => {
      const el = root.current;
      const pinEl = pin.current;
      if (!el || !pinEl) return;

      // Reduced motion: jump to the resolved, fully assembled state and do not
      // pin. The section still exists, still reads, and the object still looks
      // deliberate — it just does not move.
      if (reducedMotion) {
        markHandles.current.progress.value = 0;
        gsap.set('[data-anno]', { autoAlpha: 1 });
        return;
      }

      const state = { p: 0 };

      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: `+=${DECONSTRUCTION.scrollLength * 100}%`,
        pin: pinEl,
        pinSpacing: true,
        scrub: SCROLL.scrub,
        anticipatePin: 1,
        onUpdate: (self) => {
          state.p = self.progress;
          markHandles.current.progress.value = self.progress;
          // Scroll-linked drift for the particle field. Velocity is signed, so
          // the cloud is pulled the way the gesture is going.
          markHandles.current.drift.value = gsap.utils.clamp(
            -0.9,
            0.9,
            self.getVelocity() / 2800,
          );
        },
        onEnter: () => useScene.getState().setSection('THE MARK'),
        onEnterBack: () => useScene.getState().setSection('THE MARK'),
        onLeave: () => {
          markHandles.current.progress.value = 1;
        },
        onLeaveBack: () => {
          markHandles.current.progress.value = 0;
        },
      });

      // Assembly rotation. Driven off the same progress so the resolve angle
      // is deterministic — the monogram has to land head-on at exactly the
      // hold, or the whole reveal misses.
      gsap.to(
        {},
        {
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: `+=${DECONSTRUCTION.scrollLength * 100}%`,
            scrub: SCROLL.scrub,
            onUpdate: (self) => {
              const group = markHandles.current.group;
              if (!group) return;
              const deg = gsap.utils.interpolate(
                DECONSTRUCTION.spin.from,
                DECONSTRUCTION.spin.to,
                easeInOutQuint(self.progress),
              );
              group.rotation.y = (deg * Math.PI) / 180;
            },
          },
        },
      );

      return () => st.kill();
    },
    [reducedMotion],
    root,
  );

  // ── Leader lines + annotations ──────────────────────────────────────────
  // These follow projected 3D anchors, so they are updated in a rAF loop
  // reading a module array rather than through React state.
  useTicker(
    () => {
      const p = markHandles.current.progress.value;

      // Annotations live only between the annotate key and the wireframe flip.
      const inWindow =
        p >= K.annotate.at - 0.02 && p <= K.wireframe.at + K.wireframe.dur * 0.5;

      if (readout.current) {
        readout.current.textContent = `${String(Math.round(p * 100)).padStart(3, '0')}`;
      }

      for (let i = 0; i < ANNOTATIONS.length; i++) {
        const node = annoRefs.current[i];
        const line = lineRefs.current[i];
        const screen = annotationScreen[i];
        if (!node || !screen) continue;

        const lead = i * K.annotate.stagger;
        const local = gsap.utils.clamp(
          0,
          1,
          (p - (K.annotate.at + lead)) / K.annotate.dur,
        );
        const alpha = inWindow && screen.visible ? local : 0;

        node.style.opacity = String(alpha);

        // Annotation card sits out to the side; the leader line bridges the
        // gap back to the part. Offsetting on X only keeps the labels on a
        // tidy column instead of scattering with the geometry.
        const side = ANNOTATIONS[i].side === 'left' ? -1 : 1;
        const offX = side * Math.min(window.innerWidth * 0.19, 240);

        // Clamp into the viewport. Parts travel a long way during the explode,
        // and an annotation that follows one off the edge of the screen is
        // both unreadable and a horizontal-overflow bug waiting to happen. The
        // leader line is what preserves the association, so the label is free
        // to sit still while the part keeps moving.
        const margin = 24;
        const width = node.offsetWidth || 220;
        const min = side === -1 ? margin + width : margin;
        const max = side === -1 ? window.innerWidth - margin : window.innerWidth - margin - width;

        const nx = Math.min(Math.max(screen.x + offX, min), Math.max(min, max));
        const ny = Math.min(Math.max(screen.y, 96), window.innerHeight - 96);
        node.style.transform = `translate3d(${nx}px, ${ny}px, 0) translate(${
          side === -1 ? '-100%' : '0'
        }, -50%)`;

        if (line) {
          line.setAttribute('x1', String(screen.x));
          line.setAttribute('y1', String(screen.y));
          // Draw the line out as the annotation resolves.
          line.setAttribute('x2', String(screen.x + (nx - screen.x) * local));
          line.setAttribute('y2', String(ny));
          line.style.opacity = String(alpha * 0.7);
        }
      }
    },
    !reducedMotion,
  );

  return (
    <section ref={root} id="mark" aria-label="The mark, deconstructed">
      <div ref={pin} className="relative h-[100svh] w-full overflow-hidden">
        {/* Header rail. Held by the pin, so no sticky — just the shared
            clearance token and the shared fade for when the pin releases. */}
        <div ref={rail} className={`grid12 absolute inset-x-0 ${RAIL_TOP} z-20`}>
          <div className="col-span-12 flex flex-wrap items-baseline justify-between gap-4">
            <SectionTag name="THE MARK" />
            <span className="t-mono text-[var(--color-fg-dim)]">
              DP—01 · SEQ <span ref={readout}>000</span>
            </span>
          </div>
          <div className="col-span-12 mt-4 h-px bg-[var(--color-rule)]" />
        </div>

        {/* Leader lines. SVG so they stay hairline at any DPR. */}
        <svg
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          aria-hidden="true"
        >
          {ANNOTATIONS.map((a, i) => (
            <line
              key={a.part}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              stroke="var(--color-rule)"
              strokeWidth="1"
              opacity="0"
            />
          ))}
        </svg>

        {/* Annotation cards */}
        <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
          {ANNOTATIONS.map((a, i) => (
            <div
              key={a.part}
              data-anno
              ref={(el) => {
                annoRefs.current[i] = el;
              }}
              className="absolute left-0 top-0 flex items-center gap-2.5 whitespace-nowrap opacity-0 will-change-transform"
            >
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
              <span aria-hidden="true" className="h-px w-3 bg-[var(--color-rule)]" />
              <span className="t-label text-[var(--color-fg)]">{a.text}</span>
            </div>
          ))}
        </div>

        {/* Standing copy. Sits low-left so it never collides with the object,
            which travels through the upper two thirds of the frame. */}
        <div className="grid12 absolute inset-x-0 bottom-[clamp(2rem,7vh,4.5rem)] z-20">
          <div className="col-span-12 md:col-span-5">
            <p className="t-body max-w-[36ch]">
              One stem, two bowls. The full-height bowl makes a D, the half-height
              bowl makes a P, and they sit at different depths — so the monogram
              only resolves from one angle. Everywhere else it is an object.
            </p>
          </div>
          <div className="col-span-12 mt-6 flex items-end justify-between md:col-span-5 md:col-start-8 md:mt-0">
            <span className="t-label">SCROLL TO DISASSEMBLE</span>
            <span className="t-mono text-[var(--color-fg-dim)]">06 PARTS</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Quintic ease. Slow to leave, slow to arrive, fast through the middle. */
function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}
