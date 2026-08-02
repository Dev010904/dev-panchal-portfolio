import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],

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
