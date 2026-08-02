'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { credentials, type Credential } from '@/data/credentials';
import { PAGES } from '@/data/pages';
import { gsap, ScrollTrigger, useGsap } from '@/lib/gsap';
import { PageFooter } from '@/components/PageFooter';
import { PageLoader } from '@/components/PageLoader';
import { ArrowLink } from '@/components/ui/ArrowLink';
import { CornerMarks, SectionTag, useCursorTarget, useFooterFloor, useRailFade } from '@/components/ui/primitives';
import { archiveHandle } from '@/scenes/handles';
import { useScene } from '@/store/scene';

/** One plate per credential — the label states what is actually on screen. */
const STRUCTURE_LABEL = `ARCHIVE · ${credentials.length} PLATES`;

/**
 * How many rows open a certificate, and how many are evidenced by badges.
 *
 * Counted from the data rather than written into the sentence, because the
 * sentence used to say "every one of them opens the actual certificate" and two
 * of them do not — a claim that the note at the bottom of the page then went on
 * to contradict. Derived, it cannot drift when a row is added.
 */
const WITH_CERTIFICATE = credentials.filter((c) => c.url).length;
const WITH_BADGES = credentials.length - WITH_CERTIFICATE;

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
/** Small numbers are set as words in running copy; large ones stay numerals. */
const word = (n: number) => WORDS[n] ?? String(n);

/**
 * /credentials — the register.
 *
 * A ledger, not a grid of certificate thumbnails. One hairline-ruled row per
 * credential, monospace date column, display-weight title, dimmed issuer set
 * right. The reason is the same one that governs the rest of the site: a
 * certificate rendered as a card invites the reader to judge the graphic
 * design of somebody else's PDF template. Set as a register, the row is the
 * claim and the link is the evidence.
 *
 * This does not reuse PageShell. It shares the shell's furniture — the loader,
 * the masthead proportions, the onward nav, its own footer — but its body is a
 * table rather than a run of title/body entries, and forcing that through
 * `PageDef.entries` would mean bending the interior-page model around one page.
 */
export function CredentialsShell() {
  const root = useRef<HTMLElement>(null);
  const footer = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const setStructure = useScene((s) => s.setStructure);
  const setShot = useScene((s) => s.setShot);
  const setSection = useScene((s) => s.setSection);
  const entered = useScene((s) => s.entered);
  const reducedMotion = useScene((s) => s.reducedMotion);

  useFooterFloor(footer);
  useRailFade(rail);

  useEffect(() => {
    setStructure('archive');
    setShot('archive');
    setSection('CREDENTIALS');
    return () => setStructure(null);
  }, [setStructure, setShot, setSection]);

  /**
   * Scrolling the register turns the archive.
   *
   * The scene reads `archiveHandle.scroll` every frame and damps it a second
   * time, so this only has to report where the reader is. Written to a module
   * handle rather than to the store for the usual reason: it changes on every
   * scroll frame, and routing that through React would re-render the page sixty
   * times a second to move an object the DOM does not own.
   */
  useGsap(
    () => {
      const el = root.current;
      if (!el) return;
      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          archiveHandle.scroll = self.progress;
        },
      });
      return () => st.kill();
    },
    [],
    root,
  );

  // Leaving the page must clear the hover, or the plate that happened to be lit
  // when the reader navigated away stays lit for the next visit.
  useEffect(() => () => {
    archiveHandle.hover = -1;
  }, []);

  useGsap(
    () => {
      if (!entered) return;

      if (reducedMotion) {
        gsap.set('[data-page-line] > span', { yPercent: 0 });
        gsap.set('[data-page-fade], [data-row]', { autoAlpha: 1, y: 0 });
        return;
      }

      gsap
        .timeline({ delay: 0.1 })
        .fromTo(
          '[data-page-line] > span',
          { yPercent: 112 },
          { yPercent: 0, duration: 1.15, stagger: 0.08, ease: 'expo.out' },
        )
        .fromTo(
          '[data-page-fade]',
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.06, ease: 'power3.out' },
          '-=0.75',
        );

      // Rows arrive one after another down the page. The stagger is tighter
      // than the interior pages' entries because there are eleven of these and
      // not four — at 0.09 the last row lands a full second after the first,
      // which stops being a reveal and starts being a wait.
      gsap.fromTo(
        '[data-row]',
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.85,
          stagger: 0.045,
          ease: 'power3.out',
          scrollTrigger: { trigger: '[data-ledger]', start: 'top 82%' },
        },
      );
    },
    [entered, reducedMotion],
    root,
  );

  return (
    <article ref={root} className="relative">
      <PageLoader label="Credentials" spec={STRUCTURE_LABEL} />

      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      {/* Same construction as PageShell's masthead — see the notes there for
          why the rail is sticky and why the padding is derived from --nav-h. */}
      <header className="relative flex min-h-[92svh] flex-col pb-[clamp(2rem,6vh,4rem)] pt-[calc(var(--nav-h)+var(--nav-clear))]">
        <CornerMarks />

        <div className="flex-1">
          <div
            ref={rail}
            className="grid12 sticky top-[calc(var(--nav-h)+var(--nav-clear))] z-30 gap-y-6"
          >
            <div className="col-span-12 flex flex-wrap items-baseline justify-between gap-4">
              <SectionTag name="CREDENTIALS" />
              <span className="t-mono text-[var(--color-fg-dim)]">{STRUCTURE_LABEL}</span>
            </div>
            <div className="col-span-12 h-px bg-[var(--color-rule)]" />
          </div>
        </div>

        <div className="grid12 gap-y-8">
          <h1 className="col-span-12 lg:col-span-7">
            <span className="sr-only">Everything, on paper.</span>
            <span aria-hidden="true" className="t-display block">
              {['Everything,', 'on paper.'].map((line) => (
                <span key={line} data-page-line className="line-mask">
                  <span className="block will-change-transform">{line}</span>
                </span>
              ))}
            </span>
          </h1>

          <p
            data-page-fade
            className="t-lead col-span-12 max-w-[38ch] text-[var(--color-fg-dim)] opacity-0 lg:col-span-5 lg:col-start-8 lg:self-end"
          >
            {credentials.length} credentials. {word(WITH_CERTIFICATE)} open the
            certificate; {word(WITH_BADGES).toLowerCase()} carry their badges.
          </p>
        </div>
      </header>

      {/* ── The ledger ───────────────────────────────────────────────────── */}
      <section
        data-ledger
        aria-label="Credentials"
        className="relative py-[clamp(2rem,7vh,5rem)]"
      >
        <div className="grid12">
          <div className="col-span-12">
            {/* Column header. Monospace, sub-label size — it is a key to the
                columns, not a heading. */}
            <div className="hidden items-baseline gap-6 pb-4 md:flex">
              <span className="t-label w-[7.5rem] shrink-0">DATE</span>
              <span className="t-label flex-1">CREDENTIAL</span>
              <span className="t-label text-right">ISSUER</span>
            </div>

            {credentials.map((c, i) => (
              <Row key={`${c.date}-${c.title}`} credential={c} index={i} />
            ))}
            <div className="h-px w-full bg-[var(--color-rule)]" />
          </div>
        </div>

        <div className="grid12 mt-[clamp(2rem,6vh,4rem)]">
          <p className="t-body col-span-12 max-w-[54ch] lg:col-span-7">
            {word(WITH_BADGES)} of these were issued as digital badges rather
            than as a certificate. Those rows carry the badges themselves and no
            certificate link, because there is no certificate to link to.
          </p>
        </div>
      </section>

      {/* ── Onward ───────────────────────────────────────────────────────── */}
      <nav ref={footer} aria-label="More pages" className="relative py-[clamp(3rem,10vh,7rem)]">
        <div className="grid12 gap-y-6">
          <span className="t-label col-span-12">KEEP LOOKING</span>
          <div className="col-span-12 h-px bg-[var(--color-rule)]" />

          {PAGES.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className="group col-span-12 flex items-baseline justify-between gap-6 border-b border-[var(--color-rule)] py-[clamp(1.25rem,3vh,2.25rem)]"
            >
              <span className="t-h2 transition-transform duration-700 ease-[var(--ease-reveal)] group-hover:translate-x-3">
                {p.label}
              </span>
              <span className="t-label hidden text-right md:block">{p.standfirst}</span>
              <span aria-hidden="true" className="t-mono text-[var(--color-accent)]">
                ↗
              </span>
            </Link>
          ))}

          <div className="col-span-12 pt-[clamp(1.5rem,4vh,3rem)]">
            <ArrowLink label="BACK TO INDEX" href="/" tone="accent" />
          </div>
        </div>
      </nav>

      <PageFooter slug="credentials" />
    </article>
  );
}

/* ── One row ──────────────────────────────────────────────────────────────── */

function Row({ credential, index }: { credential: Credential; index: number }) {
  const { date, title, issuer, url, badges } = credential;

  return url ? (
    <LinkedRow {...credential} index={index} />
  ) : (
    <PlainRow date={date} title={title} issuer={issuer} badges={badges} index={index} />
  );
}

/**
 * Points the archive at the row under the pointer.
 *
 * Every row gets this, linked or not: the plate is evidence that the record
 * exists, which is as true of a badge-only row as of one with a certificate
 * behind it. Returns handlers rather than taking a ref so it composes with
 * `useCursorTarget`, which already owns the ref on the linked rows.
 */
function archiveHover(index: number) {
  return {
    onPointerEnter: () => {
      archiveHandle.hover = index;
    },
    onPointerLeave: () => {
      if (archiveHandle.hover === index) archiveHandle.hover = -1;
    },
  };
}

const ROW_CLASS =
  'relative flex flex-col gap-x-6 gap-y-2 border-t border-[var(--color-rule)] py-[clamp(1rem,2.6vh,1.6rem)] md:flex-row md:items-baseline';

/**
 * The interactive row.
 *
 * On hover an ember rule sweeps to full width along the top edge and a short
 * tick appears in the left margin. That is the same gesture the site's links
 * already use, at the scale of a whole row — and it is the only affordance,
 * because a chevron or a button on every one of eleven rows would turn the
 * register into a list of controls.
 */
function LinkedRow({ date, title, issuer, url, index }: Credential & { index: number }) {
  const ref = useCursorTarget<HTMLAnchorElement>();

  return (
    <a
      ref={ref}
      data-row
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group opacity-0 ${ROW_CLASS}`}
      {...archiveHover(index)}
    >
      {/* The rule that extends. Sits on the row's own top edge, over the
          structural hairline the border provides. */}
      <span
        aria-hidden="true"
        className="absolute -top-px left-0 block h-px w-0 bg-[var(--color-accent)] transition-all duration-700 ease-[var(--ease-reveal)] group-hover:w-full"
      />
      {/* The tick. Outside the text column, in the margin, so it never shifts
          anything when it appears. */}
      <span
        aria-hidden="true"
        className="absolute -left-4 top-1/2 block h-3 w-px origin-center -translate-y-1/2 scale-y-0 bg-[var(--color-accent)] transition-transform duration-500 ease-[var(--ease-reveal)] group-hover:scale-y-100 md:-left-5"
      />

      <span className="t-mono w-[7.5rem] shrink-0 text-[var(--color-fg-dim)]">{date}</span>
      <span className="flex-1 text-[clamp(1.05rem,1.9vw,1.5rem)] font-[500] leading-[1.22] tracking-[-0.02em] text-[var(--color-fg)] transition-colors duration-500 group-hover:text-[var(--color-accent)]">
        {title}
      </span>
      <span className="t-label shrink-0 md:text-right">{issuer}</span>
    </a>
  );
}

/**
 * The non-interactive row.
 *
 * A row with no certificate is plain text: no hover rule, no tick, no cursor
 * change. Promising a click that does not exist is worse than the row looking
 * quieter than its neighbours — and the badges below it are the real evidence,
 * so they are the things that are clickable.
 */
function PlainRow({
  date,
  title,
  issuer,
  badges,
  index,
}: {
  date: string;
  title: string;
  issuer: string;
  badges?: Credential['badges'];
  index: number;
}) {
  return (
    <div data-row className={`opacity-0 ${ROW_CLASS}`} {...archiveHover(index)}>
      <span className="t-mono w-[7.5rem] shrink-0 text-[var(--color-fg-dim)]">{date}</span>

      <span className="flex flex-1 flex-col gap-4">
        <span className="text-[clamp(1.05rem,1.9vw,1.5rem)] font-[500] leading-[1.22] tracking-[-0.02em] text-[var(--color-fg)]">
          {title}
        </span>

        {badges && (
          <span className="flex flex-wrap gap-3">
            {badges.map((b) => (
              <Badge key={b.file} file={b.file} name={b.name} />
            ))}
          </span>
        )}
      </span>

      <span className="t-label shrink-0 md:text-right">{issuer}</span>
    </div>
  );
}

/**
 * A badge graphic.
 *
 * These are the only colour on the page and they are somebody else's — bright,
 * circular, gradient-filled things dropped onto a near-black register. At full
 * value three of them in a row dominate the section they are evidence for, so
 * they sit dimmed and desaturated and come up on hover. They punctuate; they
 * do not lead.
 */
function Badge({ file, name }: { file: string; name: string }) {
  const ref = useCursorTarget<HTMLAnchorElement>();

  return (
    <a
      ref={ref}
      href={`/credentials/badges/${file}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
      aria-label={`${name} badge`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/credentials/badges/${file}`}
        alt={name}
        width={56}
        height={56}
        loading="lazy"
        decoding="async"
        className="block h-14 w-14 opacity-45 saturate-[0.55] transition-all duration-500 ease-[var(--ease-reveal)] hover:scale-[1.06] hover:opacity-100 hover:saturate-100"
      />
    </a>
  );
}
