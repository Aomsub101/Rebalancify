import type { NextConfig } from 'next'

const baseConfig: NextConfig = {}

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
