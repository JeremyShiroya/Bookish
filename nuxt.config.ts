import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
)

const resolveBuildNumber = () => {
  if (process.env.BOOKISH_BUILD_NUMBER) return process.env.BOOKISH_BUILD_NUMBER
  try {
    return execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return new Date().toISOString().replace(/\D/g, '').slice(0, 12)
  }
}

const isVitest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'
const pwaModules = isVitest ? [] : ['@vite-pwa/nuxt']

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: false,
  modules: [
    ...pwaModules,
    '@nuxt/test-utils/module'
  ],
  css: ['@/assets/css/main.css'],
  app: {
    head: {
      title: 'Pages',
      link: [
        { rel: 'icon', type: 'image/png', href: '/Images/Pages-Logo.png' },
        { rel: 'shortcut icon', type: 'image/png', href: '/Images/Pages-Logo.png' },
        { rel: 'apple-touch-icon', href: '/Images/Pages-Logo.png' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      appVersion: packageJson.version,
      buildNumber: resolveBuildNumber(),
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || process.env.BOOKISH_API_BASE_URL || '',
      // Where the native build looks for version.json (see
      // scripts/generate-version-manifest.mjs). Empty disables the update
      // check entirely, which is the right default for web and desktop.
      updateManifestUrl: process.env.BOOKISH_UPDATE_MANIFEST_URL || '',
    },
  },
  nitro: {
    routeRules: {
      '/api/**': { cors: true },
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Pages',
      short_name: 'Pages',
      description: 'A local-first mobile reading and listening library.',
      theme_color: '#8A2BE2',
      background_color: '#e8e8f2',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/Images/Pages-Logo.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/Images/Pages-Logo.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,woff2}'],
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'bookish-pages',
            networkTimeoutSeconds: 2,
            expiration: {
              maxEntries: 32,
              maxAgeSeconds: 60 * 60 * 24 * 7,
            },
          },
        },
        {
          urlPattern: ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'bookish-app-assets',
            expiration: {
              maxEntries: 80,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
        {
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'CacheFirst',
          options: {
            cacheName: 'bookish-images',
            expiration: {
              maxEntries: 120,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  },
})
