import type { NextConfig } from 'next'

const baseConfig: NextConfig = {
  // Python optimization and backfill routes are now handled by
  // Next.js proxy routes in app/api/optimize/route.ts and
  // app/api/backfill_debut/route.ts which forward to the Railway
  // FastAPI service. No rewrites needed here.

  // Externalize @napi-rs/canvas and pdf-parse — contains native binaries that webpack
  // cannot bundle (pdf-parse browser build uses DOMMatrix which requires @napi-rs/canvas)
  serverExternalPackages: ['@napi-rs/canvas', 'pdf-parse'],

  webpack: (config) => {
    // Treat @napi-rs/canvas as an external module — it contains native .node binaries
    // that webpack cannot parse. This applies to both client and server bundles.
    config.externals = config.externals || []
    if (Array.isArray(config.externals)) {
      config.externals.push('@napi-rs/canvas')
    }
    return config
  },
};

// next-pwa is a CommonJS module; use require for CJS interop in TS config
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  // Disable service worker in development to avoid stale-cache confusion
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    // NetworkFirst for portfolio API routes (AC-4: cache GET /api/silos, /api/silos/:id/holdings, /api/news/portfolio)
    {
      urlPattern: /^\/api\/silos/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-silos',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // 24 hours
        },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: /^\/api\/news\/portfolio/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-news',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24,
        },
        networkTimeoutSeconds: 10,
      },
    },
    // CacheFirst for static assets (images, fonts, icons)
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|ico|webp|woff|woff2)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    // StaleWhileRevalidate for Next.js static chunks
    {
      urlPattern: /^\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
})

export default withPWA(baseConfig)
