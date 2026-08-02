import type { MetadataRoute } from 'next';
import { PAGES } from '@/data/pages';
import { site } from '@/data/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: site.url, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    {
      url: `${site.url}/credentials`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    ...PAGES.map((p) => ({
      url: `${site.url}/${p.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
