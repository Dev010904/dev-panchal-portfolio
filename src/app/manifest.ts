import type { MetadataRoute } from 'next';
import { site } from '@/data/site';

/**
 * THE WEB APP MANIFEST.
 *
 * The document has been linking `/site.webmanifest` since the metadata was
 * first written, and that file has never existed. Every page load fetched it,
 * got a 404, and logged two console errors — which is what was failing the
 * Best Practices audit, and is the kind of thing that stays invisible forever
 * because nothing on the page looks wrong when it happens.
 *
 * Generated rather than dropped in `public/` as static JSON, for the same
 * reason the sitemap and the page metadata are: the name, the description and
 * the theme colour already exist in `data/site.ts`, and a second copy in a hand
 * written file is a second copy that goes stale.
 *
 * Icons point at the same brand assets the favicon set uses. `purpose:
 * maskable` is deliberately NOT claimed — these icons have no safe-zone
 * padding, so an Android launcher would crop into the mark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.title,
    short_name: site.name,
    description: site.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Matches the renderer's clear colour and the themeColor in viewport, so
    // there is no pale flash between the splash screen and the first frame.
    background_color: '#08080A',
    theme_color: '#08080A',
    icons: [
      { src: '/brand/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/favicon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
