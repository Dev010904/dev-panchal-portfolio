/**
 * THE CONSTELLATION — what this is made of, as a structure rather than a list.
 *
 * A stack section is usually a wall of logos, which says nothing: everybody's
 * wall has React on it. What is actually informative is how the tools RELATE —
 * which ones are load-bearing, which ones only exist because another one is
 * there, and where a person's centre of gravity actually sits.
 *
 * So this file carries three things a logo wall does not:
 *
 *   `weight`  how central the tool is to the work, 0..1. It drives the node's
 *             size and how close it sits to its cluster's core, so the
 *             load-bearing things are literally at the centre of their group.
 *             This is a claim about MY use of it, not about the tool.
 *
 *   `links`   real dependencies and real working relationships. ScrollTrigger
 *             is linked to GSAP because it is a GSAP plugin; Three is linked to
 *             GLSL because that is where the shaders go. Nothing here is drawn
 *             to make the picture look busier — an edge means the two things
 *             genuinely touch in work that has shipped.
 *
 *   `note`    one line, printed in the DOM when the node is focused. If a tool
 *             cannot earn a sentence that says something non-obvious, it does
 *             not belong on the page.
 *
 * Every entry is evidenced by this repo's package.json or by a project in
 * data/projects.ts. Nothing aspirational goes in here — a stack section listing
 * things you have only read about is the fastest way to fail the interview it
 * was supposed to win.
 */

/** The four regions. Order fixes their placement around the ring. */
export const CLUSTERS = [
  {
    id: 'render',
    label: 'RENDER',
    /** What the group is for. Printed as the cluster's own caption. */
    blurb: 'Pixels on the screen, and owning what each one costs.',
  },
  {
    id: 'motion',
    label: 'MOTION',
    blurb: 'One clock. Everything that moves is scrubbed from the same timeline.',
  },
  {
    id: 'interface',
    label: 'INTERFACE',
    blurb: 'The part that has to stay correct, typed and readable at 3am.',
  },
  {
    id: 'ground',
    label: 'GROUND',
    blurb: 'Build, ship, measure — the half that decides whether any of it is real.',
  },
] as const;

export type ClusterId = (typeof CLUSTERS)[number]['id'];

export interface StackNode {
  id: string;
  label: string;
  cluster: ClusterId;
  /** 0..1 — how load-bearing this is in the work. Drives size and core distance. */
  weight: number;
  note: string;
  /** ids this genuinely touches. Undirected; declaring it at one end is enough. */
  links: string[];
}

export const STACK: StackNode[] = [
  // ── RENDER ──────────────────────────────────────────────────────────────
  {
    id: 'three',
    label: 'Three.js',
    cluster: 'render',
    weight: 1,
    note: 'The renderer everything here draws through. One persistent canvas, never remounted between routes.',
    links: ['r3f', 'glsl', 'webgl2', 'drei', 'post'],
  },
  {
    id: 'glsl',
    label: 'GLSL',
    cluster: 'render',
    weight: 0.95,
    note: 'Hand-written shaders. A library helper gets you the effect everyone has; a shader gets you the one nobody else has.',
    links: ['webgl2', 'post'],
  },
  {
    id: 'r3f',
    label: 'React Three Fiber',
    cluster: 'render',
    weight: 0.9,
    note: 'Three as a React tree, so scene objects get real lifetimes instead of imperative setup and manual disposal.',
    links: ['react', 'drei', 'post'],
  },
  {
    id: 'webgl2',
    label: 'WebGL2',
    cluster: 'render',
    weight: 0.85,
    note: 'The context. GLSL ES 3.00, derivatives in core, none of the extension-pragma guesswork ESSL1 needs.',
    links: [],
  },
  {
    id: 'post',
    label: 'Postprocessing',
    cluster: 'render',
    weight: 0.65,
    note: 'The grade — bloom, grain, vignette — chained into one pass rather than one render target each.',
    links: [],
  },
  {
    id: 'drei',
    label: 'drei',
    cluster: 'render',
    weight: 0.6,
    note: 'Only the helpers that earn their bytes. PerformanceMonitor and AdaptiveDpr do measurable work on this page.',
    links: [],
  },
  {
    id: 'webgpu',
    label: 'WebGPU / TSL',
    cluster: 'render',
    weight: 0.35,
    note: 'Ported, measured, and deliberately not shipped. Knowing when to stop is the part nobody puts on a stack page.',
    links: ['three', 'glsl'],
  },

  // ── MOTION ──────────────────────────────────────────────────────────────
  {
    id: 'gsap',
    label: 'GSAP',
    cluster: 'motion',
    weight: 1,
    note: 'One animation authority. Two libraries animating the same property is the usual cause of motion that stutters for no visible reason.',
    links: ['scrolltrigger', 'lenis', 'three'],
  },
  {
    id: 'scrolltrigger',
    label: 'ScrollTrigger',
    cluster: 'motion',
    weight: 0.9,
    note: 'Scroll as a timeline scrubber rather than a pile of listeners racing each other to the same element.',
    links: ['lenis'],
  },
  {
    id: 'lenis',
    label: 'Lenis',
    cluster: 'motion',
    weight: 0.7,
    note: 'Smooth scroll ScrollTrigger can still trust, because it reports a real position instead of faking one.',
    links: [],
  },
  {
    id: 'framer',
    label: 'Framer Motion',
    cluster: 'motion',
    weight: 0.4,
    note: 'DOM transitions where authoring a timeline would cost more than the transition is worth.',
    links: ['react'],
  },

  // ── INTERFACE ───────────────────────────────────────────────────────────
  {
    id: 'next',
    label: 'Next.js',
    cluster: 'interface',
    weight: 1,
    note: 'App Router. Every page generated at build time, with metadata and the sitemap derived from one data file.',
    links: ['react', 'ts', 'netlify'],
  },
  {
    id: 'ts',
    label: 'TypeScript',
    cluster: 'interface',
    weight: 0.95,
    note: 'Strict, always. It is the only setting where the compiler is actually working for you rather than agreeing with you.',
    links: ['react'],
  },
  {
    id: 'react',
    label: 'React 19',
    cluster: 'interface',
    weight: 0.95,
    note: 'Not a version to shrug at: R3F v9 and drei v10 move with it, so the entire 3D stack is downstream of that choice.',
    links: [],
  },
  {
    id: 'css',
    label: 'CSS & layout',
    cluster: 'interface',
    weight: 0.75,
    note: 'Grid, clamp and custom properties. Composition is solved in the layout rather than patched with breakpoints.',
    links: [],
  },
  {
    id: 'tailwind',
    label: 'Tailwind v4',
    cluster: 'interface',
    weight: 0.7,
    note: 'Tokens as CSS variables first, utilities on top. The type scale is defined once and never eyeballed again.',
    links: ['css'],
  },
  {
    id: 'zustand',
    label: 'Zustand',
    cluster: 'interface',
    weight: 0.6,
    note: 'One store the render loop reads without subscribing, so sixty frames a second does not mean sixty React renders.',
    links: ['react'],
  },
  {
    id: 'a11y',
    label: 'Accessibility',
    cluster: 'interface',
    weight: 0.6,
    note: 'Reduced motion, focus order, contrast, real labels. A 3D site has no excuse to be unusable without a mouse.',
    links: ['css'],
  },

  // ── GROUND ──────────────────────────────────────────────────────────────
  {
    id: 'git',
    label: 'Git',
    cluster: 'ground',
    weight: 0.7,
    note: 'Small commits with messages that say why. The history is the one piece of documentation that cannot go stale.',
    links: [],
  },
  {
    id: 'netlify',
    label: 'Netlify',
    cluster: 'ground',
    weight: 0.65,
    note: 'Build on push, headers in config, a preview per branch. Three production sites run on it.',
    links: ['git', 'csp'],
  },
  {
    id: 'node',
    label: 'Node / Express',
    cluster: 'ground',
    weight: 0.6,
    note: 'The API half of KAAM KARO — task generation, deadline classification, and auth sitting in front of both.',
    links: ['ts'],
  },
  {
    id: 'csp',
    label: 'CSP & headers',
    cluster: 'ground',
    weight: 0.55,
    note: 'Every outbound request pinned to a known origin. Learned by debugging it on a live client site, which is the only way it sticks.',
    links: [],
  },
  {
    id: 'lighthouse',
    label: 'Lighthouse',
    cluster: 'ground',
    weight: 0.55,
    note: 'Real devices, real numbers. A site that only performs on the machine it was built on is not finished.',
    links: ['a11y'],
  },
  {
    id: 'firebase',
    label: 'Firebase',
    cluster: 'ground',
    weight: 0.5,
    note: 'Auth and persistence for KAAM KARO, chosen because the hackathon clock was the binding constraint, not the architecture.',
    links: ['node'],
  },
  {
    id: 'vite',
    label: 'Vite',
    cluster: 'ground',
    weight: 0.5,
    note: 'Where Next is the wrong shape. Fast enough that the dev loop stops being something you notice.',
    links: ['ts'],
  },
  {
    id: 'cloudrun',
    label: 'Cloud Run',
    cluster: 'ground',
    weight: 0.45,
    note: 'Containerised deploy for the KAAM KARO backend. Scales to zero, which matters when nobody is using it at 4am.',
    links: ['node'],
  },
  {
    id: 'resend',
    label: 'Resend',
    cluster: 'ground',
    weight: 0.4,
    note: 'Transactional email over HTTP, after SMTP kept dying from a serverless function. The fix was the transport, not the code.',
    links: ['csp'],
  },
];

/**
 * The edge list, resolved and de-duplicated once at module load.
 *
 * Derived from the `links` above rather than declared as its own array, so an
 * edge can never outlive the node it points at: a renamed or deleted id simply
 * drops out here instead of indexing into a buffer that no longer has that
 * vertex. That failure would be a line drawn from a real node to whatever
 * happened to be at index n — visible, wrong, and very hard to attribute.
 */
export const EDGES: [number, number][] = (() => {
  const index = new Map(STACK.map((n, i) => [n.id, i]));
  const seen = new Set<string>();
  const out: [number, number][] = [];

  for (const node of STACK) {
    const a = index.get(node.id)!;
    for (const id of node.links) {
      const b = index.get(id);
      if (b === undefined || b === a) continue;
      // Undirected: key on the sorted pair, so declaring the same relationship
      // at both ends is harmless rather than a second line drawn over the first.
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([a, b]);
    }
  }
  return out;
})();

/** Position of a cluster in CLUSTERS, which is also its position on the ring. */
export const clusterIndex = (id: ClusterId): number => CLUSTERS.findIndex((c) => c.id === id);
