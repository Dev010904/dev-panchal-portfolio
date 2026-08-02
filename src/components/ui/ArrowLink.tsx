'use client';

import { useRef } from 'react';

import { gsap, useGsap } from '@/lib/gsap';
import { useCursorTarget } from './primitives';

/**
 * ARROW LINK — the site's primary call to action.
 *
 * At rest: LABEL ————————→   (arrow parked at the right end of the rule)
 * On hover: →  ————— LABEL   (arrow has crossed to the left, label has slid right)
 *
 * The two swap places. It reads as the link *turning around to lead you*, and
 * it is far more memorable than the usual arrow-nudges-right-by-4px.
 *
 * HOW IT IS BUILT
 * The row is a fixed-width track with the label and the arrow both absolutely
 * positioned inside it, so nothing reflows — both elements are pure transforms
 * and stay on the compositor. Laying this out with flex and animating `order`
 * or margins would force layout on every frame of the transition.
 *
 * The arrow does not simply translate: it leaves to the right, and a second
 * copy arrives from the left. A single element sliding the full width reads as
 * a slow object crossing the button; a leave/enter pair reads as a cut, which
 * is what makes it feel fast at 0.55s.
 */
export function ArrowLink({
  label,
  href,
  external = false,
  onClick,
  className = '',
  tone = 'default',
}: {
  label: string;
  href: string;
  external?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  tone?: 'default' | 'accent';
}) {
  const root = useRef<HTMLAnchorElement>(null);
  const cursor = useCursorTarget<HTMLAnchorElement>();

  useGsap(
    () => {
      const el = root.current;
      if (!el) return;

      const labelEl = el.querySelector<HTMLElement>('[data-al-label]');
      const outArrow = el.querySelector<HTMLElement>('[data-al-arrow="out"]');
      const inArrow = el.querySelector<HTMLElement>('[data-al-arrow="in"]');
      const rule = el.querySelector<HTMLElement>('[data-al-rule]');
      const fill = el.querySelector<HTMLElement>('[data-al-fill]');
      if (!labelEl || !outArrow || !inArrow || !rule || !fill) return;

      // Measured, never hard-coded: the label travels exactly far enough to
      // finish flush with the right edge of the track, whatever the label
      // length or font size happens to be.
      const shift = () => el.clientWidth - labelEl.offsetWidth;

      gsap.set(inArrow, { xPercent: -260, autoAlpha: 0 });
      gsap.set(fill, { scaleX: 0, transformOrigin: 'left center' });

      let tl: gsap.core.Timeline | null = null;

      const enter = () => {
        tl?.kill();
        const d = shift();
        tl = gsap
          .timeline({ defaults: { duration: 0.55, ease: 'expo.out' } })
          .to(outArrow, { xPercent: 160, autoAlpha: 0, duration: 0.32, ease: 'power2.in' }, 0)
          .to(inArrow, { xPercent: 0, autoAlpha: 1 }, 0.06)
          .to(labelEl, { x: d, duration: 0.62 }, 0)
          .to(fill, { scaleX: 1, duration: 0.62 }, 0);
      };

      const leave = () => {
        tl?.kill();
        tl = gsap
          .timeline({ defaults: { duration: 0.5, ease: 'power2.inOut' } })
          .to(inArrow, { xPercent: -260, autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, 0)
          .to(outArrow, { xPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'expo.out' }, 0.06)
          .to(labelEl, { x: 0 }, 0)
          .to(fill, { scaleX: 0, transformOrigin: 'right center', duration: 0.45 }, 0);
      };

      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      el.addEventListener('focus', enter);
      el.addEventListener('blur', leave);
      return () => {
        tl?.kill();
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
        el.removeEventListener('focus', enter);
        el.removeEventListener('blur', leave);
      };
    },
    [label],
    root,
  );

  const setRefs = (el: HTMLAnchorElement | null) => {
    root.current = el;
    (cursor as React.MutableRefObject<HTMLAnchorElement | null>).current = el;
  };

  const arrowColor =
    tone === 'accent' ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg)]';

  return (
    <a
      ref={setRefs}
      href={href}
      onClick={onClick}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`group relative inline-block pb-3 pt-1 ${className}`}
      // Inline rather than a Tailwind arbitrary value: this measurement is
      // load-bearing (the whole animation is derived from clientWidth) and it
      // must not depend on whether the utility got generated.
      style={{ minWidth: '15rem' }}
      aria-label={label}
    >
      {/* SIZER — invisible, in normal flow, and the only thing that gives the
          track a width. Everything animated is absolutely positioned so that
          hovering never triggers layout; without a sizer those absolute
          children would collapse the anchor to zero width. */}
      <span aria-hidden="true" className="block whitespace-nowrap leading-[1.35]">
        <span className="t-label invisible tracking-[0.22em]">{label}</span>
        <span className="invisible inline-block" style={{ width: 22, marginLeft: '3.5rem' }} />
      </span>

      <span className="pointer-events-none absolute inset-x-0 top-1 block" aria-hidden="true">
        <span
          data-al-label
          className="t-label absolute left-0 top-0 whitespace-nowrap tracking-[0.22em] text-[var(--color-fg)] will-change-transform"
        >
          {label}
        </span>

        {/* Parked right — leaves on hover. */}
        <span
          data-al-arrow="out"
          className={`absolute right-0 top-0 will-change-transform ${arrowColor}`}
        >
          <Arrow />
        </span>

        {/* Arrives from off-screen left. */}
        <span
          data-al-arrow="in"
          className={`absolute left-0 top-0 will-change-transform ${arrowColor}`}
        >
          <Arrow />
        </span>
      </span>

      <span
        data-al-rule
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 block h-px bg-[var(--color-rule)]"
      />
      <span
        data-al-fill
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 block h-px bg-[var(--color-accent)] will-change-transform"
      />
    </a>
  );
}

function Arrow() {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" fill="none" className="block">
      <path d="M0 5h20M16 1l4 4-4 4" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
