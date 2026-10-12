'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { SHEET } from '@/config/animation';
import { credentials } from '@/data/credentials';
import { PAGES } from '@/data/pages';
import { decode } from '@/lib/decode';
import { gsap } from '@/lib/gsap';
import { useScene } from '@/store/scene';

/**
 * THE SHEET CHANGE — how this site moves between places.
 *
 * Every page here is a sheet in one drawing set, and every route change and
 * menu jump used to happen with no ceremony at all: the old page vanished on
 * the click, a black frame sat there while the camera flew, and the new page
 * appeared already in place. That is the single biggest gap between this site
 * and the studio sites it is measured against, where every move is staged.
 *
 * So a move is now an event in three beats:
 *
 *   CLOSE  precision blades drop across the frame from alternate ends, each
 *          carrying a measuring scale on its leading edge, and lock into a
 *          plate. The destination's title block decodes in at the centre —
 *          its sheet number, its name, and a readout of the depth the camera
 *          is travelling to.
 *   HOLD   behind the plate the route changes and the camera flies to the
 *          new structure. The depth readout counts while it does. Nothing
 *          about this beat is faked: it lasts as long as the move takes, with
 *          a floor so it never flickers.
 *   OPEN   the blades carry on through in the direction they came — a pass,
 *          not a retreat — and the page's own entrance (gated on `veiled`)
 *          plays as it is uncovered.
 *
 * The blades are DOM, transform-only, so the whole thing costs the compositor
 * and not a single extra draw call in the scene behind it.
 */

/** A place a sheet can go to: what its title block says. */
interface Sheet {
  title: string;
  spec: string;
  /** World Y of the place, for the depth readout. */
  y: number;
}

const ROUTES = ['/', ...PAGES.map((p) => `/${p.slug}`), '/credentials'];

const PAGE_Y: Record<string, number> = {
  lattice: -90,
  stack: -120,
  helix: -150,
  archive: -180,
};

/** What the title block says for a pathname. */
function sheetFor(pathname: string): Sheet {
  if (pathname === '/credentials') {
    return { title: 'Credentials', spec: `ARCHIVE · ${credentials.length} PLATES`, y: PAGE_Y.archive };
  }
  const page = PAGES.find((p) => `/${p.slug}` === pathname);
  if (page) return { title: page.label, spec: page.structureLabel, y: PAGE_Y[page.structure] ?? 0 };
  return { title: 'Index', spec: 'DP-01 · THE INSTRUMENT', y: 0 };
}

function sheetNumber(pathname: string) {
  const i = Math.max(0, ROUTES.indexOf(pathname));
  return `SHEET ${String(i + 1).padStart(2, '0')} / ${String(ROUTES.length).padStart(2, '0')}`;
}

/* ── The imperative API ─────────────────────────────────────────────────── */

interface SheetImpl {
  close: (to: Sheet, label: string, fromY: number) => Promise<void>;
  open: () => Promise<void>;
}

let impl: SheetImpl | null = null;
let busy = false;

/** True while a sheet change is in progress. */
export function sheetBusy() {
  return busy;
}

/**
 * Run `middle` behind a closed sheet: close, do the move, hold at least
 * `SHEET.minHold`, open. Without the component (reduced motion, first paint)
 * `middle` simply runs.
 */
export async function runSheet(
  to: Sheet,
  label: string,
  fromY: number,
  middle: () => void | Promise<void>,
) {
  const s = useScene.getState();
  if (!impl || busy || s.reducedMotion) {
    await middle();
    return;
  }
  busy = true;
  s.setVeiled(true);
  try {
    await impl.close(to, label, fromY);
    const started = performance.now();
    await middle();
    const held = (performance.now() - started) / 1000;
    if (held < SHEET.minHold) await wait(SHEET.minHold - held);
    useScene.getState().setVeiled(false);
    await impl.open();
  } finally {
    busy = false;
    useScene.getState().setVeiled(false);
  }
}

/**
 * Hold a page's entrance until the sheet is off it. Built and set to its first
 * frame now, played the moment the blades open — so the headline rises as it
 * is uncovered instead of behind the plate. Returns the unsubscribe, for the
 * caller's cleanup.
 */
export function playWhenUncovered(tl: gsap.core.Timeline): () => void {
  if (!useScene.getState().veiled) return () => {};
  tl.pause();
  const unsub = useScene.subscribe((s) => {
    if (s.veiled) return;
    unsub();
    tl.play();
  });
  return unsub;
}

/** A section jump on the home page, behind the sheet. */
export function sheetForSection(title: string, y: number): Sheet {
  return { title, spec: `DP-01 · ${title.toUpperCase()}`, y };
}

const wait = (s: number) => new Promise<void>((r) => setTimeout(r, s * 1000));

/* ── The component ──────────────────────────────────────────────────────── */

export function SheetTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const meta = useRef<HTMLSpanElement>(null);
  const spec = useRef<HTMLSpanElement>(null);
  const depth = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  // Route arrival is awaited by the move: resolved when the pathname changes.
  const pathRef = useRef(pathname);
  const arrivals = useRef<{ path: string; resolve: () => void }[]>([]);
  useEffect(() => {
    pathRef.current = pathname;
    arrivals.current = arrivals.current.filter((a) => {
      if (a.path !== pathname) return true;
      a.resolve();
      return false;
    });
  }, [pathname]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const blades = [...el.querySelectorAll<HTMLElement>('[data-blade]')];
    let readout: gsap.core.Tween | null = null;
    let stopDecode: (() => void) | null = null;

    const fmt = (y: number) => `${y < 0 ? '−' : y > 0 ? '+' : ' '}${Math.abs(y).toFixed(2).padStart(6, '0')}`;

    impl = {
      close: (to, label, fromY) =>
        new Promise<void>((resolve) => {
          gsap.killTweensOf([blades, plate.current]);
          gsap.set(el, { visibility: 'visible' });
          gsap.set(blades, { yPercent: (i) => (i % 2 === 0 ? -101 : 101) });
          gsap.set(plate.current, { autoAlpha: 0, y: 12 });
          if (meta.current) meta.current.textContent = label;
          if (spec.current) spec.current.textContent = to.spec;
          if (title.current) title.current.textContent = '';
          if (depth.current) depth.current.textContent = fmt(fromY);
          gsap.set(bar.current, { scaleX: 0 });

          const tl = gsap.timeline({ onComplete: resolve });
          tl.to(blades, {
            yPercent: 0,
            duration: SHEET.close,
            ease: 'expo.inOut',
            stagger: { each: SHEET.stagger, from: 'center' },
          });
          tl.to(plate.current, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, SHEET.close * 0.55);
          tl.add(() => {
            if (!title.current) return;
            stopDecode?.();
            stopDecode = decode(title.current, to.title, { duration: 0.55 });
          }, SHEET.close * 0.55);

          // The depth readout counts the camera's journey, through the hold.
          const counter = { y: fromY };
          readout?.kill();
          readout = gsap.to(counter, {
            y: to.y,
            duration: SHEET.close * 0.5 + SHEET.minHold + 0.25,
            delay: SHEET.close * 0.55,
            ease: 'power2.inOut',
            onUpdate: () => {
              if (depth.current) depth.current.textContent = fmt(counter.y);
            },
          });
          gsap.to(bar.current, {
            scaleX: 1,
            duration: SHEET.close * 0.5 + SHEET.minHold + 0.25,
            delay: SHEET.close * 0.55,
            ease: 'power1.inOut',
          });
        }),
      open: () =>
        new Promise<void>((resolve) => {
          const tl = gsap.timeline({
            onComplete: () => {
              gsap.set(el, { visibility: 'hidden' });
              resolve();
            },
          });
          tl.to(plate.current, { autoAlpha: 0, y: -10, duration: 0.24, ease: 'power2.in' });
          // On through, in the direction each blade came: a pass, not a retreat.
          tl.to(
            blades,
            {
              yPercent: (i) => (i % 2 === 0 ? 101 : -101),
              duration: SHEET.open,
              ease: 'expo.inOut',
              stagger: { each: SHEET.stagger, from: 'edges' },
            },
            0.08,
          );
        }),
    };

    return () => {
      impl = null;
      readout?.kill();
      stopDecode?.();
    };
  }, []);

  /**
   * Internal links, intercepted before the router sees them. Capture phase on
   * the document, so it runs ahead of next/link's own handler; anything this
   * does not want — a new tab, a modifier, a download, a file, an anchor on
   * the same page — is left completely alone.
   */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a') : null;
      if (!a || !a.href) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
      if (!ROUTES.includes(url.pathname)) return;

      e.preventDefault();
      e.stopPropagation();
      useScene.getState().toggleMenu(false);

      const to = sheetFor(url.pathname);
      const from = sheetFor(window.location.pathname);
      const href = url.pathname + url.search + url.hash;
      void runSheet(to, sheetNumber(url.pathname), from.y, async () => {
        const arrived = new Promise<void>((resolve) => {
          if (pathRef.current === url.pathname) resolve();
          else arrivals.current.push({ path: url.pathname, resolve });
          // A route that never reports in still has to open the sheet.
          setTimeout(resolve, 4000);
        });
        router.push(href, { scroll: !url.hash });
        await arrived;
        // The camera's flight to the new structure, which the hold covers.
        await wait(SHEET.cameraHold);
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="sheet pointer-events-none fixed inset-0 z-[110]"
      style={{ visibility: 'hidden' }}
    >
      {Array.from({ length: SHEET.blades }, (_, i) => (
        <div
          key={i}
          data-blade
          className="sheet-blade"
          data-dir={i % 2 === 0 ? 'down' : 'up'}
          style={{ left: `${(i * 100) / SHEET.blades}%`, width: `calc(${100 / SHEET.blades}% + 1px)` }}
        >
          <span className="sheet-scale" />
          <span className="sheet-edge" />
        </div>
      ))}

      <div ref={plate} className="sheet-plate">
        <span className="sheet-corner" data-c="tl" />
        <span className="sheet-corner" data-c="tr" />
        <span className="sheet-corner" data-c="bl" />
        <span className="sheet-corner" data-c="br" />
        <span ref={meta} className="t-label block text-[var(--color-fg-dim)]" />
        <div ref={title} className="sheet-title" />
        <div className="flex items-baseline justify-between gap-6">
          <span ref={spec} className="t-label text-[var(--color-fg-dim)]" />
          <span className="t-mono text-[var(--color-fg)]">
            Y <span ref={depth} className="tabular-nums" />
          </span>
        </div>
        <span className="sheet-bar">
          <span ref={bar} />
        </span>
      </div>
    </div>
  );
}

export { sheetFor };
