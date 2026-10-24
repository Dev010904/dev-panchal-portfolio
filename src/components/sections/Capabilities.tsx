'use client';

import { useRef } from 'react';

import { ACHIEVEMENT } from '@/config/animation';
import { capabilities } from '@/data/capabilities';
import { achievement, credentials } from '@/data/credentials';
import { experience } from '@/data/experience';
import { projects } from '@/data/projects';
import { STACK } from '@/data/stack';
import { gsap, ScrollTrigger, useGsap } from '@/lib/gsap';
import { decode } from '@/lib/decode';
import { useTicker } from '@/lib/useTicker';
import { scrollToSection } from '@/components/Chrome';
import { useCameraTravel } from '@/components/useCameraTravel';
import { useSectionShot } from '@/components/useSectionShot';
import { ArrowLink } from '@/components/ui/ArrowLink';
import { Figure } from '@/components/ui/Figures';
import { SectionTag } from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

/**
 * THE SHEET — the one light chapter on the home page.
 *
 * Every section on this site was near-black, and a page that never changes
 * register reads as one long room however good each corner of it is: the
 * eye has nothing to measure the dark against. This is the change of register
 * — a drawing sheet in the middle of the instrument, laid out like one: paper,
 * a drafting grid, registration marks, a title block, figures.
 *
 * IT ARRIVES BY EXPOSURE, not by scrolling up like a card. The intro pins, and
 * an ember scan line sweeps down the frame: above it the dark scene has been
 * developed into paper, below it the room is still showing. The title rides
 * up over the scene as a white outline first and turns to ink as the line
 * passes over it — a blueprint being exposed. Scrolling back runs it backwards.
 *
 * Then the capabilities: four figures, each plotted stroke by stroke as it
 * comes up the page (construction lines, then the object, then the callouts);
 * the experience, set as the schedule of work a drawing keeps beside its title
 * block and stamped when it arrives; and the facts — every number read from
 * data, nothing typed in.
 *
 * WHILE THE PAPER COVERS THE WHOLE FRAME THE SCENE STOPS RENDERING
 * (store.covered → SceneRoot's CoverPause). Nobody can see it, and a GPU that
 * is not drawing a hidden 3D room keeps the type on the sheet scrolling at the
 * display's full rate.
 */
export function Capabilities() {
  const root = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const scan = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const exposure = useRef(0);
  const near = useRef(false);
  const reducedMotion = useScene((s) => s.reducedMotion);

  // The camera cranes off the work arc behind the scan line — see SHOTS.credits.
  useSectionShot(root, 'credits', 'CAPABILITIES', 'top 78%');
  useCameraTravel(root, 'toCredits', 'top 78%');

  const setExposure = (p: number) => {
    exposure.current = p;
    if (paper.current) paper.current.style.clipPath = `inset(0 0 ${((1 - p) * 100).toFixed(3)}% 0)`;
    if (scan.current) {
      scan.current.style.top = `${(p * 100).toFixed(3)}%`;
      scan.current.style.opacity = p > 0.002 && p < 0.998 ? '1' : '0';
    }
    if (readout.current) readout.current.textContent = `EXPOSURE ${p.toFixed(2)}`;
  };

  useGsap(
    () => {
      const el = root.current;
      if (!el) return;

      const plots = el.querySelectorAll<SVGElement>('.plot');
      const labels = el.querySelectorAll<SVGElement>('.fig-label');

      if (reducedMotion) {
        setExposure(1);
        gsap.set(plots, { strokeDashoffset: 0 });
        gsap.set(labels, { opacity: 1 });
        gsap.set('[data-cap-fade]', { autoAlpha: 1, y: 0 });
        gsap.set('[data-stamp]', { autoAlpha: 1, rotation: -5 });
        return;
      }

      setExposure(0);
      ScrollTrigger.create({
        trigger: intro.current,
        start: 'top top',
        end: '+=85%',
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate: (self) => setExposure(self.progress),
        onLeave: () => setExposure(1),
        onLeaveBack: () => setExposure(0),
      });

      // Is the sheet near the frame at all? The ticker below reads layout, so
      // it only runs while the answer could be yes.
      ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          near.current = self.isActive;
          if (!self.isActive) setSurface(false, false);
        },
      });

      // The pen: construction lines, then the object, then the callouts.
      el.querySelectorAll<HTMLElement>('[data-figure]').forEach((fig) => {
        const order = [
          ...fig.querySelectorAll('.plot.construct'),
          ...fig.querySelectorAll('.plot:not(.construct):not(.callout)'),
          ...fig.querySelectorAll('.plot.callout'),
        ];
        gsap.fromTo(
          order,
          { strokeDashoffset: 1 },
          {
            strokeDashoffset: 0,
            ease: 'none',
            stagger: 0.02,
            scrollTrigger: { trigger: fig, start: 'top 90%', end: 'top 36%', scrub: 0.7 },
          },
        );
        gsap.fromTo(
          fig.querySelectorAll('.fig-label'),
          { opacity: 0 },
          {
            opacity: 1,
            stagger: 0.05,
            ease: 'none',
            scrollTrigger: { trigger: fig, start: 'top 52%', end: 'top 38%', scrub: 0.7 },
          },
        );
      });

      // The copy beside each figure, and the figure number decoding in.
      el.querySelectorAll<HTMLElement>('[data-cap-row]').forEach((row) => {
        gsap.fromTo(
          row.querySelectorAll('[data-cap-fade]'),
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.95,
            stagger: 0.07,
            ease: 'power3.out',
            scrollTrigger: { trigger: row, start: 'top 76%' },
          },
        );
        // A finished job gets its stamp: it lands, slightly askew, like ink.
        const stamp = row.querySelector<HTMLElement>('[data-stamp]');
        if (stamp) {
          gsap.fromTo(
            stamp,
            { autoAlpha: 0, scale: 1.7, rotation: -14 },
            {
              autoAlpha: 1,
              scale: 1,
              rotation: -5,
              duration: 0.42,
              delay: 0.5,
              ease: 'power4.in',
              scrollTrigger: { trigger: row, start: 'top 64%' },
            },
          );
        }
        const num = row.querySelector<HTMLElement>('[data-fig-no]');
        if (num) {
          const text = num.textContent ?? '';
          ScrollTrigger.create({
            trigger: row,
            start: 'top 76%',
            once: true,
            onEnter: () => decode(num, text, { duration: 0.5 }),
          });
        }
      });

      // The facts count up, once, when the strip arrives.
      el.querySelectorAll<HTMLElement>('[data-count]').forEach((n) => {
        const to = Number(n.dataset.count);
        const state = { v: 0 };
        n.textContent = '0';
        gsap.to(state, {
          v: to,
          duration: ACHIEVEMENT.count.duration,
          ease: ACHIEVEMENT.count.ease,
          onUpdate: () => {
            n.textContent = String(Math.round(state.v));
          },
          scrollTrigger: { trigger: n, start: 'top 85%', once: true },
        });
      });

      return () => setSurface(false, false);
    },
    [reducedMotion],
    root,
  );

  /**
   * Where the paper is, this frame. The exposed part of the intro and the
   * whole sheet below it are paper; the unexposed part is still the room.
   * Two answers come out of it: is the top bar on paper (it inverts), and
   * does paper cover the whole frame (the scene pauses).
   */
  useTicker(() => {
    if (!near.current) return;
    const sec = root.current;
    const head = intro.current;
    if (!sec || !head) return;
    const vh = window.innerHeight;
    const ir = head.getBoundingClientRect();
    const sr = sec.getBoundingClientRect();
    const p = exposure.current;
    const exposedTop = ir.top;
    const exposedBottom = ir.top + p * ir.height;
    const onPaper = (y: number) =>
      (y >= exposedTop && y <= exposedBottom) || (y >= ir.bottom && y <= sr.bottom);
    const bar = 36;
    const covers =
      (exposedTop <= 0 && exposedBottom >= vh) ||
      (ir.bottom <= 0 && sr.bottom >= vh) ||
      (p >= 0.999 && exposedTop <= 0 && sr.bottom >= vh);
    setSurface(onPaper(bar), covers);
  });

  const live = projects.filter((p) => p.status === 'live').length;

  return (
    <section ref={root} id="capabilities" aria-label="Capabilities" className="relative">
      {/* ── The exposure ───────────────────────────────────────────────── */}
      <div ref={intro} className="relative h-[100svh] overflow-hidden">
        {/* Before it is exposed: the sheet as an outline over the room. */}
        <div aria-hidden="true" className="absolute inset-0">
          <IntroLayout ghost />
        </div>

        <div ref={paper} className="sheet-paper absolute inset-0" style={{ clipPath: 'inset(0 0 100% 0)' }}>
          <div className="sheet-grid absolute inset-0" />
          <Registration />
          <IntroLayout />
        </div>

        <div ref={scan} className="sheet-scan" style={{ top: '0%', opacity: 0 }} aria-hidden="true">
          <span ref={readout} className="t-mono" />
        </div>
      </div>

      {/* ── The figures and the facts ──────────────────────────────────── */}
      <div className="sheet-paper relative">
        <div className="sheet-grid absolute inset-0" />
        <div className="grid12 relative gap-y-[clamp(5rem,14vh,9rem)] pb-[clamp(5rem,14vh,9rem)] pt-[clamp(2rem,6vh,4rem)]">
          {capabilities.map((c, i) => (
            <article
              key={c.id}
              data-cap-row
              className="col-span-12 grid grid-cols-12 items-center gap-x-[clamp(0.75rem,1.6vw,1.75rem)] gap-y-8 border-t border-[var(--color-rule)] pt-[clamp(1.5rem,4vh,2.5rem)]"
            >
              <div className={`col-span-12 flex flex-col gap-5 md:col-span-5 ${i % 2 ? 'md:order-2 md:col-start-8' : ''}`}>
                <span data-cap-fade className="t-label flex items-center gap-4">
                  <span data-fig-no>FIG. {String(i + 1).padStart(2, '0')}</span>
                  <span className="h-px w-8 bg-[var(--color-rule)]" />
                  <span>{c.caption}</span>
                </span>
                <h3 data-cap-fade className="text-[clamp(2.2rem,4.4vw,4.2rem)] font-[600] leading-[0.98] tracking-[-0.035em]">
                  {c.title}
                </h3>
                <p data-cap-fade className="max-w-[44ch] text-[clamp(1rem,1.15vw,1.15rem)] leading-[1.55] text-[var(--color-fg-dim)]">
                  {c.body}
                </p>
                <span data-cap-fade className="t-label leading-[1.9]">
                  {c.tools.join('  ·  ')}
                </span>
              </div>
              <figure
                data-figure
                className={`col-span-12 md:col-span-6 ${i % 2 ? 'md:order-1 md:col-start-1' : 'md:col-start-7'}`}
              >
                <Figure id={c.id} />
              </figure>
            </article>
          ))}

          {/* The schedule of work: the job these were done in. */}
          {experience.map((r, i) => (
            <div
              key={r.role}
              id={i === 0 ? 'experience' : undefined}
              data-cap-row
              className="col-span-12 grid grid-cols-12 gap-x-[clamp(0.75rem,1.6vw,1.75rem)] gap-y-10 border-t border-[var(--color-rule)] pt-[clamp(1.5rem,4vh,2.5rem)]"
            >
              <div className="col-span-12 flex flex-col items-start gap-5 md:col-span-5">
                <span data-cap-fade className="t-label flex items-center gap-4">
                  <span data-fig-no>SCHEDULE {String.fromCharCode(65 + i)}</span>
                  <span className="h-px w-8 bg-[var(--color-rule)]" />
                  <span>EXPERIENCE · {r.period}</span>
                </span>
                <h3 data-cap-fade className="text-[clamp(2.2rem,4.4vw,4.2rem)] font-[600] leading-[0.98] tracking-[-0.035em]">
                  {r.role}
                </h3>
                <span data-cap-fade className="t-mono text-[var(--color-fg)]">
                  {r.company} · {r.place}
                </span>
                <p data-cap-fade className="max-w-[44ch] text-[clamp(1rem,1.15vw,1.15rem)] leading-[1.55] text-[var(--color-fg-dim)]">
                  {r.summary}
                </p>
                <span data-stamp className="sheet-stamp t-mono" style={{ opacity: 0 }}>
                  {r.status}
                </span>
              </div>
              <ol className="sheet-schedule col-span-12 md:col-span-7" aria-label={`Work at ${r.company}`}>
                <li data-cap-fade aria-hidden="true" className="sheet-schedule-head t-label">
                  <span>ITEM</span>
                  <span>WORK</span>
                  <span>BUILT WITH</span>
                </li>
                {r.items.map((it, k) => (
                  <li key={it.work} data-cap-fade className="sheet-schedule-row">
                    <span className="t-mono text-[var(--color-accent)]">{String(k + 1).padStart(2, '0')}</span>
                    <span>{it.work}</span>
                    <span className="t-label">{it.spec}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          {/* The facts: every number here is read from data. */}
          <div
            id="achievement"
            data-cap-row
            className="col-span-12 grid grid-cols-12 gap-x-[clamp(0.75rem,1.6vw,1.75rem)] gap-y-10 border-t border-[var(--color-rule)] pt-[clamp(1.5rem,4vh,2.5rem)]"
          >
            <a
              data-cap-fade
              href={achievement.certificate}
              target="_blank"
              rel="noopener noreferrer"
              className="group col-span-12 flex flex-col gap-5 md:col-span-6"
            >
              <span className="t-label">RANK · VIBE2SHIP 2026</span>
              <span className="flex items-start leading-none text-[var(--color-accent)]">
                <span aria-hidden="true" className="mt-[0.16em] text-[clamp(2rem,4vw,3.5rem)] font-[500] opacity-70">
                  #
                </span>
                <span className="sr-only">Ranked number {achievement.rank}. </span>
                <span
                  aria-hidden="true"
                  data-count={achievement.rank}
                  className="text-[clamp(6rem,16vw,13rem)] font-[700] leading-[0.82] tracking-[-0.045em] tabular-nums"
                >
                  {achievement.rank}
                </span>
              </span>
              <span className="flex flex-col gap-2 border-l border-[var(--color-rule)] pl-5 transition-colors duration-500 group-hover:border-[var(--color-accent)]">
                {achievement.lines.map((line) => (
                  <span key={line} className="t-mono block text-[var(--color-fg-dim)]">
                    {line}
                  </span>
                ))}
                <span className="t-label mt-1 text-[var(--color-fg)]">CERTIFICATE ↗</span>
              </span>
            </a>

            <div className="col-span-12 grid grid-cols-3 gap-x-6 self-end md:col-span-6">
              <Fact n={credentials.length} label="Certifications" href="/credentials" />
              <Fact n={live} label="Projects live" href="#work" />
              <Fact n={STACK.length} label="Tools in the stack" href="#constellation" />
            </div>

            <p data-cap-fade className="t-body col-span-12 max-w-[64ch] md:col-span-8">
              {achievement.footnote}
            </p>
            <div data-cap-fade className="col-span-12 flex items-end justify-start md:col-span-4 md:justify-end">
              <ArrowLink label="ALL CREDENTIALS" href="/credentials" tone="accent" />
            </div>
          </div>

          <TitleBlock />
        </div>
        {/* The sheet's end: the same ember line it was exposed by, so leaving it
            is as deliberate as arriving. */}
        <div className="sheet-end" aria-hidden="true">
          <span className="t-mono">SHEET C · END</span>
        </div>
      </div>
    </section>
  );
}

/** The intro, twice: once as an outline over the room, once in ink on paper. */
function IntroLayout({ ghost = false }: { ghost?: boolean }) {
  return (
    <div className={`grid12 relative h-full content-between gap-y-8 pb-[clamp(2rem,7vh,4.5rem)] pt-[calc(var(--nav-h)+var(--nav-clear))] ${ghost ? 'sheet-ghost' : ''}`}>
      <div className="col-span-12 flex flex-col gap-y-4">
        <div className="flex items-baseline justify-between">
          <SectionTag name="CAPABILITIES" />
          <span className="t-mono text-[var(--color-fg-dim)]">DP-01 · SHEET C</span>
        </div>
        <div className="h-px bg-[var(--color-rule)]" />
      </div>

      <h2 className="col-span-12 text-[clamp(3.6rem,11vw,11.5rem)] font-[700] leading-[0.86] tracking-[-0.05em] md:col-span-9">
        What I<br />
        build.
      </h2>

      <div className="col-span-12 flex flex-col gap-6 md:col-span-5 md:col-start-8">
        <p className="text-[clamp(1.05rem,1.35vw,1.35rem)] leading-[1.5]">
          Four things I am hired for, each one backed by work you can open on this page. Then the
          job I did them in.
        </p>
        <span className="t-label">WEB APPS · DATA · AI · REAL-TIME 3D</span>
      </div>
    </div>
  );
}

function Fact({ n, label, href }: { n: number; label: string; href: string }) {
  return (
    <a
      data-cap-fade
      href={href}
      onClick={(e) => {
        // A section on this page goes by the sheet, like the menu's do.
        if (!href.startsWith('#')) return;
        e.preventDefault();
        scrollToSection(href.slice(1), true);
      }}
      className="group flex flex-col gap-2 border-t border-[var(--color-rule)] pt-4"
    >
      <span
        data-count={n}
        className="text-[clamp(2.6rem,4.6vw,4.4rem)] font-[600] leading-none tracking-[-0.04em] tabular-nums transition-colors duration-300 group-hover:text-[var(--color-accent)]"
      >
        {n}
      </span>
      <span className="t-label">{label}</span>
    </a>
  );
}

/** Registration marks in the four corners of the sheet. */
function Registration() {
  return (
    <>
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <span key={c} aria-hidden="true" className="sheet-reg" data-c={c} />
      ))}
    </>
  );
}

/** The drawing's title block, where a drawing keeps it: bottom right. */
function TitleBlock() {
  const rows: [string, string][] = [
    ['PROJECT', 'DP-01 · THE INSTRUMENT'],
    ['SHEET', 'C · CAPABILITIES'],
    ['DRAWN', 'DEV PANCHAL'],
    ['SCALE', '1 : 1'],
  ];
  return (
    <div data-cap-row className="col-span-12 flex justify-end">
      <dl data-cap-fade className="sheet-titleblock">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="t-label">{k}</dt>
            <dd className="t-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Surface state, shared with the chrome and the scene ──────────────────── */

let lastLight = false;
let lastCovers = false;

function setSurface(light: boolean, covers: boolean) {
  if (light !== lastLight) {
    lastLight = light;
    document.documentElement.classList.toggle('on-light', light);
  }
  if (covers !== lastCovers) {
    lastCovers = covers;
    useScene.getState().setCovered(covers);
  }
}
