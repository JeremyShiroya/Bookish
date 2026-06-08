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

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: false,
  modules: [
    '@nuxt/test-utils/module'
  ],
  css: ['@/assets/css/main.css'],
  app: {
    head: {
      title: 'Bookish',
      link: [
        { rel: 'icon', type: 'image/png', href: '/Images/Logo.png' },
        { rel: 'shortcut icon', type: 'image/png', href: '/Images/Logo.png' },
        { rel: 'apple-touch-icon', href: '/Images/Logo.png' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      appVersion: packageJson.version,
      buildNumber: resolveBuildNumber(),
    },
  },
})
