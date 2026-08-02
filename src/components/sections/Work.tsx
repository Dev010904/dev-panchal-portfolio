'use client';

import { useEffect, useRef } from 'react';

import { SCROLL, WORK } from '@/config/animation';
import { primaryLink, projects } from '@/data/projects';
import { gsap, ScrollTrigger, useGsap } from '@/lib/gsap';
import { ArrowLink } from '@/components/ui/ArrowLink';
import { CornerMarks, RAIL_TOP, SectionTag, useRailFade } from '@/components/ui/primitives';
import { workHandle } from '@/scenes/handles';
import { useScene } from '@/store/scene';

/**
 * WORK.
 *
 * The panels live in the persistent scene — see scenes/WorkScene. This is the
 * frame around them: a pinned viewport whose scroll drives the ribbon, and the
 * copy for whichever card is currently at the apex.
 *
 * The section is pinned rather than scrolled past because the arc has to be
 * held still in the frame while it rotates. A ribbon that translates up the
 * page at the same time as it rotates reads as two unrelated motions, and the
 * apex — the whole organising idea — never stays in one place long enough to
 * be a place.
 *
 * `scrub: SCROLL.scrub` and never `true`: with Lenis already easing the scroll,
 * a hard-locked scrub is double-eased and feels rubbery. The scene damps the
 * value a second time, which is what carries the ribbon a beat past the last
 * wheel event instead of stopping dead on it.
 */
export function Work() {
  const root = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useRailFade(rail);

  const setWorkNear = useScene((s) => s.setWorkNear);
  const reducedMotion = useScene((s) => s.reducedMotion);

  const index = useScene((s) => s.workIndex);
  const project = projects[Math.min(index, projects.length - 1)];

  // Start loading the screenshots a full viewport before they are needed.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setWorkNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [setWorkNear]);

  useGsap(
    () => {
      const el = root.current;
      const pinEl = pin.current;
      if (!el || !pinEl) return;

      const enter = () => {
        const s = useScene.getState();
        if (s.shot !== 'work') s.setShot('work');
        if (s.activeSection !== 'WORK') s.setSection('WORK');
      };

      // Reduced motion: no pin, no scrub. The arc still exists and still reads
      // as an arc — it simply parks at the first project and the reader gets
      // the whole list from the sr-only anchors and the copy below.
      //
      // Parked at `sweep.span` and not at 0, because 0 is now the far end of
      // the entry sweep — the point at which the ribbon is deliberately outside
      // the frustum. `span` is exactly where that sweep finishes and the first
      // card is in its reading position, so this is the same frame the animated
      // path settles on without borrowing a number to say so.
      if (reducedMotion) {
        workHandle.progress = WORK.arc.sweep.span;
        ScrollTrigger.create({ trigger: el, start: 'top 60%', onEnter: enter, onEnterBack: enter });
        return;
      }

      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: `+=${projects.length * WORK.scrollPerProject * 100}%`,
        pin: pinEl,
        pinSpacing: true,
        scrub: SCROLL.scrub,
        anticipatePin: 1,
        onUpdate: (self) => {
          workHandle.progress = self.progress;
        },
        onEnter: enter,
        onEnterBack: enter,
        /**
         * Hand the camera back on the way UP.
         *
         * Nothing else did, so the `work` pose persisted above the section:
         * scrolling up out of the pin left the camera 60 units below the mark,
         * framing an empty corner of the room while the marquee and the
         * Deconstruction were on screen. Scrolling DOWN through the same band
         * rests at `hero` — the Deconstruction's scrub hands over to it once
         * its progress parks at 1 — so restoring `hero` here is not a new pose,
         * it is the one the forward path already uses, which is what makes the
         * two directions match.
         */
        onLeaveBack: () => {
          const s = useScene.getState();
          s.setShot('hero');
          s.setSection('THE MARK');
        },
      });

      return () => st.kill();
    },
    [reducedMotion],
    root,
  );

  // The apex card's copy. Crossfaded on change rather than swapped: a hard cut
  // on type this large is the kind of jump that makes a scroll feel like it is
  // stepping through slides.
  const meta = useRef<HTMLDivElement>(null);
  useGsap(
    () => {
      const el = meta.current;
      if (!el || reducedMotion) return;
      gsap.fromTo(
        el.querySelectorAll('[data-meta]'),
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.045, ease: 'power3.out', overwrite: true },
      );
    },
    [index, reducedMotion],
    meta,
  );

  return (
    <section ref={root} id="work" aria-label="Selected work">
      <div ref={pin} className="relative h-[100svh] w-full overflow-hidden">
        <CornerMarks />

        {/* Header rail. The pin already holds it in place, so it needs no
            sticky — only the same clearance token and the same fade as every
            other rail, for the moment the pin releases and it travels up. */}
        <div
          ref={rail}
          className={`grid12 absolute inset-x-0 ${RAIL_TOP} z-20`}
        >
          <div className="col-span-12 flex flex-wrap items-baseline justify-between gap-4">
            <SectionTag name="WORK" />
            <span className="t-mono text-[var(--color-fg-dim)]">
              {String(index + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}
            </span>
          </div>
          <div className="col-span-12 mt-4 h-px bg-[var(--color-rule)]" />
        </div>

        {/* The focused card's copy. Sits low-left; the ribbon is framed to the
            right of it — see SHOTS.work. */}
        <div
          ref={meta}
          className="grid12 pointer-events-none absolute inset-x-0 bottom-[clamp(2rem,7vh,4.5rem)] z-20 items-end"
        >
          <div className="pointer-events-auto col-span-12 flex flex-col gap-4 md:col-span-6 lg:col-span-5">
            {project.context && (
              <span data-meta className="t-label block">
                {project.context}
              </span>
            )}

            <h2 data-meta className="t-h2">
              {project.title}
            </h2>

            <p data-meta className="t-body max-w-[42ch]">
              {project.summary}
            </p>

            <div data-meta className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="t-mono text-[var(--color-accent)]">
                {project.status === 'live' ? 'LIVE' : project.status.toUpperCase()}
              </span>
              {project.role && (
                <span className="t-mono text-[var(--color-fg-dim)]">{project.role}</span>
              )}
              {project.year && (
                <span className="t-mono text-[var(--color-fg-dim)]">{project.year}</span>
              )}
            </div>

            {project.stack && (
              <span data-meta className="t-label block max-w-[46ch] leading-[1.7]">
                {project.stack.join(' · ')}
              </span>
            )}

            {/* Every destination, not just the primary. A project with a live
                app, a repository and a write-up has three peers. */}
            <div data-meta className="mt-1 flex flex-col gap-1">
              {project.links.map((l) => (
                <ArrowLink
                  key={l.href}
                  label={l.label}
                  href={l.href}
                  external
                  tone={l.href === primaryLink(project).href ? 'accent' : 'default'}
                />
              ))}
            </div>
          </div>

          <div className="col-span-12 mt-6 flex items-end justify-between md:col-span-4 md:col-start-9 md:mt-0">
            <span className="t-label">SCROLL TO ROTATE</span>
            <span className="t-mono text-[var(--color-fg-dim)]">
              {project.tags.join(' · ')}
            </span>
          </div>
        </div>

        {/*
          KEYBOARD.

          The panels are raycast meshes in the canvas, which is `aria-hidden`
          and has nothing focusable in it. These are the same four destinations
          as real anchors: reachable by tab, announced properly, and off-screen
          rather than `display: none` so focus can actually land on them.
        */}
        <ul className="sr-only">
          {projects.map((p) => (
            <li key={p.id}>
              <a href={primaryLink(p).href} target="_blank" rel="noopener noreferrer">
                {p.title} — {p.summary}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Closing rail, after the pin releases. */}
      <div className="grid12 gap-y-6 py-[clamp(4rem,12vh,9rem)]">
        <div className="col-span-12 h-px bg-[var(--color-rule)]" />
        <div className="col-span-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <p className="t-body max-w-[38ch]">
            More work in progress — currently taking on freelance.
          </p>
          {/* Plain ArrowLink, same as PageShell's "BACK TO INDEX" — wrapping it
              in a next/link would nest an anchor inside an anchor. */}
          <ArrowLink label="CREDENTIALS" href="/credentials" tone="accent" />
        </div>
      </div>
    </section>
  );
}
