/**
 * EXPERIENCE — set on the capabilities sheet as a schedule of work.
 *
 * A drawing sheet lists what was made in a table beside the title block; this
 * is that table for a job. Every row is something that shipped and is in use,
 * described by what it does rather than by how hard it was. Newest role first.
 */

export interface ScheduleItem {
  /** What was built, in one line. */
  work: string;
  /** Mono spec column: what it was built with, or what it rests on. */
  spec: string;
}

export interface Role {
  role: string;
  company: string;
  place: string;
  /** Display range, e.g. 'AUG — OCT 2026'. Monospace — keep the format. */
  period: string;
  /** Printed on the stamp. */
  status: string;
  summary: string;
  items: ScheduleItem[];
}

export const experience: Role[] = [
  {
    role: 'Web Development Intern',
    company: 'ANK Design & Automation Solutions LLP',
    place: 'Vadodara',
    period: 'AUG — OCT 2026',
    status: 'COMPLETED · 3 MONTHS',
    summary:
      "Three months building the company's websites and the internal software it now runs on, from the database up.",
    items: [
      {
        work: "ANK Track: the company's inquiry-to-order system, live in production and installed by staff on phone and desktop",
        spec: 'NEXT.JS · SUPABASE · POSTGRESQL',
      },
      {
        work: 'Quotations, tax invoices and delivery challans, with GST per line and PDFs generated on the server',
        spec: 'GAPLESS NUMBERING · HEADLESS CHROMIUM',
      },
      {
        work: 'Fingerprint attendance: device punches over HTTPS, a rules engine, a monthly Excel register',
        spec: 'BIOMETRIC DEVICES · EXCEL',
      },
      {
        work: 'Reports: inquiry conversion by cohort, order value by month, payment aging, loss reasons',
        spec: 'SQL · RECHARTS',
      },
      {
        work: 'A security review of the live system, with roles enforced inside the database',
        spec: 'ROW-LEVEL SECURITY · 35+ TABLES',
      },
      {
        work: 'Client websites: a real-time 3D product configurator, the agency rate card, a sample online store',
        spec: 'THREE.JS · GSAP',
      },
    ],
  },
];
