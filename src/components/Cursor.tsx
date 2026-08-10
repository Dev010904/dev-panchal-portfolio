'use client';

import { useEffect, useRef } from 'react';

import { CURSOR } from '@/config/animation';
import { pointerHandle } from '@/lib/pointer';
import { addStep } from '@/lib/steps';
import { useScene } from '@/store/scene';

/**
 * CUSTOM CURSOR — an exact dot with a weighted ring around it.
 *
 * THE SHAPE OF THE FIX
 * The dot is now rendered at the RAW pointer position with no damping at all,
 * and the ring is damped with a rate that rises with pointer speed. Two
 * different jobs, solved separately:
 *
 *   the dot   is what you point with, so it must be exact. Zero lag, always,
 *             at any speed. Nothing about "weight" justifies a crosshair that
 *             is not where the mouse is.
 *   the ring  is what carries character, so it keeps its damping — but with a
 *             hard ceiling on how far it may trail (CURSOR.maxTrail).
 *
 * WHY NOT THE OTHER TWO OPTIONS
 *
 *   Velocity-adaptive damping ALONE was considered and is not sufficient. It
 *   bounds the gap but cannot take it to zero — a bounded error is still an
 *   error, and the element you aim with is the one place a visible offset is
 *   never acceptable. It is used here, but on the ring, where a bounded trail
 *   is the desired behaviour rather than a compromise.
 *
 *   `pointerrawupdate` was rejected. It buys sub-frame input resolution, and
 *   the win is strictly less than one frame because everything downstream still
 *   renders on the frame. The cost is a second event path feeding the same
 *   shared pointer, which is precisely the duplication this component just
 *   stopped doing. If the site ever draws the cursor off the main thread it
 *   becomes worth revisiting; today it is not.
 *
 * Both read the SHARED pointer (lib/pointer.ts). This component used to run its
 * own `pointermove` listener alongside SceneRoot's — two handlers per move and
 * two disagreeing notions of where the cursor was.
 *
 * Mounted only on `(hover: hover) and (pointer: fine)`. On touch there is no
 * cursor to replace and hiding the native one would be actively harmful.
 */

/** Live positions, for the QA harness. Never read by the component itself. */
export const cursorDebug = {
  ringX: 0,
  ringY: 0,
  dotX: 0,
  dotY: 0,
  targetX: 0,
  targetY: 0,
};

/**
 * `cursorStep` used to be exported here so the QA harness could drive the
 * cursor by hand. It is gone: the cursor now registers through the step
 * registry (lib/steps.ts), so `__qa.tick()` advances it along with every other
 * DOM-side readout, and a per-component escape hatch is exactly the pattern the
 * registry replaces.
 *
 * The history is worth keeping. `gsap.updateRoot()` advances the global
 * timeline but does not dispatch `gsap.ticker` callbacks, so before the
 * registry existed nothing registered with `ticker.add` was ever stepped by the
 * harness — and the first attempt to measure cursor damping through it returned
 * zeros at every speed, faithfully reporting a cursor that had never moved.
 */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const enabled = useRef(false);

  const reducedMotion = useScene((s) => s.reducedMotion);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!mq.matches || reducedMotion) return;

    enabled.current = true;
    document.documentElement.classList.add('has-cursor');

    const r = { x: pointerHandle.x, y: pointerHandle.y };
    let scale = 1;
    let visible = false;
    let prevX = pointerHandle.x;
    let prevY = pointerHandle.y;

    // Last values actually written to the DOM. Every style write below is
    // guarded on these: assigning an identical string still enters the CSSOM
    // and dirties the element, and this runs 60+ times a second forever.
    let wroteFilled = -1;
    let wroteVisible = -1;

    const step = (dtRaw: number) => {
      const dt = Math.min(dtRaw, 0.05);
      const px = pointerHandle.x;
      const py = pointerHandle.y;

      // ── Speed estimate, CSS px per frame ──────────────────────────────────
      // Smoothed, because a raw per-frame delta is noisy enough that the
      // adaptive rate below would chatter and the ring would visibly stiffen
      // and soften during a single movement.
      const step = Math.hypot(px - prevX, py - prevY);
      prevX = px;
      prevY = py;
      pointerHandle.speed +=
        (step - pointerHandle.speed) * (1 - Math.exp(-CURSOR.speedSmoothing * dt));

      // ── Ring: damped, with a ceiling on the trail ─────────────────────────
      // Frame-rate independent base rate, so the weight feels identical at
      // 60Hz and 144Hz. Then raised to whatever holds the steady-state error
      // e = v / a at or under maxTrail. At rest the base rate wins and the
      // ring keeps exactly the character it always had.
      const base = 1 - Math.exp(-(CURSOR.damping * 60) * dt);
      const needed = pointerHandle.speed / CURSOR.maxTrail;
      const a = Math.min(1, Math.max(base, needed));

      r.x += (px - r.x) * a;
      r.y += (py - r.y) * a;

      const goal = useScene.getState().hovering ? CURSOR.hoverScale : 1;
      scale += (goal - scale) * (1 - Math.exp(-9.6 * dt));

      const filled = scale > 1.6 ? 1 : 0;
      const show = pointerHandle.present ? 1 : 0;
      if (show !== wroteVisible) {
        wroteVisible = show;
        visible = !!show;
        if (ring.current) ring.current.style.opacity = show ? '1' : '0';
        if (dot.current) dot.current.style.opacity = show ? '1' : '0';
      }

      if (ring.current) {
        // Rounded to whole device pixels via `| 0` on a pre-scaled value rather
        // than toFixed(): toFixed allocates a string per call, three per frame,
        // ~180 strings a second for digits nobody can see.
        ring.current.style.transform =
          'translate3d(' + Math.round(r.x * 100) / 100 + 'px,' +
          Math.round(r.y * 100) / 100 + 'px,0) translate(-50%,-50%) scale(' +
          Math.round(scale * 1000) / 1000 + ')';
        if (filled !== wroteFilled) {
          // Pure white, so the difference blend resolves to a clean inversion
          // of whatever is behind it rather than a tinted one.
          ring.current.style.backgroundColor = filled ? '#ffffff' : 'transparent';
        }
      }

      // ── Dot: exact. No damping, no rounding, no conditions. ───────────────
      if (dot.current) {
        dot.current.style.transform =
          'translate3d(' + px + 'px,' + py + 'px,0) translate(-50%,-50%) scale(' +
          (filled ? 0 : 1) + ')';
      }

      if (filled !== wroteFilled) wroteFilled = filled;

      cursorDebug.ringX = r.x;
      cursorDebug.ringY = r.y;
      cursorDebug.dotX = px;
      cursorDebug.dotY = py;
      cursorDebug.targetX = px;
      cursorDebug.targetY = py;
      void visible;
    };

    const unstep = addStep((delta) => step(delta));

    return () => {
      unstep();
      document.documentElement.classList.remove('has-cursor');
    };
  }, [reducedMotion]);

  /*
   * NO WRAPPER ELEMENT, AND THAT IS THE WHOLE FIX.
   *
   * These used to sit inside a `fixed inset-0 z-[120]` div. A positioned
   * element with a z-index creates a stacking context, and `mix-blend-mode`
   * blends against the backdrop of its PARENT stacking context — which, inside
   * that wrapper, was nothing at all. So the blend silently did nothing and the
   * cursor painted as flat white everywhere. Invisible the moment it crossed
   * the white menu panel.
   *
   * Hoisting them to the root stacking context gives the blend the actual page
   * as its backdrop, so the cursor inverts against whatever is under it: white
   * on the near-black site, black on the drawer. Nothing needs to know which.
   *
   * The elements carry their own z-index; an element may create a stacking
   * context itself and still blend with its parent's backdrop.
   */
  return (
    <>
      <div
        ref={ring}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[120] hidden rounded-full border border-white opacity-0 mix-blend-difference md:block"
        style={{
          width: CURSOR.size,
          height: CURSOR.size,
          // Promoted to its own compositor layer. Without it the ring is
          // repainted into a shared layer every frame, and on this page that
          // layer contains the whole fixed canvas.
          willChange: 'transform',
          transition: 'background-color 0.25s var(--ease-move), opacity 0.3s linear',
        }}
      />
      <div
        ref={dot}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[120] hidden rounded-full bg-white opacity-0 mix-blend-difference md:block"
        style={{
          width: 3,
          height: 3,
          willChange: 'transform',
          transition: 'opacity 0.3s linear',
        }}
      />
    </>
  );
}
