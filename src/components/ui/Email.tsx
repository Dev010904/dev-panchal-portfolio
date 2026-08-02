'use client';

import { useEffect, useRef, useState } from 'react';
import { EMAIL_PARTS } from '@/data/site';
import { useGsap, gsap } from '@/lib/gsap';
import { useCursorTarget } from './primitives';

/**
 * OBFUSCATED EMAIL.
 *
 * The address never exists as a contiguous string in the served HTML, in the
 * JS bundle as a single literal, or in any `href` until a user has actually
 * interacted with the page. It is assembled from parts on mount.
 *
 * What that defeats: the overwhelming majority of harvesters, which fetch the
 * HTML and regex for an address, and the ones that grep bundles for
 * `mailto:`. What it does not defeat: a headless browser that executes JS.
 * Nothing does, short of not publishing the address — and the whole point is
 * that a client can read it and click it, so it stays visible and functional.
 *
 * Everything a real user needs is preserved: visible text, working mailto,
 * selectable, copyable, and a copy button.
 */
export function Email({
  className = '',
  display = 'lg',
}: {
  className?: string;
  display?: 'lg' | 'sm';
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const link = useCursorTarget<HTMLAnchorElement>();
  const underline = useRef<HTMLSpanElement>(null);
  const copiedRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setAddress(EMAIL_PARTS.join(''));
  }, []);

  useGsap(
    () => {
      const el = link.current;
      const rule = underline.current;
      if (!el || !rule) return;

      gsap.set(rule, { scaleX: 0, transformOrigin: 'left center' });

      const enter = () =>
        gsap.to(rule, { scaleX: 1, duration: 0.62, ease: 'expo.out', overwrite: true });
      const leave = () =>
        gsap.to(rule, {
          scaleX: 0,
          duration: 0.42,
          ease: 'power2.inOut',
          transformOrigin: 'right center',
          overwrite: true,
        });

      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      return () => {
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
      };
    },
    [address],
    root,
  );

  const copy = async () => {
    const value = EMAIL_PARTS.join('');
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API is unavailable over plain http and in some embedded
      // webviews. Fall back to a selection so the copy still succeeds.
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    if (copiedRef.current) {
      gsap.fromTo(
        copiedRef.current,
        { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: 'expo.out' },
      );
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  const size =
    display === 'lg'
      ? 'text-[clamp(1.4rem,5.2vw,4.1rem)] tracking-[-0.035em] leading-[1.02]'
      : 'text-base';

  return (
    <div ref={root} className={`relative ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <a
          ref={link}
          href={address ? `mailto:${address}` : undefined}
          className={`relative inline-block font-[700] text-[var(--color-fg)] ${size}`}
          // Suppress hydration noise: the address is intentionally absent on
          // the server render and filled in on mount.
          suppressHydrationWarning
        >
          {address ?? ' '}
          <span
            ref={underline}
            aria-hidden="true"
            className="absolute -bottom-1 left-0 block h-px w-full bg-[var(--color-accent)]"
          />
        </a>

        <button
          type="button"
          onClick={copy}
          className="t-label group inline-flex shrink-0 items-center gap-2 py-2 text-[var(--color-fg-dim)] transition-colors hover:text-[var(--color-fg)]"
          aria-label="Copy email address to clipboard"
        >
          <span className="h-px w-5 bg-[var(--color-rule)] transition-colors group-hover:bg-[var(--color-accent)]" />
          {copied ? (
            <span ref={copiedRef} className="text-[var(--color-accent)]">
              COPIED
            </span>
          ) : (
            <span>COPY</span>
          )}
        </button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Email address copied to clipboard' : ''}
      </span>
    </div>
  );
}
