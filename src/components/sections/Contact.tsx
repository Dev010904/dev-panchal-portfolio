'use client';

import { useRef } from 'react';

import { site } from '@/data/site';
import { gsap, useGsap } from '@/lib/gsap';
import { useSectionShot } from '@/components/useSectionShot';
import { Email } from '@/components/ui/Email';
import {
  ClockIST,
  CornerMarks,
  SectionTag,
  SplitText,
  useCursorTarget,
  useFooterFloor,
  useRailFade,
} from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

/**
 * CONTACT.
 *
 * The email is set at display size because it is how a client actually reaches
 * out — treating it as body copy under a "get in touch" heading buries the one
 * thing the page needs to do. It is a second headline.
 *
 * WhatsApp and Instagram sit beneath it as a two-column row. That is the whole
 * contact surface: no form, no location, no phone number as text.
 */
export function Contact() {
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useRailFade(rail);
  const heading = useRef<HTMLHeadingElement>(null);
  const footer = useRef<HTMLElement>(null);
  const reducedMotion = useScene((s) => s.reducedMotion);

  // Early start on purpose. The contact shot's job is to crane the camera off
  // the mark, and that travel has to be finished by the time the headline
  // lands — not still running underneath it.
  useSectionShot(root, 'contact', 'CONTACT', 'top 92%');
  useFooterFloor(footer);

  useGsap(
    () => {
      gsap.fromTo(
        '[data-contact-reveal]',
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1.05,
          stagger: 0.075,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 68%' },
        },
      );

      gsap.fromTo(
        '[data-headline-char]',
        { yPercent: 108 },
        {
          yPercent: 0,
          duration: 1.15,
          stagger: 0.028,
          ease: 'expo.out',
          scrollTrigger: { trigger: root.current, start: 'top 72%' },
        },
      );
    },
    [],
    root,
  );

  // Per-letter displacement on hover. Each character is pushed away from the
  // cursor by an amount that falls off with distance, so the word deforms
  // around the pointer like a soft body rather than animating as a block.
  useGsap(
    () => {
      const el = heading.current;
      if (!el || reducedMotion) return;
      const chars = Array.from(el.querySelectorAll<HTMLElement>('[data-headline-char]'));

      const onMove = (e: PointerEvent) => {
        for (const ch of chars) {
          const r = ch.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dx = cx - e.clientX;
          const dy = cy - e.clientY;
          const dist = Math.hypot(dx, dy);
          const radius = 260;
          if (dist > radius) {
            gsap.to(ch, { x: 0, y: 0, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
            continue;
          }
          const force = (1 - dist / radius) ** 2;
          gsap.to(ch, {
            x: (dx / (dist || 1)) * force * 26,
            y: (dy / (dist || 1)) * force * 16,
            duration: 0.55,
            ease: 'power3.out',
            overwrite: 'auto',
          });
        }
      };

      const onLeave = () =>
        gsap.to(chars, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.6)', stagger: 0.01 });

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      return () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      };
    },
    [reducedMotion],
    root,
  );

  return (
    <section
      ref={root}
      id="contact"
      aria-label="Contact"
      className="relative flex min-h-[100svh] flex-col justify-between py-[clamp(5rem,14vh,9rem)]"
    >
      <CornerMarks />

      <div ref={rail} className="grid12 gap-y-4">
        <div className="col-span-12 flex items-baseline justify-between">
          <SectionTag name="CONTACT" />
          <span className="t-mono text-[var(--color-fg-dim)]">OPEN FOR WORK</span>
        </div>
        <div className="col-span-12 mt-2 h-px bg-[var(--color-rule)]" />
      </div>

      <div className="grid12 my-auto gap-y-12 py-[clamp(2rem,6vh,5rem)]">
        <h2 ref={heading} className="col-span-12">
          <span className="sr-only">Let&apos;s build</span>
          <span aria-hidden="true" className="t-display line-mask">
            {Array.from("LET'S BUILD").map((ch, i) => (
              <span
                key={i}
                data-headline-char
                className="inline-block will-change-transform"
              >
                {ch === ' ' ? ' ' : ch}
              </span>
            ))}
          </span>
        </h2>

        <div data-contact-reveal className="col-span-12 opacity-0 lg:col-span-10">
          <span className="t-label mb-4 block">EMAIL — PREFERRED</span>
          <Email />
        </div>

        {/*
          Order is deliberate and matches the menu drawer: email above (set at
          display size, because it is the channel that actually gets used),
          then WhatsApp, GitHub, LinkedIn, Instagram. Roughly descending by how
          likely each is to be what a client came for — message, then code,
          then CV, then the one that is mostly for other designers.
        */}
        <div className="col-span-12 grid grid-cols-2 gap-x-6 gap-y-8 lg:col-span-10 lg:grid-cols-4">
          <ContactLink label="WHATSAPP" value={site.whatsapp.display} href={site.whatsapp.href} />
          <ContactLink label="CODE" value={site.github.display} href={site.github.href} />
          <ContactLink label="PROFILE" value={site.linkedin.display} href={site.linkedin.href} />
          {/* Label reads SOCIAL rather than INSTAGRAM: the value is the
              platform name, and "INSTAGRAM / Instagram" reads as a bug. */}
          <ContactLink label="SOCIAL" value={site.instagram.display} href={site.instagram.href} />
        </div>
      </div>

      {/* The interactive floor plate lives in the canvas and switches on when
          this block enters view — see scenes/FooterFloor. */}
      <footer ref={footer} className="grid12 gap-y-4">
        <div className="col-span-12 h-px bg-[var(--color-rule)]" />
        <div className="col-span-12 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <span className="t-label">DEV PANCHAL — © 2026</span>
          {/* The floor no longer gives — the deformable plate was dropped for
              a quiet dashed field — so the label that promised it goes too. */}
          <span className="t-label hidden lg:block">{site.location}</span>
          <ClockIST />
        </div>
      </footer>
    </section>
  );
}

function ContactLink({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  const ref = useCursorTarget<HTMLAnchorElement>();

  return (
    <a
      ref={ref}
      data-contact-reveal
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 opacity-0"
    >
      <span className="t-label">{label}</span>
      <span className="flex items-baseline gap-3">
        <SplitText
          text={value}
          className="text-[clamp(1.1rem,2.4vw,1.9rem)] font-[500] tracking-[-0.02em] text-[var(--color-fg)]"
        />
        <span
          aria-hidden="true"
          className="t-mono text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]"
        >
          ↗
        </span>
      </span>
      <span
        aria-hidden="true"
        className="block h-px w-full origin-left bg-[var(--color-rule)] transition-colors duration-500 group-hover:bg-[var(--color-accent)]"
      />
    </a>
  );
}
