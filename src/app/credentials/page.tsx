import type { Metadata } from 'next';

import { CredentialsShell } from '@/components/CredentialsShell';
import { credentials } from '@/data/credentials';
import { site } from '@/data/site';

/**
 * /credentials.
 *
 * A static route rather than another entry in `data/pages.ts`, because the
 * interior-page model there is built around title/body entries and this page's
 * body is a table. Next resolves a literal segment before the `[slug]` dynamic
 * one, so this wins the route without `dynamicParams` having to be relaxed.
 */
export const metadata: Metadata = {
  title: `Credentials — ${site.name}`,
  description: `${credentials.length} certificates and badges — IBM SkillsBuild, AICTE, IIT Mandi TIH Live, CognitiveClass.ai, Simplilearn and M. S. University of Baroda.`,
  alternates: { canonical: '/credentials' },
  openGraph: {
    title: `Credentials — ${site.name}`,
    description: 'Every certificate, with the certificate attached.',
    url: `${site.url}/credentials`,
  },
};

export default function CredentialsPage() {
  return <CredentialsShell />;
}
