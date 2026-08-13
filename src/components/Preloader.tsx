'use client';

import { useEffect, useRef, useState } from 'react';

import { PRELOADER } from '@/config/animation';
import { CadViewport } from '@/components/CadViewport';
import { gsap, useGsap } from '@/lib/gsap';
import { useTicker } from '@/lib/useTicker';
import { getLenis } from '@/components/SmoothScroll';
import { useScene } from '@/store/scene';

const C = PRELOADER.cad;

/**
 * DEV QA HANDLE.
 *
 * On localhost the whole preload is over in a few hundred milliseconds, so
 * every intermediate state of the assembly is unobservable by the only means
 * that matters — looking at it. This exposes the paused timeline so the
 * harness can park it at a known progress and screenshot, and `freeze` stops
 * the real scrub from overwriting that on the next frame.
 *
 * Same pattern as `cursorDebug` and `sweepDebug`: the alternative is verifying
 * a scrubbed sequence by watching it play forwards once, which is exactly the
 * thing docs/PERFORMANCE.md says you cannot find bugs with.
 */
export const preloaderDebug: {
  draw: gsap.core.Timeline | null;
  freeze: boolean;
} = { draw: null, freeze: false };

/**
 * PRELOADER — a CAD viewport that assembles itself.
 *
 * The counter is driven by drei's `useProgress` plus the procedural boot
 * milestones — real asset and shader-compile progress, never a timer. A faked
 * counter is obvious the moment someone loads the site on a slow connection:
 * the number reaches 100 and then nothing happens, which is worse than no
 * preloader at all.
 *
 * THE DRAWING IS SCRUBBED BY THAT SAME REAL PROGRESS.
 *
 * There is one paused GSAP timeline holding the whole assembly sequence, and
 * the frame loop sets its playhead from the damped progress value. So the
 * drawing is not "an animation that runs for about as long as the load" — it
 * is exactly as far along as the site actually is. On a fast connection you
 * see the last third; on a slow one you watch it get drawn. Nothing about the
 * timing is invented, which is the same rule the counter has always followed.
 *
 * ONE RESOLUTION EVENT.
 *
 * The wordmark is static hairline type from the first frame — it does not
 * scramble, resolve or move. The previous version resolved it out of glyph
 * noise WHILE the counter climbed and the panels split, which is three
 * competing resolutions on one screen; the eye has nowhere to go and the
 * moment that should land — the drawing becoming the object — lands on a
 * screen already full of motion. Now there is exactly one: the outlines take
 * their fill, the construction furniture strips away, the assembly pushes
 * toward the camera, and the panels split off it.
 */
export function Preloader() {
  const [shown, setShown] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  const ready = useScene((s) => s.ready);
  const reducedMotion = useScene((s) => s.reducedMotion);
  const setEntered = useScene((s) => s.setEntered);

  const displayed = useRef(0);
  const shownPct = useRef(-1);
  const mountedAt = useRef(0);
  const done = useRef(false);

  /**
   * The assembly timeline, paused. Built once; scrubbed every frame.
   * `null` until the effect below runs, and every read is guarded — a frame
   * can land between mount and build.
   */
  const draw = useRef<gsap.core.Timeline | null>(null);
  /** Latched once the resolution starts, so the scrub stops fighting it. */
  const resolving = useRef(false);
  const wroteDraw = useRef(-1);

  useEffect(() => {
    mountedAt.current = performance.now();
    const lenis = getLenis();
    lenis?.stop();
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, []);

  // ── The assembly sequence ───────────────────────────────────────────────
  // Normalised to a duration of 1 so `progress()` and real load progress are
  // the same number, and the phase fractions in the config mean what they say.
  useGsap(
    () => {
      const P = C.phases;
      const tl = gsap.timeline({ paused: true });

      /**
       * DRAW-ON, for solid strokes.
       *
       * Real `getTotalLength()` rather than `pathLength="1"` normalisation —
       * see the long note in CadViewport.tsx for why the normalised form
       * silently renders every element fully drawn. Measured once here, at
       * mount, never per frame, and only while the preloader is up.
       */
      const drawOn = (sel: string, at: number, dur: number, stagger = 0) => {
        const els = gsap.utils.toArray<SVGGeometryElement>(sel);
        for (const el of els) {
          const len = el.getTotalLength();
          el.style.strokeDasharray = String(len);
          el.style.strokeDashoffset = String(len);
        }
        tl.to(els, { strokeDashoffset: 0, duration: dur, stagger, ease: 'none' }, at);
      };

      /**
       * EXTEND, for lines — including the dashed datums, which cannot use
       * dasharray for their reveal because they need it for their appearance.
       * The endpoint travels from the start point to where it was authored.
       * Captured into a dataset first so the "to" value cannot be read back
       * after the "from" has already overwritten the attribute.
       */
      const extend = (
        sel: string,
        axis: 'x2' | 'y2',
        from: 'x1' | 'y1',
        at: number,
        dur: number,
        stagger = 0,
      ) => {
        const els = gsap.utils.toArray<SVGLineElement>(sel);
        for (const el of els) {
          if (!el.dataset.endValue) el.dataset.endValue = el.getAttribute(axis)!;
        }
        tl.fromTo(
          els,
          { attr: { [axis]: (i: number, el: SVGLineElement) => Number(el.getAttribute(from)) } },
          {
            attr: { [axis]: (i: number, el: SVGLineElement) => Number(el.dataset.endValue) },
            duration: dur,
            stagger,
            ease: 'none',
          },
          at,
        );
      };

      /** STRUCK, for the construction circles: `r` from 0, the way a compass
       *  actually produces an arc. */
      const strike = (sel: string, at: number, dur: number, stagger = 0) => {
        const els = gsap.utils.toArray<SVGCircleElement>(sel);
        tl.fromTo(
          els,
          { attr: { r: 0 } },
          {
            attr: { r: (i: number, el: SVGCircleElement) => Number(el.dataset.r) },
            duration: dur,
            stagger,
            ease: 'none',
          },
          at,
        );
      };

      // `ease: none` throughout: this is scrubbed by real load progress, and
      // easing a scrubbed timeline makes the drawing appear to speed up and
      // slow down for reasons that have nothing to do with what it reports.
      drawOn('[data-cad-frame]', 0, 0.3);
      drawOn('[data-cad-title-rule]', 0.06, 0.2);
      tl.to('[data-cad-title]', { opacity: 1, duration: 0.14, stagger: 0.05, ease: 'none' }, 0.1);

      // Verticals drop first, then horizontals cross them — the order a sheet
      // is actually set up in.
      extend('[data-cad-grid][data-grow="y2"]', 'y2', 'y1', P.grid.at, P.grid.dur, P.grid.stagger);
      extend('[data-cad-grid][data-grow="x2"]', 'x2', 'x1', P.grid.at + 0.06, P.grid.dur, P.grid.stagger);
      extend('[data-cad-datum]', 'x2', 'x1', P.datum.at, P.datum.dur, 0.04);
      tl.to('[data-cad-datum-label]', { opacity: 1, duration: 0.12, ease: 'none' }, P.datum.at + P.datum.dur * 0.6);

      drawOn('[data-cad-outline]', P.outline.at, P.outline.dur, P.outline.stagger);
      strike('[data-cad-circle]', P.circles.at, P.circles.dur, P.circles.stagger);
      drawOn('[data-cad-bolt]', P.circles.at + 0.06, P.circles.dur * 0.6, P.circles.stagger);

      // Control points SNAP in — the one place a back ease belongs, because a
      // control point landing on a vertex is a discrete event, not a sweep.
      tl.to(
        '[data-cad-point]',
        // 1.7 grid units, which is ~4px on the sheet. At 2.6 they rendered as
        // rings sitting on the vertices rather than as points marking them.
        { attr: { r: 1.7 }, duration: P.points.dur, stagger: P.points.stagger, ease: 'back.out(2.2)' },
        P.points.at,
      );

      drawOn('[data-cad-dim]', P.dims.at, P.dims.dur, P.dims.stagger);
      tl.to('[data-cad-dim-label]', { opacity: 1, duration: 0.1, stagger: P.dims.stagger, ease: 'none' }, P.dims.at + 0.1);

      drawOn('[data-cad-leader]', P.leader.at, P.leader.dur);
      tl.to('[data-cad-leader-label]', { opacity: 1, duration: 0.1, ease: 'none' }, P.leader.at + P.leader.dur * 0.5);

      draw.current = tl;
      preloaderDebug.draw = tl;
      return () => {
        tl.kill();
        draw.current = null;
        preloaderDebug.draw = null;
      };
    },
    [],
    root,
  );

  // ── Counter, bar, and the drawing's playhead ────────────────────────────
  useTicker((delta) => {
    if (!shown) return;

    const target = useScene.getState().progress;
    displayed.current +=
      (target - displayed.current) * (1 - Math.exp(-PRELOADER.counterRate * delta));

    // Only touched when the rendered digits actually change. The counter is
    // three characters, so it changes at most 100 times across the whole
    // preload no matter how many frames that takes.
    const pct = Math.min(Math.round(displayed.current * 100), 100);
    if (pct !== shownPct.current) {
      shownPct.current = pct;
      if (counter.current) counter.current.textContent = String(pct).padStart(3, '0');
      if (bar.current) bar.current.style.transform = `scaleX(${displayed.current})`;
    }

    // Scrub the drawing. Quantised to 1e-3 and written on change, so a frame
    // where progress has not moved does not re-evaluate a 45-target timeline.
    // Stops entirely once the resolution has taken over — otherwise the scrub
    // and the resolve timeline would both be writing the same properties.
    if (resolving.current || preloaderDebug.freeze) return;
    const tl = draw.current;
    if (!tl) return;
    const p = Math.round(Math.min(displayed.current, 1) * 1000) / 1000;
    if (p !== wroteDraw.current) {
      wroteDraw.current = p;
      tl.progress(p);
    }
  }, shown);

  // ── The resolution, then the exit ───────────────────────────────────────
  useGsap(
    () => {
      if (!ready || done.current) return;
      done.current = true;

      const elapsed = (performance.now() - mountedAt.current) / 1000;
      const wait = Math.max(0, PRELOADER.minDuration - elapsed);

      const finish = () => {
        setShown(false);
        setEntered(true);
        document.documentElement.style.overflow = '';
        getLenis()?.start();
      };

      if (reducedMotion) {
        // No assembly, no handoff: the drawing is simply complete and the
        // plate lifts. `progress(1)` rather than a tween, so nothing moves.
        draw.current?.progress(1);
        resolving.current = true;
        gsap.delayedCall(0.15, finish);
        return;
      }

      const R = C.resolve;
      const tl = gsap.timeline({
        delay: wait,
        onStart: () => {
          // Hand the drawing over before anything else touches it.
          draw.current?.progress(1);
          resolving.current = true;
        },
        onComplete: finish,
      });

      // 1 — the outlines take their fill. The drawing becomes an object.
      tl.to('[data-cad-outline]', {
        fillOpacity: 1,
        duration: R.solidify.duration,
        ease: R.solidify.ease,
      });

      // 2 — every piece of construction furniture leaves, so what is left is
      //     the mark alone. Overlapped with the fill: the two together are one
      //     event, and sequencing them reads as two.
      tl.to(
        '[data-cad-grid], [data-cad-circle], [data-cad-bolt], [data-cad-dim], [data-cad-dim-label], [data-cad-datum], [data-cad-datum-label], [data-cad-leader], [data-cad-leader-label], [data-cad-point], [data-cad-frame], [data-cad-title], [data-cad-title-rule]',
        { opacity: 0, duration: R.strip.duration, ease: R.strip.ease },
        '-=0.34',
      );

      // 3 — the sheet pushes toward the camera and gives way to the real mark,
      //     which has been rendering behind this plate the whole time.
      tl.to(
        '[data-cad-root]',
        {
          scale: R.handoff.scale,
          opacity: 0,
          transformOrigin: '68% 38%',
          duration: R.handoff.duration,
          ease: R.handoff.ease,
        },
        '-=0.16',
      );

      // The readout goes with it.
      tl.to(
        '[data-preloader-readout]',
        { autoAlpha: 0, y: -14, duration: 0.45, ease: 'power2.inOut' },
        '-=0.5',
      );

      // 4 — the panels split off the handoff.
      tl.to(
        '[data-panel]',
        {
          yPercent: -101,
          duration: PRELOADER.exit.duration,
          stagger: PRELOADER.exit.stagger,
          ease: PRELOADER.exit.ease,
        },
        '-=0.42',
      );
    },
    [ready, reducedMotion],
    root,
  );

  if (!shown) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[90]"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      {/* Five panels. Odd count so the split is asymmetric — an even split
          reads as a curtain opening, which is a stock transition.

          `-mr-px` is not cosmetic. Five `flex-1` panels across a viewport
          whose width is not divisible by five land on fractional boundaries —
          313.6px, 627.2px and so on at 1568px — and the browser rounds each
          edge independently, leaving hairline gaps between neighbours. The
          scene is rendering live behind this plate, so those gaps read as two
          or three short bright slivers wherever the mark or a sweep line
          happens to sit behind a seam. It looks like a rendering fault in the
          preloader and it has been visible since the panels were introduced.
          One pixel of overlap closes them; the panels leave vertically, so
          overlapping horizontally costs nothing. */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            data-panel
            className="-mr-px h-full flex-1 bg-[var(--color-bg)] will-change-transform"
          />
        ))}
      </div>

      {/* The drawing. Sits above the panels and leaves before they do. */}
      <div className="absolute inset-0">
        <CadViewport />
      </div>

      {/* Readout. The one part of this screen that is not the drawing. */}
      <div
        data-preloader-readout
        className="absolute inset-x-0 bottom-0 z-10 px-[var(--gutter)] pb-[clamp(1rem,3.5vh,2.25rem)]"
      >
        <div className="h-px w-full bg-[var(--color-rule)]">
          <span
            ref={bar}
            className="block h-px w-full origin-left scale-x-0 bg-[var(--color-fg)]"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="t-label">WEB · 3D · MOTION</span>
          <div className="flex items-baseline gap-4">
            <span className="t-label">COMPILING SCENE</span>
            <span
              ref={counter}
              className="t-mono tabular-nums text-[var(--color-fg)]"
            >
              000
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
