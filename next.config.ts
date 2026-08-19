import type { NextConfig } from 'next';

/**
 * SECURITY HEADERS.
 *
 * These live here and NOT in netlify.toml, and that distinction is the whole
 * point. Netlify applies `[[headers]]` to responses it serves from the CDN as
 * static files. Every HTML document on this site is produced by the Next server
 * handler instead, and that response never passes through the toml rules — so
 * the first version of this shipped a CSP that was present on every .js chunk
 * and absent on every page, which is exactly backwards. A CSP on a script file
 * constrains nothing; the document is the only place it does any work.
 *
 * Verified on the deployed site, not assumed: fetch the document and read the
 * headers back.
 */
const SECURITY_HEADERS = [
  {
    // connect-src is the one that earns its keep: it pins every outbound
    // request to this origin and the single Supabase project, so a compromised
    // dependency trying to exfiltrate somewhere else is refused by the browser.
    //
    // 'unsafe-inline' in script-src is a recorded trade-off, not an oversight.
    // Next's App Router inlines its own bootstrap and flight payload, and
    // removing it needs nonce plumbing through middleware. The injection
    // surface it would protect is not reachable here: nothing on this site
    // renders user-authored HTML. style-src needs it because GSAP writes inline
    // styles every frame, which is the entire animation layer.
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://gjeqokcbrhnkmrsmgxge.supabase.co",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "media-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
  // frame-ancestors above is the modern control; this is the legacy header for
  // browsers that predate it. Both say the same thing.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop the browser second-guessing a declared Content-Type.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Full URL to this origin only; cross-origin gets the bare origin, which
  // keeps interior route paths out of third-party referrer logs.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here uses a sensor, a camera or a payment API. Denying them
  // outright means a future dependency cannot quietly start asking.
  {
    key: 'Permissions-Policy',
    value:
      'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), xr-spatial-tracking=()',
  },
  // Two years, subdomains included. Netlify terminates TLS for this domain, so
  // there is no plaintext path worth preserving.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],

  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },

  // GLSL is authored as real .glsl files in /src/shaders and imported as strings.
  // webpack path uses the built-in asset/source (no loader dependency).
  webpack(config) {
    config.module.rules.push({
      test: /\.(glsl|vert|frag)$/,
      type: 'asset/source',
    });
    return config;
  },

  // Turbopack path (next dev --turbopack) uses raw-loader for the same files.
  turbopack: {
    rules: {
      '*.glsl': { loaders: ['raw-loader'], as: '*.js' },
      '*.vert': { loaders: ['raw-loader'], as: '*.js' },
      '*.frag': { loaders: ['raw-loader'], as: '*.js' },
    },
  },

  images: {
    formats: ['image/webp'],
  },
};

export default nextConfig;
