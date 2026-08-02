/**
 * CREDENTIALS.
 *
 * Every row here is a real, issued credential with a real file behind it in
 * /public/credentials. Nothing is rounded up, nothing is restated to sound
 * larger, and a row with no certificate says so by having no link rather than
 * by pointing somewhere vague.
 *
 * Newest first. The ledger renders them in array order.
 */

export interface Badge {
  /** Filename under /public/credentials/badges. */
  file: string;
  /** Alt text. The badge's own name, not a description of it. */
  name: string;
}

export interface Credential {
  /** Display date, e.g. 'Jul 2026'. Monospace column — keep the format. */
  date: string;
  title: string;
  issuer: string;
  /**
   * Path to the certificate. Optional on purpose: two of these were issued as
   * badges only. A row without a `url` renders as plain text — no hover
   * affordance, no cursor change, nothing that promises a click it cannot
   * honour.
   */
  url?: string;
  /** Badge graphics, for rows evidenced by badges rather than a certificate. */
  badges?: Badge[];
}

export const credentials: Credential[] = [
  {
    date: 'Jul 2026',
    title: 'AI Automation & Intelligent Solutions Internship',
    issuer: 'AICTE / IBM SkillsBuild',
    url: '/credentials/ibm-ai-automation-internship.pdf',
  },
  {
    date: 'Jul 2026',
    title: 'Intelligent Virtual Agents with IBM watsonx Assistant',
    issuer: 'IBM Training',
    url: '/credentials/ibm-watsonx-assistant.pdf',
  },
  {
    date: 'Jul 2026',
    title: 'Make Agentic AI Work for You',
    issuer: 'IBM SkillsBuild',
    badges: [
      { file: 'ai-agents.png', name: 'AI Agents' },
      { file: 'multiagent-systems.png', name: 'Multiagent Systems' },
      { file: 'rag-intro.png', name: 'Introduction to RAG' },
    ],
  },
  {
    date: 'Jul 2026',
    title: 'World Youth Skills Day 2026',
    issuer: 'IBM SkillsBuild / BharatCares',
    url: '/credentials/ibm-youth-skills-day.pdf',
  },
  {
    date: 'Jul 2026',
    title: 'Improve Your Resume Writing with AI',
    issuer: 'IBM SkillsBuild',
    url: '/credentials/ibm-resume-writing-ai.pdf',
  },
  {
    date: 'Jun 2026',
    title: 'Getting Started with Generative AI',
    issuer: 'IBM SkillsBuild',
    badges: [
      { file: 'genai-foundations.png', name: 'Generative AI Foundations' },
      { file: 'llm-intro.png', name: 'Introduction to Large Language Models' },
      { file: 'genai-ethics.png', name: 'Generative AI Ethics' },
    ],
  },
  {
    date: 'Jun 2026',
    title: 'Text Analytics 101',
    issuer: 'CognitiveClass.ai / IBM',
    url: '/credentials/text-analytics-101.pdf',
  },
  {
    date: 'May 2026',
    title: 'Data Visualization with Power BI',
    issuer: 'IIT Mandi TIH Live × Coding Ninjas/NSDC',
    url: '/credentials/iit-mandi-power-bi.pdf',
  },
  {
    date: 'Apr 2026',
    title: 'Introduction to Analytics & Excel',
    issuer: 'IIT Mandi TIH Live × Coding Ninjas/NSDC',
    url: '/credentials/iit-mandi-analytics-excel.pdf',
  },
  {
    date: 'Apr 2026',
    title: 'Introduction to Agentic AI & LLM Architectures',
    issuer: 'Simplilearn',
    url: '/credentials/simplilearn-agentic-ai.pdf',
  },
  {
    date: 'Jan 2026',
    title: 'Data Analysis Workshop — “Ignite the Future”',
    issuer: 'M. S. University of Baroda',
    url: '/credentials/msu-data-analysis-workshop.pdf',
  },
];

/**
 * THE ACHIEVEMENT — the home page's one number.
 *
 * A rank, and the three facts that make the rank mean something. Kept as data
 * rather than as markup because it is stated in two places (the home page
 * moment and the credentials page), and two copies of a claim is how one of
 * them ends up wrong.
 */
export const achievement = {
  /** The number the counter runs to. */
  rank: 8,
  lines: [
    'TOP 15 · CODING NINJAS LEARNERS',
    "VIBE2SHIP · INDIA'S LARGEST VIBE-CODING HACKATHON",
    'CODING NINJAS × GOOGLE FOR DEVELOPERS · 2026',
  ],
  certificate: '/credentials/vibe2ship-certificate.pdf',
  /** The quieter second line, beneath the number. */
  footnote:
    'Certificate of Excellence (Top Performer), both IIT Mandi TIH Live modules — Analytics & Excel, and Power BI.',
} as const;
