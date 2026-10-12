/**
 * WHAT I BUILD — the capabilities sheet on the home page.
 *
 * Four things a client can hire for, each one already demonstrated somewhere on
 * this site rather than claimed in the abstract: the pages themselves, the
 * scene they sit on, the motion that moves them, and the frame budget all of
 * it was tuned to (docs/PERFORMANCE.md). Edit freely; the section renders
 * whatever is here, in order, and each entry's `figure` picks its drawing.
 */

export type FigureId = 'websites' | 'realtime' | 'motion' | 'performance';

export interface Capability {
  id: FigureId;
  title: string;
  body: string;
  /** Mono list under the copy. */
  tools: string[];
  /** The drawing's caption. */
  caption: string;
}

export const capabilities: Capability[] = [
  {
    id: 'websites',
    title: 'Websites',
    body: 'Marketing sites and product front-ends in Next.js and React. Quick to load, accessible, and built so they can be edited after launch without calling me.',
    tools: ['NEXT.JS', 'REACT', 'TYPESCRIPT', 'TAILWIND'],
    caption: 'LAYOUT · 12-COLUMN GRID',
  },
  {
    id: 'realtime',
    title: 'Real-time 3D',
    body: 'Interactive WebGL scenes with three.js and React Three Fiber — product viewers, hero pieces, things you can push around. Like the one this page is standing on.',
    tools: ['THREE.JS', 'R3F', 'GLSL', 'POSTPROCESSING'],
    caption: 'SCENE · ISOMETRIC',
  },
  {
    id: 'motion',
    title: 'Motion',
    body: 'Scroll-driven storytelling and interface motion with GSAP: timelines that run backwards as cleanly as they run forwards, and never fight the scroll.',
    tools: ['GSAP', 'SCROLLTRIGGER', 'LENIS'],
    caption: 'EASE · CUBIC BÉZIER',
  },
  {
    id: 'performance',
    title: 'Performance',
    body: 'Finding and fixing what makes a page slow, measured on the hardware visitors actually have — an integrated laptop GPU, not a fast desktop.',
    tools: ['CORE WEB VITALS', 'GPU PROFILING', 'BUNDLE BUDGETS'],
    caption: 'FRAME TIME · 16.7 MS BUDGET',
  },
];
