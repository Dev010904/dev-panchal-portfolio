import type { Metadata, Viewport } from 'next';
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';

import './globals.css';
import { Chrome } from '@/components/Chrome';
import { HoldToBlast } from '@/components/HoldToBlast';
import { Preloader } from '@/components/Preloader';
import { SmoothScroll } from '@/components/SmoothScroll';
import { TelemetryHud } from '@/components/TelemetryHud';
import { SceneRoot } from '@/scenes/SceneRoot';
import { email, site } from '@/data/site';

/**
 * next/font downloads and self-hosts these at build time, emits a preload link
 * and a size-adjusted fallback. Result: no request to a third-party font CDN,
 * no FOUT, and zero CLS from font swap.
 */
const display = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.title,
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name }],
  creator: site.name,
  keywords: [
    'web developer',
    'three.js',
    'webgl',
    'gsap',
    'creative developer',
    '3d websites',
    'react three fiber',
  ],
  openGraph: {
    type: 'website',
    title: site.title,
    description: site.description,
    url: site.url,
    siteName: site.name,
    images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: site.title }],
  },
  twitter: {
    card: 'summary_large_image',
    title: site.title,
    description: site.description,
    images: ['/brand/og.png'],
  },
  icons: {
    icon: [
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest',
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: '#08080A',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * JSON-LD. Deliberately minimal: name, job title, email, profiles, and the
 * city.
 *
 * The rule this follows is that the schema may state what the visible page
 * states and nothing more. The page now says Vadodara, Gujarat, so the schema
 * says Vadodara, Gujarat — locality, region and country and no further, because
 * a street address and a phone number are not on the page and putting them here
 * would publish data the site deliberately withholds. `telephone` in particular
 * stays out even though WhatsApp is linked: a wa.me URL is a contact channel, a
 * `telephone` property is a machine-readable number for anything that scrapes.
 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: site.name,
  jobTitle: 'Web Developer',
  description: site.description,
  email: `mailto:${email()}`,
  url: site.url,
  address: {
    '@type': 'PostalAddress',
    ...site.address,
  },
  sameAs: [site.github.href, site.linkedin.href, site.instagram.href],
  knowsAbout: ['Three.js', 'WebGL', 'GSAP', 'React', 'Next.js'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="bg-[var(--color-bg)] text-[var(--color-fg)] antialiased">
        <script
          type="application/ld+json"
          // Static, authored above — no user input reaches this.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <a href="#main" className="skip-link t-label">
          SKIP TO CONTENT
        </a>

        {/* One Canvas. Mounted here, never unmounted, behind everything. */}
        <SceneRoot />

        <SmoothScroll>
          <Preloader />
          <Chrome />
          <HoldToBlast />
          <TelemetryHud />
          <main id="main" className="relative z-10">
            {children}
          </main>
        </SmoothScroll>
      </body>
    </html>
  );
}
