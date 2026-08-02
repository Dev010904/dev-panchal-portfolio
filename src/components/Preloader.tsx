'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { PRELOADER } from '@/config/animation';
import { gsap, useGsap } from '@/lib/gsap';
import { useTicker } from '@/lib/useTicker';
import { getLenis } from '@/components/SmoothScroll';
import { useScene } from '@/store/scene';

const GLYPHS = '▚▞█▓▒░/\\|<>[]{}=+*#@$%&0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NAME = 'DEV PANCHAL';

/**
 * PRELOADER.
 *
 * The counter is driven by drei's useProgress — real asset and shader-compile
 * progress, never a timer. A faked counter is obvious the moment someone loads
 * the site on a slow connection: the number reaches 100 and then nothing
 * happens, which is worse than no preloader at all.
 *
 * The number is lerped toward the real value rather than snapped to it, so it
 * ticks smoothly instead of jumping 0 → 74 → 100 as three chunks land.
 *
 * On exit the black plate splits into vertical panels that leave on a stagger,
 * revealing a hero that has already been rendering behind them for a second.
 * The first frame the visitor sees is mid-motion — never a static pose.
 */
export function Preloader() {
  const [shown, setShown] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);

  const ready = useScene((s) => s.ready);
  const reducedMotion = useScene((s) => s.reducedMotion);
  const setEntered = useScene((s) => s.setEntered);

  const displayed = useRef(0);
  const mountedAt = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    mountedAt.current = performance.now();
    const lenis = getLenis();
    lenis?.stop();
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, []);

  // ── Counter + hairline rule ─────────────────────────────────────────────
  // The counter is lerped toward the real value rather than snapped to it, so
  // it ticks smoothly instead of jumping 0 -> 74 -> 100 as three chunks land.
  const scrambleT = useRef(0);
  const settleAt = useMemo(
    () => Array.from(NAME).map((_, i) => i * PRELOADER.scramble.perLetter),
    [],
  );

  useTicker((delta) => {
    if (!shown) return;

    const target = useScene.getState().progress;
    displayed.current += (target - displayed.current) * PRELOADER.counterLerp;

    const pct = Math.min(Math.round(displayed.current * 100), 100);
    if (counter.current) counter.current.textContent = String(pct).padStart(3, '0');
    if (bar.current) bar.current.style.transform = `scaleX(${displayed.current})`;

    // ── Name resolve out of glyph noise ───────────────────────────────────
    const el = nameRef.current;
    if (!el) return;

    if (reducedMotion) {
      if (el.textContent !== NAME) el.textContent = NAME;
      return;
    }

    scrambleT.current += delta;
    const t = scrambleT.current;
    const last = settleAt[settleAt.length - 1];

    if (t > last + 0.15) {
      if (el.textContent !== NAME) el.textContent = NAME;
      return;
    }

    // Spaces are never scrambled — scrambling them makes the word length pulse
    // and the whole thing reads as a glitch rather than a resolve.
    let out = '';
    for (let i = 0; i < NAME.length; i++) {
      const ch = NAME[i];
      if (ch === ' ') out += ' ';
      else if (t >= settleAt[i]) out += ch;
      else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
  }, shown);

  // ── Exit ────────────────────────────────────────────────────────────────
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
        gsap.delayedCall(0.15, finish);
        return;
      }

      const tl = gsap.timeline({ delay: wait, onComplete: finish });

      tl.to(
        [counter.current, bar.current?.parentElement, nameRef.current?.parentElement],
        { autoAlpha: 0, y: -14, duration: 0.5, stagger: 0.05, ease: 'power2.inOut' },
      ).to(
        '[data-panel]',
        {
          yPercent: -101,
          duration: PRELOADER.exit.duration,
          stagger: PRELOADER.exit.stagger,
          ease: PRELOADER.exit.ease,
        },
        '-=0.18',
      );
    },
    [ready, reducedMotion],
    root,
  );

  if (!shown) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[90] flex items-end"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      {/* Five panels. Odd count so the split is asymmetric — an even split
          reads as a curtain opening, which is a stock transition. */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            data-panel
            className="h-full flex-1 bg-[var(--color-bg)] will-change-transform"
          />
        ))}
      </div>

      <div className="relative z-10 w-full px-[var(--gutter)] pb-[clamp(1.5rem,5vh,3.5rem)]">
        <div className="flex items-end justify-between gap-6">
          <span
            ref={nameRef}
            className="t-display block text-[clamp(2rem,7.5vw,7rem)] leading-[0.9] text-[var(--color-fg)]"
            style={{ fontVariantLigatures: 'none' }}
          >
            {NAME}
          </span>
          <span
            ref={counter}
            className="t-mono shrink-0 text-[clamp(0.85rem,1.4vw,1.1rem)] text-[var(--color-fg-dim)]"
          >
            000
          </span>
        </div>

        <div className="mt-6 h-px w-full bg-[var(--color-rule)]">
          <span
            ref={bar}
            className="block h-px w-full origin-left scale-x-0 bg-[var(--color-fg)]"
          />
        </div>

        <div className="mt-4 flex justify-between">
          <span className="t-label">WEB · 3D · MOTION</span>
          <span className="t-label">LOADING SCENE</span>
        </div>
      </div>
    </div>
  );
}
