'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { RAIL } from '@/config/animation';
import { addStep } from '@/lib/steps';
import { useScene } from '@/store/scene';

/**
 * Structural furniture. Hairline rules and `+` corner marks do the work that
 * borders and cards would otherwise do — they read as precision instrumentation
 * and, unlike a card, they cost nothing and cannot look like a template.
 */

export function Rule({ className = '' }: { className?: string }) {
  return <div className={`rule ${className}`} role="presentation" />;
}

/** A `+` registration mark. Four of these define an area without drawing a box. */
export function Plus({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute block h-[9px] w-[9px] ${className}`}
    >
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--color-rule)]" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[var(--color-rule)]" />
    </span>
  );
}

/** The four corner marks of a section. */
export function CornerMarks({ inset = 'var(--gutter)' }: { inset?: string }) {
  const s = { '--i': inset } as React.CSSProperties;
  return (
    <div className="pointer-events-none absolute inset-0 z-10" style={s} aria-hidden="true">
      <Plus className="left-[var(--i)] top-[var(--i)]" />
      <Plus className="right-[var(--i)] top-[var(--i)]" />
      <Plus className="bottom-[var(--i)] left-[var(--i)]" />
      <Plus className="bottom-[var(--i)] right-[var(--i)]" />
    </div>
  );
}

export function Label({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`t-label ${className}`}>{children}</span>;
}

/**
 * Section marker: a short ember tick, a hairline, then the name.
 *
 * There is deliberately no `01 / 02 / 03`. Numbering a six-section page tells
 * the reader nothing they cannot see from the scrollbar, and it makes the site
 * feel like a slide deck with an agenda. The tick and rule give the label the
 * same structural weight without pretending the order is information.
 */
export function SectionTag({ name }: { name: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span aria-hidden="true" className="h-px w-2 bg-[var(--color-accent)]" />
      <span aria-hidden="true" className="h-px w-8 bg-[var(--color-rule)]" />
      <Label>{name}</Label>
    </div>
  );
}

/**
 * Splits text into per-character spans for stagger animations.
 * Words are kept in their own wrappers so the browser can still break lines,
 * and the whole string stays in the accessibility tree as one label rather
 * than being read out letter by letter.
 */
export const SplitText = forwardRef<
  HTMLSpanElement,
  { text: string; className?: string; charClass?: string }
>(function SplitText({ text, className = '', charClass = '' }, ref) {
  return (
    <span ref={ref} className={className} aria-label={text}>
      {text.split(' ').map((word, wi, words) => (
        <span key={`${word}-${wi}`} className="inline-block whitespace-nowrap">
          {Array.from(word).map((ch, ci) => (
            <span
              key={`${ch}-${ci}`}
              aria-hidden="true"
              data-char
              className={`inline-block will-change-transform ${charClass}`}
            >
              {ch}
            </span>
          ))}
          {wi < words.length - 1 && (
            <span aria-hidden="true" data-char className="inline-block">
              &nbsp;
            </span>
          )}
        </span>
      ))}
    </span>
  );
});

/** Marks a link/button as cursor-interactive so the custom cursor reacts. */
export function useCursorTarget<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const setHovering = useScene((s) => s.setHovering);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setHovering(true);
    const off = () => setHovering(false);
    el.addEventListener('pointerenter', on);
    el.addEventListener('pointerleave', off);
    return () => {
      el.removeEventListener('pointerenter', on);
      el.removeEventListener('pointerleave', off);
      setHovering(false);
    };
  }, [setHovering]);

  return ref;
}

/**
 * Every rail that positions itself rests at the same offset below the bar.
 *
 * Only the two PINNED rails use this. The home page's other rails are left in
 * normal flow deliberately: a sticky rail works on the interior pages because
 * their mastheads have a deliberate empty band beneath it, and on the home page
 * there is none — the section's own copy starts immediately below, so a sticky
 * rail rides over it and its hairline cuts through the monospace underneath.
 * Those rails scroll away with their section, which is correct, and are simply
 * gone before they reach the bar.
 */
export const RAIL_TOP = 'top-[calc(var(--nav-h)+var(--nav-clear))]';

/**
 * Resolve a CSS length token to pixels.
 *
 * `--nav-clear` is a clamp, and reading a custom property back off the root
 * returns the token stream rather than a resolved value, so it has to be
 * measured. Once per mount and per resize, not per frame.
 */
function resolveLength(token: string): number {
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:${token}`;
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return px;
}

/**
 * ONE SHARED LOOP FOR EVERY RAIL, READS BATCHED AHEAD OF WRITES.
 *
 * Each rail used to run its own ticker callback that read its own rect and
 * then immediately wrote its own opacity. Seven rails meant the sequence
 * read → write → read → write → … seven times a frame, and every read after
 * the first landed on a document some other rail had just dirtied. That is a
 * forced synchronous layout per rail per frame, for the entire life of the
 * page, and it is invisible in a profile that only looks at the render loop.
 *
 * Same arithmetic, same output, restructured into two passes: measure them
 * all, then write them all. The document is dirtied once, at the end, rather
 * than six times in the middle of being measured.
 */
type Rail = { el: HTMLElement; shown: number; top: number };

const rails = new Set<Rail>();
const railGeom = { rest: 0, bar: 0 };
let railDetach: (() => void) | null = null;

function measureRailGeom() {
  const bar = document.querySelector<HTMLElement>('[data-topbar]');
  if (!bar) return;
  const barH = bar.getBoundingClientRect().height;
  railGeom.bar = barH;
  railGeom.rest = barH + resolveLength('var(--nav-clear)');
}

function railStep() {
  const { rest, bar } = railGeom;
  if (rest <= bar || rails.size === 0) return;

  // READ PASS — every rect, before anything is written this frame.
  for (const r of rails) r.top = r.el.getBoundingClientRect().top;

  // WRITE PASS — nothing below reads layout.
  const span = rest - bar;
  for (const r of rails) {
    const t = Math.min(Math.max((r.top - bar) / span, 0), 1);
    // Smoothstepped, so the fade eases out of its own limits instead of
    // ramping linearly into full opacity at the moment the rail parks.
    const value = t * t * (3 - 2 * t);

    // Mapped straight from position, with no damping.
    //
    // A damped chase was the first version and it was wrong in the one case
    // that matters. The requirement is absolute — the rail must be gone BEFORE
    // it touches the bar — and a filter that lags by a few frames breaks
    // exactly that on a fast flick, which is when a rail crosses its whole
    // clearance in less time than the filter needs to settle. It showed up on
    // the Deconstruction rail, which is released by a pin and so moves faster
    // than any of the others.
    //
    // Nothing is lost by dropping it: the input is scroll position, Lenis has
    // already eased that, so the output is continuous without any help here.
    if (r.shown !== value) {
      r.shown = value;
      r.el.style.opacity = String(value);
      // A rail faded to nothing must not still be catching the pointer.
      r.el.style.pointerEvents = value < RAIL.hidden ? 'none' : '';
    }
  }
}

/**
 * Fades a label rail out as it comes up on the fixed top bar.
 *
 * The bar is painted with mix-blend-difference, so a rail that scrolls under it
 * does not pass behind it — it inverts against it, and two lines of the same
 * monospace at the same size become unreadable mush. Every rail has to be gone
 * before it arrives.
 *
 * WHY THIS IS DRIVEN OFF POSITION AND NOT OFF A SCROLLTRIGGER
 * The rails do not all move the same way. Two of them are held by a pin, five
 * are sticky within their section, and the interior pages' are sticky within a
 * masthead. A ScrollTrigger start/end resolved against a pinned or sticky
 * element measures where it is PARKED rather than where it is in flow, so the
 * same start fires at wildly different moments for each — the first version of
 * this faded the interior rail out while the masthead was still being read.
 * The rendered position is the one thing that is true for all of them, and it
 * is symmetric in both scroll directions for nothing extra.
 *
 * The band is the rail's own clearance — the gap between where it rests and the
 * bottom of the bar — read off its computed `top` rather than hard-coded. A
 * fixed band would either start dimming a rail that is still parked or fail to
 * finish before it touched the bar, depending on the viewport, because both the
 * bar's height and the clearance are clamps.
 *
 * Runs on the one shared ticker, after Lenis and ScrollTrigger have updated, so
 * the rect it reads is the one about to be painted rather than last frame's.
 */
export function useRailFade(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const entry: Rail = { el, shown: 1, top: 0 };
    rails.add(entry);

    // The shared step and the resize listener are owned by the group, not by
    // any one rail: started when the first rail mounts, torn down when the
    // last one leaves. Interior routes mount and unmount rails on navigation,
    // so "the last one" really does happen.
    if (rails.size === 1) {
      measureRailGeom();
      window.addEventListener('resize', measureRailGeom);
      const unstep = addStep(railStep);
      railDetach = () => {
        unstep();
        window.removeEventListener('resize', measureRailGeom);
      };
    }

    return () => {
      rails.delete(entry);
      if (rails.size === 0 && railDetach) {
        railDetach();
        railDetach = null;
      }
    };
  }, [ref]);
}

/**
 * Marks the end of a page so the interactive floor plate switches on.
 *
 * Uses an IntersectionObserver rather than a ScrollTrigger: this is a pure
 * "is it near the viewport" question, it needs no scroll maths, and it must
 * keep working on interior pages where the main ScrollTrigger timeline for the
 * home page does not exist.
 */
export function useFooterFloor(ref: React.RefObject<HTMLElement | null>) {
  const setFooterNear = useScene((s) => s.setFooterNear);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setFooterNear(entry.isIntersecting),
      { rootMargin: '10% 0px 0px 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setFooterNear(false);
    };
  }, [ref, setFooterNear]);
}

/** Live IST clock. Renders nothing until mounted, so SSR and client agree. */
export function ClockIST() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="t-mono text-[var(--color-fg-dim)] tabular-nums">
      {time ? `${time} IST` : ' '}
    </span>
  );
}
