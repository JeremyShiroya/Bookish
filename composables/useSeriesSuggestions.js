// Metadata for the installments of a series the library does not own yet, so
// the series detail page can show the real cover, title, author, and year of
// "the book you're missing" rather than a bare number.
//
// WHY NOT the per-book metadata engine: querying the metadata providers for a
// series name returns only the book you searched for (and box sets), never its
// siblings — the providers index books by their real titles, and we don't know
// the missing books' titles yet. The ONE source that enumerates an entire
// series in order — with cover, title, author, and year for every installment
// — is the Goodreads SERIES page. So resolution follows a book the user owns to
// its series page and reads the whole roster from there (server/util
// fetchGoodreadsSeriesBooks, on-device via CapacitorHttp).
//
// A background sweep (started from the device-sync plugin on native) walks the
// library every few minutes and fills in any series detail page that still has
// blank suggestion slots — the user never has to open the page or add a book.
// Results persist in localStorage AND in a shared reactive store, so an open
// series page updates live as the sweep resolves its gaps.

import { computed } from 'vue'
import { useState } from '#app'
import { useApiEndpoint } from '~/composables/useApiEndpoint'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

const loadDeviceSearch = () => import('~/composables/useDeviceMetadataSearch')

const CACHE_PREFIX = 'bookish:series-suggestions:'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
// Failed lookups get a short TTL: cache them so an offline session doesn't
// hammer the network, but retry soon — a blank slot must not stick for a month.
const EMPTY_CACHE_TTL_MS = 1000 * 60 * 15

// Background sweep pacing: one gapped series per cycle, a few minutes apart.
export const SERIES_SWEEP_INTERVAL_MS = 1000 * 60 * 4

export const normalizeSeriesKey = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

const cacheKey = (seriesName) => `${CACHE_PREFIX}${normalizeSeriesKey(seriesName)}`

const seriesMatches = (a, b) => {
  const keyA = normalizeSeriesKey(a)
  const keyB = normalizeSeriesKey(b)
  if (!keyA || !keyB) return false
  return keyA === keyB || keyA.includes(keyB) || keyB.includes(keyA)
}

// Shared reactive store: { [seriesKey]: { [installment]: { title, author, cover, year } } }.
// The detail page renders from this, so background resolutions appear live.
const useSuggestionsStore = () => useState('series-suggestions-store', () => ({}))

const readCache = (seriesName, neededInstallments = []) => {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(cacheKey(seriesName))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const installments = parsed.installments || null

    // A cached result only earns the long TTL if it actually answers the
    // question being asked — it must resolve at least one of the installments
    // the library is currently missing. Anything less retries on the short
    // TTL, so blank slots only ever mean "the last fetch failed recently".
    const needed = (neededInstallments || []).map(Number).filter(Number.isFinite)
    const useful = installments
      && Object.keys(installments).length
      && (!needed.length || needed.some((installment) => installments[installment]))

    const ttl = useful ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS
    if (Date.now() - (parsed.savedAt || 0) > ttl) return null
    return installments
  } catch {
    return null
  }
}

const writeCache = (seriesName, installments) => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(cacheKey(seriesName), JSON.stringify({ savedAt: Date.now(), installments }))
  } catch {
    // Quota/private-mode — the suggestions just re-fetch next time.
  }
}

// Fetch the Goodreads series roster, seeded by a book the user owns. On the web
// this hits the Nuxt endpoint; on native (no bundled server) the same scraper
// runs in the WebView via CapacitorHttp.
const fetchRoster = async (seedTitle, author, seriesName) => {
  const { apiUrl, apiBaseUrl } = useApiEndpoint()
  const native = isNativeCapacitorPlatform()

  if (native && !apiBaseUrl) {
    const { fetchSeriesBooksOnDevice } = await loadDeviceSearch()
    return fetchSeriesBooksOnDevice(seedTitle, author, seriesName)
  }

  try {
    const query = new URLSearchParams({ title: seedTitle })
    if (author) query.set('author', author)
    if (seriesName) query.set('series', seriesName)
    const response = await fetch(apiUrl(`/api/books/series-books?${query.toString()}`))
    if (!response.ok) throw new Error(`Series lookup failed with ${response.status}`)
    return await response.json()
  } catch (error) {
    if (native) {
      const { fetchSeriesBooksOnDevice } = await loadDeviceSearch()
      return fetchSeriesBooksOnDevice(seedTitle, author, seriesName)
    }
    throw error
  }
}

// Roster payload → the { [installment]: { title, author, cover, year } } map
// the detail page indexes into. Rejects a roster whose series name is clearly a
// different series (a seed like "The Girl…" matches many unrelated books).
const indexRoster = (payload, seriesName) => {
  const installments = {}
  const books = Array.isArray(payload?.books) ? payload.books : []

  const rosterSeries = normalizeSeriesKey(payload?.series)
  const target = normalizeSeriesKey(seriesName)
  if (rosterSeries && target && !seriesMatches(rosterSeries, target)) return installments

  for (const book of books) {
    const installment = Number(book?.installment)
    if (!Number.isSafeInteger(installment) || installment < 1) continue
    if (installments[installment] || !book?.title) continue
    installments[installment] = {
      title: book.title || null,
      author: book.author || null,
      cover: book.cover || null,
      year: Number(book.year) || null,
    }
  }
  return installments
}

// Fetch (and cache) the resolvable installments for a series, seeded by the
// books the user owns. `neededInstallments` — the numbers the library is
// missing — decides whether a cached result is still useful.
export const fetchSeriesInstallments = async (seriesName, seedBooks = [], neededInstallments = []) => {
  if (!seriesName) return {}
  const store = useSuggestionsStore()
  const key = normalizeSeriesKey(seriesName)

  const cached = readCache(seriesName, neededInstallments)
  if (cached) {
    store.value = { ...store.value, [key]: cached }
    return cached
  }

  // Seed from up to two owned books: if the first can't be followed to a series
  // page, the second might.
  const seeds = seedBooks.filter((book) => book?.title).slice(0, 2)
  let installments = {}
  for (const seed of seeds) {
    try {
      const roster = await fetchRoster(seed.title, seed.author || undefined, seriesName)
      installments = indexRoster(roster, seriesName)
      if (Object.keys(installments).length) break
    } catch {
      // Try the next owned book before giving up.
    }
  }

  writeCache(seriesName, installments)
  store.value = { ...store.value, [key]: installments }
  return installments
}

// Live view of one series' resolved suggestions, for the detail page.
export const useSeriesSuggestions = (seriesNameRef) => {
  const store = useSuggestionsStore()
  const installments = computed(() => store.value[normalizeSeriesKey(seriesNameRef?.value)] || {})
  return { installments, fetchSeriesInstallments }
}

// ── Background sweep ────────────────────────────────────────────────────────

let _sweepTimer = null
let _sweepInFlight = false

// One cycle: find the first series whose missing installments are not covered
// by a fresh cache, and resolve it. Bounded to one series per cycle so the
// sweep never competes with the user's own metadata fetches for long.
export const runSeriesSuggestionSweep = async ({ seriesList, settings }) => {
  if (_sweepInFlight) return 'busy'
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  if (settings?.value?.seriesSuggestions !== true) return 'disabled'

  _sweepInFlight = true
  try {
    for (const series of seriesList?.value || []) {
      const books = series?.books || []
      const totals = books.map((book) => Number(book.seriesTotal)).filter((total) => Number.isSafeInteger(total) && total > 0)
      const total = totals.length ? Math.max(...totals) : 0
      if (!total) continue

      const owned = new Set(
        books.map((book) => Number(book.seriesInstallment)).filter((n) => Number.isSafeInteger(n) && n >= 1),
      )
      const missing = []
      for (let n = 1; n <= total; n += 1) {
        if (!owned.has(n)) missing.push(n)
      }
      if (!missing.length) continue

      // Fresh, useful cache → nothing to do for this series.
      if (readCache(series.name, missing)) continue

      await fetchSeriesInstallments(series.name, books, missing)
      return `resolved:${series.name}`
    }
    return 'idle'
  } finally {
    _sweepInFlight = false
  }
}

// Start the repeating sweep. Idempotent — safe to call from a plugin on every
// app start.
export const startSeriesSuggestionSweep = ({ seriesList }) => {
  if (_sweepTimer !== null || typeof setInterval !== 'function') return
  const { settings } = useBookishSettings()

  const tick = () => {
    // Skip cycles while the app is backgrounded; Android throttles the timers
    // anyway and the work would just burn battery.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    runSeriesSuggestionSweep({ seriesList, settings }).catch(() => {})
  }

  _sweepTimer = setInterval(tick, SERIES_SWEEP_INTERVAL_MS)
  // First pass shortly after start, once the library has loaded.
  setTimeout(tick, 20000)
}

export const stopSeriesSuggestionSweep = () => {
  if (_sweepTimer !== null) {
    clearInterval(_sweepTimer)
    _sweepTimer = null
  }
}
