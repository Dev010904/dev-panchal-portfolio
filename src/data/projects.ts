/**
 * WORK — the one file to edit when there is new work to show.
 *
 * Adding a project is one object literal in the array below and a screenshot in
 * /public/work. Nothing else changes: the arc reads the array length and
 * derives its own angular spacing, so it handles one project or ten without a
 * layout switch.
 *
 * See /docs/HOW-TO-ADD-A-PROJECT.md.
 */

/**
 * One destination. The FIRST link in a project's array is the primary: it is
 * what a click on the card opens and what the arc raycast targets. The rest
 * render as an ArrowLink row beside the focused card.
 *
 * Modelled as a list rather than as `url` plus optional extras because a
 * project with a live app, a repository and a write-up has three peers, not one
 * link and two footnotes — and the card has to open the right one.
 */
export interface ProjectLink {
  label: string;
  href: string;
}

export interface Project {
  /** Stable id. Used for keys and anchors — do not reuse one. */
  id: string;
  title: string;
  /** One line. What it is, not what it means. */
  summary: string;
  /** Short discipline tags shown as monospace labels. */
  tags: string[];
  /**
   * Primary first. See ProjectLink. Empty for software that is private by
   * nature (a client's internal system behind a login): the card then opens
   * nothing and says why instead of linking to a sign-in page.
   */
  links: ProjectLink[];
  /** Path under /public. Must be a real captured screenshot, never a mockup. */
  image: string;
  imageWidth: number;
  imageHeight: number;
  status: 'live' | 'in-progress' | 'archived';

  // ── Optional. Set on a project when it is true of that project. ──
  /** Where it came from — a hackathon, a client, a brief. One line. */
  context?: string;
  /** e.g. 'Design & build' or 'Front-end' */
  role?: string;
  /** e.g. 2026 */
  year?: number;
  /** e.g. ['Next.js', 'Three.js'] — rendered as a spec list beside the card. */
  stack?: string[];
  /** Internal case-study route. Adds a second CTA when present. */
  caseStudyUrl?: string;
}

export const projects: Project[] = [
  {
    id: 'kaam-karo',
    title: 'KAAM KARO',
    summary:
      'AI-powered deadline survival app. Generates day-by-day task breakdowns and classifies every deadline in real time as Safe, At Risk, Critical or Overdue.',
    context: 'Solo build · Vibe2Ship Hackathon (Coding Ninjas × Google for Developers)',
    tags: ['WEB', 'AI', 'PRODUCT'],
    links: [
      { label: 'LIVE APP', href: 'https://kaam-karo-438754462552.us-west1.run.app' },
      { label: 'GITHUB', href: 'https://github.com/Dev010904/KAAM-KARO-Web-App' },
      {
        label: 'DOC',
        href: 'https://docs.google.com/document/d/1vwfp8hTZQeC5pEsjglndPLwIyxIXtnyS4SvliP-DicI/edit',
      },
    ],
    image: '/work/kaam-karo.webp',
    imageWidth: 1280,
    imageHeight: 800,
    status: 'live',
    role: 'Solo build',
    year: 2026,
    stack: [
      'React 19',
      'TypeScript',
      'Vite',
      'Tailwind',
      'Node/Express',
      'Firebase',
      'Cloud Run',
    ],
  },
  {
    id: 'apl-profitability',
    title: 'APL Logistics',
    summary:
      'Profitability analysis of 180,519 order lines: 18.7% of them lose $3.71M, and discounting is not the reason. Tested cleaning pipeline, research paper and a live dashboard.',
    context: 'Data analysis · supply-chain margin intelligence',
    tags: ['DATA', 'PYTHON', 'DASHBOARD'],
    links: [
      { label: 'LIVE DASHBOARD', href: 'https://apl-logistics-profitability.streamlit.app' },
      { label: 'GITHUB', href: 'https://github.com/Dev010904/apl-logistics-profitability-analysis' },
      {
        label: 'RESEARCH PAPER',
        href: 'https://github.com/Dev010904/apl-logistics-profitability-analysis/blob/main/reports/research_paper.pdf',
      },
    ],
    image: '/work/apl-profitability.webp',
    imageWidth: 1280,
    imageHeight: 800,
    status: 'live',
    role: 'Solo analysis',
    year: 2026,
    stack: ['Python', 'pandas', 'Plotly', 'Streamlit', 'pytest'],
  },
  {
    id: 'pe-daily-report',
    title: 'PE Daily Report',
    summary:
      "The stock and ledger software an industrial-gas distributor runs on every day: offline-first on an Android phone at the godown, the same app on the office PC, keyboard-only entry like Tally.",
    context: 'Client software · Panchal Enterprise',
    tags: ['SOFTWARE', 'FLUTTER', 'CLIENT'],
    // Private: the client's own records behind a login. The screenshot is the
    // real app running on made-up companies, not the business's data.
    links: [],
    image: '/work/pe-daily-report.webp',
    imageWidth: 1280,
    imageHeight: 800,
    status: 'live',
    role: 'Design & build',
    year: 2026,
    stack: ['Flutter', 'Dart', 'Supabase', 'SQLite', 'Cloudflare Workers'],
  },
  {
    id: 'panchal-gases',
    title: 'Panchal Gases',
    summary:
      'Cinematic dark-theme marketing site for an industrial gas business. Hand-rolled scroll engine, zero third-party animation libraries.',
    context: 'Commercial site · design + build',
    tags: ['WEB', 'DESIGN', 'BUILD'],
    links: [{ label: 'VISIT SITE', href: 'https://panchalgases7.netlify.app' }],
    image: '/work/panchal-gases.webp',
    imageWidth: 1280,
    imageHeight: 800,
    status: 'live',
    role: 'Design & build',
    stack: ['WebGL fragment shaders', 'IntersectionObserver', 'Cursor-reactive tilt'],
  },
  {
    id: 'panchal-enterprise',
    title: 'Panchal Enterprise',
    summary:
      'Second production site in the same family. Resolved live issues across CSP headers, cross-device routing and map links; migrated transactional email from SMTP to the Resend HTTP API.',
    context: 'Commercial site · design + build',
    tags: ['WEB', 'DESIGN', 'BUILD'],
    links: [{ label: 'VISIT SITE', href: 'https://panchalenterprise9.netlify.app' }],
    image: '/work/panchal-enterprise.webp',
    imageWidth: 1280,
    imageHeight: 800,
    status: 'live',
    role: 'Design & build',
    stack: ['CSP headers', 'Resend HTTP API'],
  },
  {
    id: 'portfolio',
    title: 'This site',
    summary:
      'Procedural 3D monogram, hand-written GLSL, one animation loop, persistent canvas. No model files.',
    context: 'Portfolio',
    tags: ['THREE.JS', 'WEBGL', 'GSAP'],
    links: [{ label: 'SOURCE', href: 'https://github.com/Dev010904/dev-panchal-portfolio' }],
    image: '/work/portfolio.webp',
    imageWidth: 1280,
    imageHeight: 800,
    status: 'live',
    role: 'Design & build',
    year: 2026,
    stack: ['Next.js', 'Three.js', 'GSAP', 'GLSL'],
  },
];

/** The link a click on the card opens, if the project has a public one. */
export const primaryLink = (p: Project): ProjectLink | undefined => p.links[0];
