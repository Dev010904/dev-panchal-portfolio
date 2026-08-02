'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { MENU, TRANSITION } from '@/config/animation';
import { PAGES } from '@/data/pages';
import { EMAIL_PARTS, NAV_SECTIONS, SOCIALS, site } from '@/data/site';
import { gsap, useGsap } from '@/lib/gsap';
import { getLenis } from '@/components/SmoothScroll';
import { useTicker } from '@/lib/useTicker';
import { Cursor } from '@/components/Cursor';
import { MarkGlyph } from '@/components/ui/MarkGlyph';
import { useCursorTarget } from '@/components/ui/primitives';
import { wipeHandle } from '@/scenes/handles';
import { useScene } from '@/store/scene';

/** Global chrome: nav, menu overlay, scroll progress, cursor. */
export function Chrome() {
  return (
    <>
      <Nav />
      <MenuOverlay />
      <ScrollProgress />
      <Cursor />
    </>
  );
}

/* ── Nav ──────────────────────────────────────────────────────────────────── */

function Nav() {
  const entered = useScene((s) => s.entered);
  const menuOpen = useScene((s) => s.menuOpen);
  const toggleMenu = useScene((s) => s.toggleMenu);
  const root = useRef<HTMLElement>(null);
  const home = useCursorTarget<HTMLAnchorElement>();
  const button = useCursorTarget<HTMLButtonElement>();

  useGsap(
    () => {
      if (!entered) return;
      gsap.fromTo(
        '[data-nav-item]',
        { autoAlpha: 0, y: -12 },
        { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', delay: 0.35 },
      );
    },
    [entered],
    root,
  );

  return (
    <header
      ref={root}
      // Padding and min-height both come from the shared --nav-* tokens, so the
      // bar's real height is exactly the number the pages below it clear by.
      // See the note on --nav-h in globals.css.
      //
      // `data-topbar` is how every rail finds the thing it has to stay clear of.
      // Measured rather than assumed, because the bar's height is a clamp and
      // the rails need the resolved pixel value — see useRailFade.
      data-topbar
      className="fixed inset-x-0 top-0 z-[100] flex min-h-[var(--nav-h)] items-center justify-between px-[var(--gutter)] py-[var(--nav-pad-y)] mix-blend-difference"
    >
      <Link
        ref={home}
        href="/"
        data-nav-item
        className="flex items-center gap-3 text-[var(--color-fg)] opacity-0"
        onClick={(e) => {
          if (window.location.pathname !== '/') return;
          e.preventDefault();
          scrollToSection('index');
        }}
      >
        <MarkGlyph size={22} />
        <span className="t-label text-[var(--color-fg)]">DEV PANCHAL</span>
      </Link>

      <div className="flex items-center gap-3">
        <a
          data-nav-item
          href={site.whatsapp.href}
          target="_blank"
          rel="noopener noreferrer"
          className="chip t-label hidden text-[var(--color-fg)] opacity-0 transition-colors hover:border-[var(--color-fg-dim)] sm:inline-flex"
        >
          LET&apos;S TALK
        </a>

        <button
          ref={button}
          data-nav-item
          type="button"
          onClick={() => toggleMenu()}
          aria-expanded={menuOpen}
          aria-controls="menu-overlay"
          className="chip t-label text-[var(--color-fg)] opacity-0 transition-colors hover:border-[var(--color-fg-dim)]"
        >
          {menuOpen ? 'CLOSE' : 'MENU'}
          <span aria-hidden="true" className="flex flex-col gap-[3px]">
            <span
              className="block h-px w-3.5 bg-current transition-transform duration-500"
              style={{ transform: menuOpen ? 'translateY(2px) rotate(45deg)' : 'none' }}
            />
            <span
              className="block h-px w-3.5 bg-current transition-transform duration-500"
              style={{ transform: menuOpen ? 'translateY(-2px) rotate(-45deg)' : 'none' }}
            />
          </span>
        </button>
      </div>
    </header>
  );
}

/* ── Menu overlay ─────────────────────────────────────────────────────────── */

/** The four scroll destinations the drawer lists, in page order. */
const MENU_SECTIONS = ['index', 'work', 'about', 'contact'] as const;

/**
 * THE DRAWER.
 *
 * An opaque off-white panel over the right ~30% of the viewport, dark text on
 * it, hard edge, no transparency and no backdrop blur.
 *
 * What it replaced: a transparent full-bleed layer that rendered the menu
 * links directly over the hero headline. "Index" landed on top of "Static is"
 * and neither was readable. Any amount of translucency here reproduces that
 * failure in a milder form, which is why the panel is a flat fill.
 *
 * The scene behind it keeps running, unblurred and undesaturated. That is a
 * deliberate reversal of what was here before (a real post-process blur pass):
 * the contrast between a live dark 3D room and a flat white card is the entire
 * effect, and blurring the room throws it away.
 */
function MenuOverlay() {
  const menuOpen = useScene((s) => s.menuOpen);
  const toggleMenu = useScene((s) => s.toggleMenu);
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const onHome = usePathname() === '/';

  useEffect(() => {
    setMounted(true);
    // Same assembly-on-mount as components/ui/Email — the address never exists
    // as a contiguous string in the served HTML.
    setAddress(EMAIL_PARTS.join(''));
  }, []);

  useEffect(() => {
    const lenis = getLenis();
    if (menuOpen) lenis?.stop();
    else lenis?.start();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleMenu(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, toggleMenu]);

  // First layout pass parks the panel off-screen without animating. Without
  // this the closed branch below would run on mount and slide a visible panel
  // out on first paint.
  const settled = useRef(false);

  useGsap(
    () => {
      const el = root.current;
      if (!el) return;

      // `x: 0` on every one of these is load-bearing, not tidiness.
      //
      // GSAP stores x and xPercent as two separate components of the same
      // translate. If the element's starting transform comes from CSS as a
      // percentage, GSAP resolves it to PIXELS in `x` and leaves `xPercent` at
      // zero. Animating xPercent alone then slides the panel relative to a
      // stale 457px offset that nothing ever clears, and it never reaches the
      // screen — with no error, and a transform that looks almost right.
      if (!settled.current) {
        settled.current = true;
        gsap.set(el, { x: 0, xPercent: 100, visibility: 'hidden', pointerEvents: 'none' });
        if (!menuOpen) return;
      }

      if (menuOpen) {
        gsap.set(el, { pointerEvents: 'auto', visibility: 'visible' });
        gsap
          .timeline()
          .fromTo(
            el,
            { x: 0, xPercent: 100 },
            {
              xPercent: 0,
              duration: MENU.open.duration,
              ease: MENU.open.ease,
            },
          )
          // Contents arrive after the panel has landed, not with it. Sliding
          // the type in on the same tween makes the panel look like a video of
          // a menu rather than a surface carrying one.
          .fromTo(
            '[data-menu-item]',
            { autoAlpha: 0, y: 22 },
            {
              autoAlpha: 1,
              y: 0,
              duration: MENU.item.duration,
              stagger: MENU.item.stagger,
              ease: MENU.item.ease,
            },
            MENU.item.delay,
          );
      } else {
        gsap.fromTo(
          el,
          { x: 0, xPercent: 0 },
          {
            xPercent: 100,
            duration: MENU.close.duration,
            ease: MENU.close.ease,
            onComplete: () => gsap.set(el, { pointerEvents: 'none', visibility: 'hidden' }),
          },
        );
      }
    },
    [menuOpen],
    root,
  );

  if (!mounted) return null;

  const close = () => useScene.getState().toggleMenu(false);
  const tab = menuOpen ? 0 : -1;

  return (
    <div
      ref={root}
      id="menu-overlay"
      // z-[95] deliberately sits under the header's z-[100] so the top bar —
      // and the CLOSE control in it — stays above the panel.
      className="pointer-events-none fixed right-0 top-0 z-[95] flex h-[100dvh] flex-col justify-between overflow-y-auto bg-[#f4f3ef] px-[clamp(1.5rem,2.6vw,3rem)] pb-[clamp(2rem,5vh,3.5rem)] pt-[clamp(6rem,14vh,10rem)] text-[#0a0a0c]"
      // No transform here on purpose — see the note in the effect above. The
      // pre-JS paint is hidden by `visibility` alone, and GSAP owns the
      // transform from its first frame so there is nothing for it to misparse.
      style={{ width: 'min(88vw, max(320px, 30vw))', visibility: 'hidden' }}
      aria-hidden={!menuOpen}
    >
      <nav className="flex flex-col gap-[clamp(0.1rem,0.7vh,0.5rem)]">
        {MENU_SECTIONS.map((id) => {
          const s = NAV_SECTIONS.find((n) => n.id === id)!;
          return (
            <a
              key={s.id}
              data-menu-item
              // Section links are scroll positions on the home page. From an
              // interior page they have to become a real navigation, or the
              // link silently does nothing.
              href={onHome ? `#${s.id}` : `/#${s.id}`}
              onClick={(e) => {
                close();
                if (!onHome) return;
                e.preventDefault();
                scrollToSection(s.id, true);
              }}
              className="group inline-flex w-fit items-baseline text-[clamp(1.9rem,2.7vw,3rem)] font-[500] leading-[1.24] tracking-[-0.03em] text-[#0a0a0c] transition-colors duration-300 hover:text-[var(--color-accent)]"
              tabIndex={tab}
            >
              {s.display}
            </a>
          );
        })}

        {/* Interior pages continue the same stack. They are a different kind of
            destination — a whole page rather than a scroll position — so they
            sit below a hairline instead of being interleaved. */}
        <span data-menu-item className="my-[clamp(0.6rem,1.6vh,1.1rem)] block h-px w-full bg-[#0a0a0c]/12" />

        {/* `credentials` is a static route rather than a `data/pages.ts`
            entry — see app/credentials/page.tsx — so it is listed alongside
            them rather than through the same map. */}
        {[...PAGES.map((p) => ({ slug: p.slug, label: p.label })), {
          slug: 'credentials',
          label: 'Credentials',
        }].map((p) => (
          <Link
            key={p.slug}
            data-menu-item
            href={`/${p.slug}`}
            onClick={close}
            className="inline-flex w-fit text-[clamp(1.9rem,2.7vw,3rem)] font-[500] leading-[1.24] tracking-[-0.03em] text-[#0a0a0c] transition-colors duration-300 hover:text-[var(--color-accent)]"
            tabIndex={tab}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="mt-[clamp(2.5rem,7vh,5rem)] flex flex-col gap-[clamp(1.25rem,3vh,2rem)]">
        <div data-menu-item className="flex flex-col gap-2">
          <span className="t-label text-[#0a0a0c]/45">CONTACT</span>
          <a
            href={address ? `mailto:${address}` : undefined}
            onClick={close}
            className="break-all text-[clamp(0.9rem,1.05vw,1.05rem)] text-[#0a0a0c] underline-offset-4 transition-colors hover:text-[var(--color-accent)] hover:underline"
            tabIndex={tab}
            suppressHydrationWarning
          >
            {address ?? ' '}
          </a>
        </div>

        <div data-menu-item className="flex flex-col gap-2">
          <span className="t-label text-[#0a0a0c]/45">SOCIAL</span>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {SOCIALS.map((s) => (
              <a
                key={s.key}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="text-[clamp(0.95rem,1.15vw,1.15rem)] text-[#0a0a0c] transition-colors hover:text-[var(--color-accent)]"
                tabIndex={tab}
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Scroll progress ──────────────────────────────────────────────────────── */

function ScrollProgress() {
  const bar = useRef<HTMLSpanElement>(null);
  const entered = useScene((s) => s.entered);
  // The indicator lives at the right edge, which is exactly where the drawer
  // opens. Left visible it renders pale grey on the white panel and reads as a
  // rendering fault.
  const menuOpen = useScene((s) => s.menuOpen);
  const section = useScene((s) => s.activeSection);
  const [displayed, setDisplayed] = useState(section);
  const label = useRef<HTMLSpanElement>(null);

  // Written straight to the style rather than through React: this changes on
  // every scroll frame and a state update per frame would re-render the tree.
  const shown = useRef(0);
  useTicker((delta) => {
    const p = useScene.getState().scrollProgress;
    shown.current += (p - shown.current) * (1 - Math.exp(-14 * delta));
    if (bar.current) bar.current.style.transform = `scaleY(${shown.current})`;
  });

  // Crossfade the section name rather than swapping it — a hard swap on a
  // fixed element is the kind of small jump that makes a site feel unfinished.
  useGsap(() => {
    if (section === displayed) return;
    const el = label.current;
    if (!el) {
      setDisplayed(section);
      return;
    }
    gsap.to(el, {
      autoAlpha: 0,
      y: -6,
      duration: 0.28,
      ease: 'power2.in',
      onComplete: () => {
        setDisplayed(section);
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 6 },
          { autoAlpha: 1, y: 0, duration: 0.42, ease: 'power3.out' },
        );
      },
    });
  }, [section]);

  return (
    // Right edge, vertically centred. It started bottom-left, which is where
    // every section's copy column also lives — the two collided on every
    // single screen. Mid-right is the one band of the viewport that no
    // section puts content in.
    <div
      className={`fixed right-[calc(var(--gutter)*0.5)] top-1/2 z-[100] hidden -translate-y-1/2 flex-col items-center gap-4 transition-opacity duration-500 lg:flex ${
        entered && !menuOpen ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden="true"
    >
      <span ref={label} className="t-label [writing-mode:vertical-rl]">
        {displayed}
      </span>
      <div className="relative h-24 w-px bg-[var(--color-rule)]">
        <span
          ref={bar}
          className="absolute inset-x-0 top-0 block h-full origin-top scale-y-0 bg-[var(--color-fg)]"
        />
      </div>
    </div>
  );
}

/* ── Navigation ───────────────────────────────────────────────────────────── */

/**
 * Scrolls to a section, optionally behind the shader wipe. The wipe covers the
 * viewport at its midpoint, which is where the scroll jump happens — so a long
 * jump never shows the intervening sections streaking past.
 */
export function scrollToSection(id: string, withWipe = false) {
  const el = document.getElementById(id);
  if (!el) return;
  const lenis = getLenis();

  const jump = () => {
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.2 });
    else el.scrollIntoView({ behavior: 'smooth' });
  };

  if (!withWipe || useScene.getState().reducedMotion) {
    jump();
    return;
  }

  wipeHandle.active = true;
  let jumped = false;

  gsap.fromTo(
    wipeHandle,
    { value: 0 },
    {
      value: 1,
      duration: TRANSITION.duration,
      ease: TRANSITION.ease,
      onUpdate: () => {
        // Fire the jump exactly when the panel is fully closed, so a long
        // scroll never shows the intervening sections streaking past.
        if (wipeHandle.value >= 0.5 && !jumped) {
          jumped = true;
          if (lenis) lenis.scrollTo(el, { immediate: true });
          else el.scrollIntoView();
        }
      },
      onComplete: () => {
        wipeHandle.active = false;
        wipeHandle.value = 0;
      },
    },
  );
}
