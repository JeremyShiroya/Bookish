const SDK_NAME = '@vercel/analytics/nuxt'
const SDK_VERSION = '2.0.1'

const getClientConfig = () => {
  try {
    return JSON.parse(import.meta.env.VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG || '{}').analytics || {}
  } catch {
    return {}
  }
}

const getBasePath = () => {
  try {
    return import.meta.env.VITE_VERCEL_OBSERVABILITY_BASEPATH || ''
  } catch {
    return ''
  }
}

const absolutePath = (value) => (
  !value || value.startsWith('/') || /^https?:\/\//.test(value)
    ? value
    : `/${value}`
)

const computeRoute = (path, params = {}) => {
  let route = path
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value]
    const encoded = values.map(item => encodeURIComponent(String(item))).join('/')
    if (encoded) route = route.replace(`/${encoded}`, `/[${Array.isArray(value) ? '...' : ''}${key}]`)
  }
  return route
}

const queueAnalytics = (...args) => {
  window.vaq ||= []
  window.va ||= (...params) => window.vaq.push(params)
  window.va(...args)
}

const injectAnalytics = () => {
  const config = getClientConfig()
  const basePath = getBasePath()
  const scriptSrc = absolutePath(
    config.scriptSrc
      || (basePath ? `${basePath}/insights/script.js` : '/_vercel/insights/script.js')
  )

  if (document.head.querySelector(`script[src="${scriptSrc}"]`)) return

  const script = document.createElement('script')
  script.src = scriptSrc
  script.defer = true
  script.dataset.sdkn = SDK_NAME
  script.dataset.sdkv = SDK_VERSION
  script.dataset.disableAutoTrack = '1'

  if (config.viewEndpoint) script.dataset.viewEndpoint = absolutePath(config.viewEndpoint)
  if (config.eventEndpoint) script.dataset.eventEndpoint = absolutePath(config.eventEndpoint)
  if (config.sessionEndpoint) script.dataset.sessionEndpoint = absolutePath(config.sessionEndpoint)
  if (config.dsn) script.dataset.dsn = config.dsn
  if (basePath) script.dataset.endpoint = absolutePath(`${basePath}/insights`)

  script.onerror = () => {
    if (import.meta.dev) {
      console.info('[Vercel Web Analytics] The development tracking script is unavailable.')
    }
  }

  document.head.appendChild(script)
}

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  const trackPage = (route) => {
    queueAnalytics('pageview', {
      route: computeRoute(route.path, route.params),
      path: route.path,
    })
  }

  nuxtApp.hook('app:mounted', () => {
    injectAnalytics()
    trackPage(router.currentRoute.value)
  })

  router.afterEach(trackPage)
})
