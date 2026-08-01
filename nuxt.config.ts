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
      // viewport-fit=cover is what makes env(safe-area-inset-*) resolve to real
      // values, so the app can draw edge-to-edge under the transparent Android
      // status and navigation bars (see MainActivity) and its own background
      // reaches the very top and bottom of the screen instead of a boxed strip.
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
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
      // Baked into the bundle at build time so on-device metadata lookups use
      // our own Books quota instead of the shared anonymous project, which is
      // exhausted daily by everyone using it. Public by necessity: the native
      // app has no server to keep it behind. Restrict the key to the Books API
      // (and to the Android package) so a leak can only spend Books quota.
      googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY || process.env.NUXT_GOOGLE_BOOKS_API_KEY || '',
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || process.env.BOOKISH_API_BASE_URL || '',
      // AI series ordering (see server/utils/aiSeriesEnumerator.ts). Used only
      // to PROPOSE which books a series contains when the Goodreads series page
      // is unreachable; every proposed title is then verified against the real
      // metadata providers before anything is stored.
      //
      // LEAVE THESE EMPTY for any build that will be shared. The app can share
      // its own APK (Settings → Share Pages), and anything public is baked into
      // that file — so a key here is handed to every recipient, spending one
      // quota between all of them and leaking a credential to strangers.
      //
      // The way this scales is apiBaseUrl above: point it at a deployment, keep
      // the key server-side as GEMINI_API_KEY, and the server caches per SERIES
      // so the hundredth reader to ask about a series costs nothing. Recipients
      // then get the fallback with no configuration at all.
      //
      // Empty simply disables the on-device fallback: the Goodreads roster still
      // resolves most series, so the app remains fully usable without it.
      aiSeriesProvider: process.env.NUXT_PUBLIC_AI_SERIES_PROVIDER || '',
      aiSeriesApiKey: process.env.NUXT_PUBLIC_AI_SERIES_API_KEY || '',
      aiSeriesModel: process.env.NUXT_PUBLIC_AI_SERIES_MODEL || '',
      // Shared series-ordering service (a Supabase Edge Function). THIS is how
      // the fallback reaches every reader: the model key lives on the server, and
      // the answer is cached per series, so a series is paid for once and then
      // served to everyone forever.
      //
      // Both values are safe to ship. The endpoint is public by design, and the
      // key below is a *publishable* key whose only power is calling this
      // function — the cache table has RLS on with no policies, so it cannot be
      // read or written with it.
      aiSeriesEndpoint: process.env.NUXT_PUBLIC_AI_SERIES_ENDPOINT || '',
      aiSeriesEndpointKey: process.env.NUXT_PUBLIC_AI_SERIES_ENDPOINT_KEY || '',
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
