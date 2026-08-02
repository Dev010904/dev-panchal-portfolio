import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageShell } from '@/components/PageShell';
import { PAGES, pageBySlug } from '@/data/pages';
import { site } from '@/data/site';

/**
 * The interior pages are statically generated from data/pages.ts. Adding one
 * is a single object in that array — the route, the metadata, the sitemap
 * entry and the menu link all follow from it.
 */
export function generateStaticParams() {
  return PAGES.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = pageBySlug(slug);
  if (!page) return {};

  return {
    title: `${page.label} — ${site.name}`,
    description: `${page.headlineLines.join(' ')} ${page.standfirst}`,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: `${page.label} — ${site.name}`,
      description: page.standfirst,
      url: `${site.url}/${page.slug}`,
    },
  };
}

export default async function InteriorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = pageBySlug(slug);
  if (!page) notFound();

  return <PageShell page={page} />;
}
