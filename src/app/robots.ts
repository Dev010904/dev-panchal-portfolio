import type { MetadataRoute } from 'next';
import { site } from '@/data/site';

/**
 * robots.txt.
 *
 * `host` used to be declared here and has been removed. It is not part of the
 * robots exclusion standard — it is a Yandex extension — and Google ignores it
 * outright, so it bought nothing. What it cost was real: Lighthouse validates
 * this file against the known directive set and failed the whole audit on that
 * one unrecognised line, which is what took SEO from 100 to 92.
 *
 * The canonical URL is already declared in the document metadata, which is
 * where a crawler that matters actually reads it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
