/**
 * WHAT I BUILD — the capabilities sheet on the home page.
 *
 * Four things a client or an employer can hire for, each one evidenced by work
 * on this site rather than claimed in the abstract: the business software and
 * sites in the Work arc, the APL Logistics analysis, KAAM KARO's use of Gemini,
 * and the scene this page stands on. Edit freely; the section renders whatever
 * is here, in order, and each entry's `id` picks its drawing.
 */

export type FigureId = 'websites' | 'data' | 'ai' | 'realtime';

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
    title: 'Web apps',
    body: 'Websites, and the software a business runs on: inquiries to invoices, stock ledgers, attendance. Next.js and PostgreSQL, with the security enforced in the database rather than only on the screen.',
    tools: ['NEXT.JS', 'REACT', 'TYPESCRIPT', 'SUPABASE', 'POSTGRESQL'],
    caption: 'LAYOUT · 12-COLUMN GRID',
  },
  {
    id: 'data',
    title: 'Data analysis',
    body: 'Cleaning, testing and questioning a dataset until it gives a straight answer, then a dashboard someone can act on. The drawing is real: 172,765 order lines, and the 18.7% of them that lose money.',
    tools: ['PYTHON', 'PANDAS', 'SQL', 'POWER BI', 'STREAMLIT'],
    caption: 'DISTRIBUTION · MARGIN PER ORDER LINE',
  },
  {
    id: 'ai',
    title: 'AI in the product',
    body: 'Language models wired into things people use, with a plan for when the model is slow or wrong: output the app can check, a rescue path, and a local fallback that keeps it working.',
    tools: ['GEMINI API', 'LLMS', 'RAG', 'AI AGENTS'],
    caption: 'LOOP · PLAN → CHECK → ACT',
  },
  {
    id: 'realtime',
    title: 'Real-time 3D',
    body: 'Interactive WebGL scenes with three.js and React Three Fiber, moved by GSAP timelines that run backwards as cleanly as forwards. Like the one this page is standing on.',
    tools: ['THREE.JS', 'R3F', 'GLSL', 'GSAP'],
    caption: 'SCENE · ISOMETRIC',
  },
];
