'use client';

import { useEffect, useRef, useState } from 'react';

import { EMAIL_PARTS, SOCIALS, site } from '@/data/site';
import { gsap, useGsap } from '@/lib/gsap';
import { ClockIST, useCursorTarget } from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

/**
 * INTERIOR PAGE FOOTERS.
 *
 * Four genuinely different closes, one per page, and none of them the home
 * page's.
 *
 * The temptation is one shared footer component with a prop that changes a
 * colour. That is worse than no variation at all: it reads as a template with
 * a knob on it, and a visitor who scrolls to the bottom of two pages sees the
 * same object twice. These are four different LAYOUTS — different structure,
 * different type scale, different reading order, different reveal:
 *
 *   /process  RULED     a wide horizontal band. Label left, address set large
 *                       right, everything hanging off one full-bleed rule.
 *                       Matches a page about sequence.
 *   /stack    SPEC      a datasheet. Key/value rows, monospace keys, hairline
 *                       between every row. Matches a page about materials.
 *   /notes    COLUMN    a narrow centred column with a lot of air. Matches a
 *                       page that reads like an essay.
 *   /credentials
 *             REGISTER  a band of ruled cells divided by vertical hairlines,
 *                       each with its key set above its value. Matches a page
 *                       that is literally a register — it is the same table the
 *                       ledger above it is, turned on its side and given one
 *                       row.
 *
 * All four carry the same information, because the information is not the
 * variable — the composition is.
 */

type Variant = 'ruled' | 'spec' | 'column' | 'register';

const VARIANTS: Record<string, Variant> = {
  process: 'ruled',
  stack: 'spec',
  notes: 'column',
  credentials: 'register',
};

/** The address is assembled on mount, never served as a contiguous string. */
function useEmail() {
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => setAddress(EMAIL_PARTS.join('')), []);
  return address;
}

export function PageFooter({ slug }: { slug: string }) {
  const root = useRef<HTMLElement>(null);
  const reducedMotion = useScene((s) => s.reducedMotion);
  const variant = VARIANTS[slug] ?? 'ruled';

  useGsap(
    () => {
      if (reducedMotion) {
        gsap.set('[data-pf]', { autoAlpha: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        '[data-pf]',
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          // Each variant reveals along its own axis: the ruled band sweeps
          // left to right, the spec sheet fills top to bottom row by row, and
          // the column arrives almost as one piece.
          stagger:
            variant === 'spec'
              ? 0.07
              : variant === 'ruled'
                ? 0.11
                : variant === 'register'
                  ? 0.09
                  : 0.04,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 82%' },
        },
      );
    },
    [reducedMotion, variant],
    root,
  );

  return (
    <footer
      ref={root}
      aria-label="Contact"
      className="relative border-t border-[var(--color-rule)] pt-[clamp(2.5rem,8vh,5rem)] pb-[clamp(2rem,6vh,3.5rem)]"
    >
      {variant === 'ruled' && <Ruled />}
      {variant === 'spec' && <Spec />}
      {variant === 'column' && <Column />}
      {variant === 'register' && <Register />}
    </footer>
  );
}

/* ── /process — RULED BAND ─────────────────────────────────────────────────
   One rule, everything hanging off it. Address set large and right-aligned so
   the band reads left-to-right as label → rule → address, which is the same
   shape as the page above it. */

function Ruled() {
  const address = useEmail();

  return (
    <div className="grid12 gap-y-8">
      <span data-pf className="t-label col-span-12 opacity-0 lg:col-span-3">
        START A PROJECT
      </span>

      <div data-pf className="col-span-12 opacity-0 lg:col-span-9">
        <a
          href={address ? `mailto:${address}` : undefined}
          className="block break-all text-[clamp(1.3rem,3.6vw,2.9rem)] font-[500] leading-[1.06] tracking-[-0.035em] text-[var(--color-fg)] transition-colors duration-500 hover:text-[var(--color-accent)]"
          suppressHydrationWarning
        >
          {address ?? ' '}
        </a>
      </div>

      <div className="col-span-12 h-px bg-[var(--color-rule)]" />

      <div
        data-pf
        className="col-span-12 flex flex-wrap items-baseline justify-between gap-x-10 gap-y-4 opacity-0"
      >
        <span className="t-label">DEV PANCHAL — © 2026</span>
        <span className="flex flex-wrap gap-x-8 gap-y-2">
          {SOCIALS.map((x) => (
            <Social key={x.key} label={x.label} href={x.href} />
          ))}
        </span>
        <span className="t-label">{site.location}</span>
      </div>
    </div>
  );
}

/* ── /stack — SPEC SHEET ───────────────────────────────────────────────────
   A datasheet. Monospace keys in a fixed left column, values right, a hairline
   under every row. The page is about what things are made of, so the footer is
   set as a bill of materials. */

function Spec() {
  const address = useEmail();

  return (
    <div className="grid12">
      <div className="col-span-12 lg:col-span-8">
        <SpecRow k="EMAIL" value={address ?? ' '} href={address ? `mailto:${address}` : undefined} />
        <SpecRow k="WHATSAPP" value={site.whatsapp.display} href={site.whatsapp.href} external />
        <SpecRow k="GITHUB" value={site.github.display} href={site.github.href} external />
        <SpecRow k="LINKEDIN" value={site.linkedin.display} href={site.linkedin.href} external />
        <SpecRow k="SOCIAL" value={site.instagram.display} href={site.instagram.href} external />
        <SpecRow k="BASE" value={site.location} />
        <SpecRow k="LOCAL" value={null} />
      </div>

      <div
        data-pf
        className="col-span-12 mt-[clamp(1.5rem,4vh,2.5rem)] flex items-baseline justify-between opacity-0"
      >
        <span className="t-label">DEV PANCHAL — © 2026</span>
        <span className="t-label">STACK</span>
      </div>
    </div>
  );
}

function SpecRow({
  k,
  value,
  href,
  external = false,
}: {
  k: string;
  value: string | null;
  href?: string;
  external?: boolean;
}) {
  const ref = useCursorTarget<HTMLAnchorElement>();

  return (
    <div
      data-pf
      className="flex items-baseline gap-6 border-b border-[var(--color-rule)] py-[clamp(0.7rem,1.8vh,1.1rem)] opacity-0"
    >
      <span className="t-mono w-[8.5rem] shrink-0 text-[var(--color-fg-dim)]">{k}</span>
      {href ? (
        <a
          ref={ref}
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="group relative break-all text-[clamp(0.95rem,1.5vw,1.2rem)] text-[var(--color-fg)]"
          suppressHydrationWarning
        >
          {value}
          <span className="absolute -bottom-0.5 left-0 block h-px w-0 bg-[var(--color-accent)] transition-all duration-500 ease-[var(--ease-reveal)] group-hover:w-full" />
        </a>
      ) : (
        <span className="text-[clamp(0.95rem,1.5vw,1.2rem)] text-[var(--color-fg)]">
          {value ?? <ClockIST />}
        </span>
      )}
    </div>
  );
}

/* ── /notes — CENTRED COLUMN ───────────────────────────────────────────────
   Narrow, centred, a lot of air. The page reads like an essay, so it ends the
   way an essay ends: quietly, in the middle of the measure. */

function Column() {
  const address = useEmail();

  return (
    // Measured off the ADDRESS, not off body copy. A 46ch column is right for
    // reading but the email is set much larger than the text it was measured
    // against, so it broke mid-word into "…web@gm / ail.com".
    <div className="mx-auto flex max-w-[34rem] flex-col items-center gap-[clamp(1.1rem,3vh,2rem)] px-[var(--gutter)] text-center">
      <span data-pf className="t-label opacity-0">
        THAT’S THE END OF THE NOTES
      </span>

      <a
        data-pf
        href={address ? `mailto:${address}` : undefined}
        className="block break-words text-[clamp(0.95rem,2.1vw,1.55rem)] font-[500] leading-[1.2] tracking-[-0.03em] text-[var(--color-fg)] opacity-0 transition-colors duration-500 hover:text-[var(--color-accent)]"
        suppressHydrationWarning
      >
        {address ?? ' '}
      </a>

      <span data-pf className="h-px w-16 bg-[var(--color-rule)] opacity-0" />

      <span data-pf className="flex flex-wrap justify-center gap-x-8 gap-y-2 opacity-0">
        {SOCIALS.map((x) => (
          <Social key={x.key} label={x.label} href={x.href} />
        ))}
      </span>

      <span data-pf className="t-label opacity-0">
        DEV PANCHAL — © 2026 · {site.location}
      </span>
    </div>
  );
}

/* ── /credentials — REGISTER BAND ──────────────────────────────────────────
   Ruled cells divided by vertical hairlines, key set above value. The page it
   closes is a register, so the footer is one more row of it: same column rules,
   same monospace keys, read left to right. It is the only one of the four that
   uses vertical rules at all, which is what stops it reading as the spec sheet
   with different spacing. */

function Register() {
  const address = useEmail();

  return (
    <div className="grid12">
      <div className="col-span-12 h-px bg-[var(--color-rule)]" />

      <div className="col-span-12 grid grid-cols-1 md:grid-cols-3">
        <Cell k="EMAIL">
          <a
            href={address ? `mailto:${address}` : undefined}
            className="block break-all text-[clamp(0.95rem,1.35vw,1.15rem)] text-[var(--color-fg)] transition-colors duration-500 hover:text-[var(--color-accent)]"
            suppressHydrationWarning
          >
            {address ?? ' '}
          </a>
        </Cell>

        <Cell k="ELSEWHERE">
          <span className="flex flex-wrap gap-x-6 gap-y-2">
            {SOCIALS.map((s) => (
              <Social key={s.key} label={s.label} href={s.href} />
            ))}
          </span>
        </Cell>

        <Cell k="BASE" last>
          <span className="block text-[clamp(0.95rem,1.35vw,1.15rem)] text-[var(--color-fg)]">
            {site.location}
          </span>
          <span className="mt-2 block">
            <ClockIST />
          </span>
        </Cell>
      </div>

      <div className="col-span-12 h-px bg-[var(--color-rule)]" />

      <div
        data-pf
        className="col-span-12 flex items-baseline justify-between pt-[clamp(1rem,3vh,1.75rem)] opacity-0"
      >
        <span className="t-label">DEV PANCHAL — © 2026</span>
        <span className="t-label">CREDENTIALS</span>
      </div>
    </div>
  );
}

function Cell({
  k,
  children,
  last = false,
}: {
  k: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      data-pf
      className={`flex flex-col gap-3 py-[clamp(1.25rem,3.5vh,2.25rem)] opacity-0 md:pr-[clamp(1rem,2vw,2rem)] ${
        last ? '' : 'md:border-r md:border-[var(--color-rule)]'
      } ${last ? '' : 'md:pl-0'} ${k === 'EMAIL' ? '' : 'md:pl-[clamp(1rem,2vw,2rem)]'}`}
    >
      <span className="t-label">{k}</span>
      {children}
    </div>
  );
}

/**
 * A social link. Deliberately just the platform name — no handle.
 *
 * The underline sweeps in on hover from the left and out to the right, which is
 * the same gesture the rest of the site's links use, so these do not read as a
 * different species of link just because they live in a footer.
 */
function Social({ label, href }: { label: string; href: string }) {
  const ref = useCursorTarget<HTMLAnchorElement>();

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative inline-block text-[clamp(0.95rem,1.4vw,1.15rem)] text-[var(--color-fg)] transition-colors duration-300 hover:text-[var(--color-accent)]"
    >
      {label}
      <span
        aria-hidden="true"
        className="absolute -bottom-1 left-0 block h-px w-0 bg-[var(--color-accent)] transition-all duration-500 ease-[var(--ease-reveal)] group-hover:w-full"
      />
    </a>
  );
}
