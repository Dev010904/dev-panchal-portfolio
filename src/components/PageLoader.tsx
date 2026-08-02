'use client';

import { useRef, useState } from 'react';

import { PAGE_LOADER } from '@/config/animation';
import { gsap, useGsap } from '@/lib/gsap';
import { getLenis } from '@/components/SmoothScroll';
import { useScene } from '@/store/scene';

/**
 * INTERIOR PAGE LOADER.
 *
 * The root Preloader runs exactly once, on the first paint of the session, and
 * is tied to real asset and shader-compile progress. Routing to /process after
 * that is a client-side navigation with nothing left to load, so it arrived
 * with no transition at all — the type simply swapped while the camera was
 * still flying to the new structure.
 *
 * This covers that. It is deliberately a different object from the root
 * preloader rather than a reuse of it:
 *
 *   Root preloader   five VERTICAL panels, the full wordmark, a live percentage
 *                    counter. It is an event; it only happens once.
 *   This             one plate wiping HORIZONTALLY, the page's own name and its
 *                    structure spec. It is punctuation between rooms.
 *
 * Different axis, different type scale, no counter. Sharing the panel-split
 * would make the interior pages feel like the site had reloaded, which is
 * exactly the thing the persistent canvas exists to avoid.
 *
 * It is time-based, and honestly so: there is nothing to measure. What it is
 * actually covering is the camera's travel to the page's structure, which has a
 * known duration in the config. Faking a percentage here would be a lie about
 * work that is not happening.
 */
export function PageLoader({ label, spec }: { label: string; spec: string }) {
  const [shown, setShown] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const reducedMotion = useScene((s) => s.reducedMotion);

  useGsap(
    () => {
      const finish = () => {
        setShown(false);
        getLenis()?.start();
      };

      // The page underneath must not be scrollable while the plate is over it,
      // or a flick during the transition lands somewhere arbitrary.
      getLenis()?.stop();

      if (reducedMotion) {
        gsap.delayedCall(0.12, finish);
        return;
      }

      gsap
        .timeline({ onComplete: finish })
        .fromTo(
          '[data-loader-word]',
          { yPercent: 108 },
          {
            yPercent: 0,
            duration: 0.62,
            stagger: 0.06,
            ease: 'expo.out',
          },
          0.05,
        )
        .fromTo(
          '[data-loader-rule]',
          { scaleX: 0 },
          { scaleX: 1, duration: PAGE_LOADER.hold, ease: 'power1.inOut', transformOrigin: 'left center' },
          0,
        )
        .to(
          '[data-loader-word], [data-loader-spec]',
          { autoAlpha: 0, duration: 0.28, ease: 'power2.in' },
          PAGE_LOADER.hold * 0.82,
        )
        // The wipe leaves to the right, against the direction the eye reads —
        // so it uncovers the headline from its first character rather than its
        // last, and the page is legible the moment it starts moving.
        .to(
          '[data-loader-plate]',
          {
            xPercent: 101,
            duration: PAGE_LOADER.exit.duration,
            ease: PAGE_LOADER.exit.ease,
          },
          '>-0.06',
        );
    },
    [],
    root,
  );

  if (!shown) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[92] overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label={`Loading ${label}`}
    >
      <div
        data-loader-plate
        className="absolute inset-0 flex flex-col justify-end bg-[var(--color-bg)] px-[var(--gutter)] pb-[clamp(2rem,8vh,5rem)] will-change-transform"
      >
        <span data-loader-spec className="t-label mb-4 block">
          {spec}
        </span>

        <span className="line-mask">
          <span
            data-loader-word
            className="t-display block text-[clamp(2.6rem,9vw,8rem)] leading-[0.9] text-[var(--color-fg)] will-change-transform"
          >
            {label}
          </span>
        </span>

        <span className="mt-6 block h-px w-full bg-[var(--color-rule)]">
          <span
            data-loader-rule
            className="block h-px w-full origin-left scale-x-0 bg-[var(--color-accent)]"
          />
        </span>
      </div>
    </div>
  );
}
