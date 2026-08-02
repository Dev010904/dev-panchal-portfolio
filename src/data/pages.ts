/**
 * INTERIOR PAGES.
 *
 * Each page pairs a procedural 3D structure with content that is actually
 * true. Nothing here is a fabricated credential, a made-up statistic or an
 * invented client. Where a number appears it is a real, checkable property of
 * the platform — the sort of thing a developer can verify in five minutes —
 * because a portfolio that pads itself with plausible-sounding figures is
 * worse than one that says less.
 */

import type { StructureId } from '@/lib/structures';
import type { ShotName } from '@/config/animation';

export interface PageEntry {
  title: string;
  body: string;
}

export interface PageDef {
  slug: string;
  /** Menu + page label. */
  label: string;
  /**
   * Oversized page headline, authored as explicit lines.
   *
   * Splitting on spaces and letting each word be its own line was the first
   * attempt and it produced a four-line headline out of "How it gets built" —
   * the reveal animation needs per-line wrappers, so the line breaks have to
   * be a typographic decision made here, not a side effect of word count.
   */
  headlineLines: string[];
  /** One line under the headline. */
  standfirst: string;
  structure: StructureId;
  shot: ShotName;
  /** Monospace label for the structure, shown as a spec line. */
  structureLabel: string;
  entries: PageEntry[];
  /** Closing line. */
  outro: string;
}

export const PAGES: PageDef[] = [
  {
    slug: 'process',
    label: 'Process',
    headlineLines: ['How it', 'gets built.'],
    standfirst: 'Four stages. No discovery workshops, no decks about decks.',
    structure: 'lattice',
    shot: 'lattice',
    structureLabel: 'LATTICE · INSTANCED',
    entries: [
      {
        title: 'Decide what it is',
        body: 'One sentence describing what the site has to do, and who it has to do it for. If that sentence is hard to write, the site will be hard to build. Everything downstream gets checked against it.',
      },
      {
        title: 'Build the spine first',
        body: 'Structure, type, spacing and content in the browser, before anything moves. Motion added to a layout that does not work yet just makes a broken layout more expensive to fix.',
      },
      {
        title: 'Then make it move',
        body: 'Motion is added last and cut hard. Every transition has to earn its milliseconds — if removing it makes the page better, it goes.',
      },
      {
        title: 'Ship, measure, tighten',
        body: 'Real devices, real connections, real Lighthouse runs. A site that only performs on the machine it was built on is not finished.',
      },
    ],
    outro: 'The whole thing usually takes less time than the discovery phase would have.',
  },
  {
    slug: 'stack',
    label: 'Stack',
    headlineLines: ['What it is', 'made of.'],
    standfirst: 'Tools chosen for what they do, not for what they signal.',
    structure: 'stack',
    shot: 'stack',
    structureLabel: 'STACK · 14 PLATES',
    entries: [
      {
        title: 'Next.js + TypeScript',
        body: 'Server rendering for the content, strict types for everything else. Strict mode is not optional — it is the only setting where the compiler is actually working for you.',
      },
      {
        title: 'Three.js / WebGL',
        body: 'The GPU draws; the CPU only tells it what to draw. Most 3D web performance work is about sending fewer, larger instructions rather than making the geometry smaller.',
      },
      {
        title: 'GSAP + ScrollTrigger',
        body: 'One animation authority. Two libraries animating the same property is the most common cause of motion that stutters for no visible reason.',
      },
      {
        title: 'Custom GLSL',
        body: 'The distinctive moments are hand-written shaders. A library helper gets you the effect everyone else has; a shader gets you the one nobody else has.',
      },
    ],
    outro: 'Everything on this site is procedural. There is no model file to download.',
  },
  {
    slug: 'notes',
    label: 'Notes',
    headlineLines: ['Things worth', 'knowing.'],
    standfirst: 'Facts about the browser that change how you build for it.',
    structure: 'helix',
    shot: 'helix',
    structureLabel: 'HELIX · SWEPT',
    entries: [
      {
        title: 'You get 16.7 milliseconds',
        body: 'At 60fps that is the entire budget for a frame — your JavaScript, style, layout, paint and composite. Miss it and the browser drops the frame. There is no partial credit.',
      },
      {
        title: 'Layout is the expensive part',
        body: 'Animating width, top or margin forces the browser to recalculate geometry every frame. Transform and opacity do not: they are handled by the compositor, which is why almost everything here is one or the other.',
      },
      {
        title: 'Reduced motion is a real setting',
        body: 'prefers-reduced-motion has shipped in every major browser since 2019. People with vestibular disorders use it. Respecting it costs one media query and is not optional.',
      },
      {
        title: 'Dark backgrounds band',
        body: 'Eight-bit colour has 256 steps per channel. A gradient across a near-black page crosses very few of them, so it bands visibly. A little film grain hides it — which is why the grain on this site is doing engineering work, not just styling.',
      },
    ],
    outro: 'None of this is exotic. It is just the part that gets skipped.',
  },
];

export const pageBySlug = (slug: string) => PAGES.find((p) => p.slug === slug);
