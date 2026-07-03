import { useRuntimeConfig } from '#app'

// Native builds bundle static files, so relative /api/* calls hit the
// Capacitor shell instead of a Nuxt server. The backend base URL can be baked
// in at build time (NUXT_PUBLIC_API_BASE_URL) or set at runtime from Settings,
// which wins so the app can be repointed without rebuilding.
export const BOOKISH_API_BASE_URL_KEY = 'bookish:api-base-url'

const resolveStorage = () => {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

export function normalizeApiBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

export function resolveApiBaseUrl(configValue, storedValue) {
  return normalizeApiBaseUrl(storedValue) || normalizeApiBaseUrl(configValue)
}

export function readStoredApiBaseUrl(storage = resolveStorage()) {
  if (!storage) return ''
  try {
    return normalizeApiBaseUrl(storage.getItem(BOOKISH_API_BASE_URL_KEY))
  } catch {
    return ''
  }
}

export function writeStoredApiBaseUrl(value, storage = resolveStorage()) {
  const normalized = normalizeApiBaseUrl(value)
  if (!storage) return normalized
  try {
    if (normalized) storage.setItem(BOOKISH_API_BASE_URL_KEY, normalized)
    else storage.removeItem(BOOKISH_API_BASE_URL_KEY)
  } catch {
    // localStorage can fail in private browsing or quota-limited contexts.
  }
  return normalized
}

export function joinApiUrl(path, baseUrl = '') {
  const target = String(path || '')
  if (/^https?:\/\//i.test(target)) return target

  const normalizedBase = normalizeApiBaseUrl(baseUrl)
  if (!normalizedBase) return target || '/'

  const normalizedPath = target.startsWith('/') ? target : `/${target}`
  return `${normalizedBase}${normalizedPath}`
}

export function useApiEndpoint() {
  const config = useRuntimeConfig()
  const apiBaseUrl = resolveApiBaseUrl(config.public?.apiBaseUrl, readStoredApiBaseUrl())

  return {
    apiBaseUrl,
    apiUrl: (path) => joinApiUrl(path, apiBaseUrl),
  }
}
