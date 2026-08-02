'use client';

import { useEffect, useRef } from 'react';

import { CURSOR } from '@/config/animation';
import { gsap } from '@/lib/gsap';
import { useScene } from '@/store/scene';

/**
 * CUSTOM CURSOR — a ring with a dot inside it.
 *
 * The ring and the dot are damped at different rates. That difference is the
 * whole effect: the dot arrives almost immediately so pointing still feels
 * precise, while the ring trails behind and catches up, which is what reads as
 * weight. Damping both equally gives you a laggy cursor, which is just
 * annoying.
 *
 * Mounted only on `(hover: hover) and (pointer: fine)`. On touch there is no
 * cursor to replace and hiding the native one would be actively harmful.
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

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const r = { x: pos.x, y: pos.y };
    const d = { x: pos.x, y: pos.y };
    let scale = 1;
    let visible = false;

    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!visible) {
        visible = true;
        if (ring.current) ring.current.style.opacity = '1';
        if (dot.current) dot.current.style.opacity = '1';
      }
    };

    const onLeave = () => {
      visible = false;
      if (ring.current) ring.current.style.opacity = '0';
      if (dot.current) dot.current.style.opacity = '0';
    };

    const tick = (_time: number, deltaMs: number) => {
      // Frame-rate independent damping, so the lag that reads as weight feels
      // identical at 60Hz and 144Hz. A fixed lerp factor makes the cursor
      // noticeably snappier on a high-refresh display.
      const dt = Math.min(deltaMs / 1000, 0.05);
      const kr = 1 - Math.exp(-(CURSOR.damping * 60) * dt);
      const kd = 1 - Math.exp(-(CURSOR.dotDamping * 60) * dt);

      r.x += (pos.x - r.x) * kr;
      r.y += (pos.y - r.y) * kr;
      d.x += (pos.x - d.x) * kd;
      d.y += (pos.y - d.y) * kd;

      const goal = useScene.getState().hovering ? CURSOR.hoverScale : 1;
      scale += (goal - scale) * (1 - Math.exp(-9.6 * dt));

      if (ring.current) {
        ring.current.style.transform =
          `translate3d(${r.x.toFixed(2)}px, ${r.y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
        // Pure white, so the difference blend resolves to a clean inversion of
        // whatever is behind it rather than a tinted one.
        ring.current.style.backgroundColor = scale > 1.6 ? '#ffffff' : 'transparent';
      }
      if (dot.current) {
        dot.current.style.transform =
          `translate3d(${d.x.toFixed(2)}px, ${d.y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale > 1.6 ? 0 : 1})`;
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
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
          transition: 'background-color 0.25s var(--ease-move), opacity 0.3s linear',
        }}
      />
      <div
        ref={dot}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[120] hidden rounded-full bg-white opacity-0 mix-blend-difference md:block"
        style={{ width: 3, height: 3, transition: 'opacity 0.3s linear' }}
      />
    </>
  );
}
