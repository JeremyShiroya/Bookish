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
import { useState, useRuntimeConfig } from '#app'
import { useApiEndpoint } from '~/composables/useApiEndpoint'
import { useBookishSettings } from '~/composables/useBookishSettings'
import { fetchBookMetadataResults } from '~/composables/useBookMetadataSearch'
import { metadataResultMatchesBook } from '~/composables/useAutoMetadata'
import { mergeMetadataIntoBook } from '~/composables/useDeviceLibrarySync'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

const loadDeviceSearch = () => import('~/composables/useDeviceMetadataSearch')

// Public runtime config, captured while a Nuxt instance is definitely active.
//
// useRuntimeConfig() only resolves inside setup or before the first await —
// after that it throws "nuxt instance unavailable". The AI fallback runs from a
// click handler and from a background timer, both well past that point, so
// reading the config down there returned nothing and the whole feature quietly
// did nothing at all: no key found, no request made, no error logged. Grab it
// once from a context that is guaranteed valid and hand it down instead.
let _publicConfig = null

const rememberPublicConfig = () => {
  if (_publicConfig) return _publicConfig
  try {
    _publicConfig = useRuntimeConfig()?.public || null
  } catch {
    // Called outside a Nuxt context — a later call from one will fill this in.
  }
  return _publicConfig
}

// The AI provider settings a native build carries, or null when none are set.
const nativeAiConfig = () => {
  const config = rememberPublicConfig()
  const apiKey = config?.aiSeriesApiKey
  if (!apiKey) return null
  return {
    provider: String(config.aiSeriesProvider || '').toLowerCase() === 'groq' ? 'groq' : 'gemini',
    apiKey,
    model: config.aiSeriesModel || '',
  }
}

const CACHE_PREFIX = 'bookish:series-suggestions:'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
// Failed lookups get a short TTL: cache them so an offline session doesn't
// hammer the network, but retry soon — a blank slot must not stick for a month.
const EMPTY_CACHE_TTL_MS = 1000 * 60 * 15

// Background sweep pacing: one gapped series per cycle, a few minutes apart.
export const SERIES_SWEEP_INTERVAL_MS = 1000 * 60 * 4

// How far the stored "N works" total may sit above the highest installment the
// roster actually lists before we stop trusting it. One or two is the usual
// novella/box-set padding and gets trimmed; a bigger gap is treated as a roster
// page the fetch missed, so the claimed total is kept and no real book hides.
export const TRAILING_PHANTOM_MARGIN = 2

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
    // A cached roster only earns the long TTL when it answers the question in
    // FULL — every installment the library is missing. Settling for "resolved
    // at least one" is what left series stuck showing empty slots for 30 days:
    // a roster covering 1-28 of 30 looked like a success and was never retried.
    const needed = (neededInstallments || []).map(Number).filter(Number.isFinite)
    const complete = installments
      && Object.keys(installments).length
      && (!needed.length || needed.every((installment) => installments[installment]))

    const ttl = complete ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS
    if (Date.now() - (parsed.savedAt || 0) > ttl) return null
    return installments
  } catch {
    return null
  }
}

// The stored map regardless of whether it answers a particular gap — used by
// the detail top-up pass and by hydration, which both want whatever is on disk.
const readCacheRaw = (seriesName) => {
  if (typeof localStorage === 'undefined') return null
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey(seriesName)) || 'null')
    if (!parsed?.installments) return null
    if (Date.now() - (parsed.savedAt || 0) > CACHE_TTL_MS) return null
    return parsed.installments
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

// Ask the configured model which books the series contains. This is the
// fallback for the ONE question the metadata providers cannot answer — "what is
// book #31 called?" — used when the Goodreads series page (the only scrapeable
// source that enumerates a series) is rate-limiting us. Returns candidates only;
// resolveGapsWithAi verifies each one before anything is stored. Never throws:
// a failure here must leave the roster path exactly as it was.
const fetchAiSeriesOrder = async ({ seriesName, author, anchors = {}, missing = [] }) => {
  const empty = { books: [], provider: null, anchored: false }
  const { apiUrl, apiBaseUrl } = useApiEndpoint()
  const native = isNativeCapacitorPlatform()

  // Read BEFORE any await, while the Nuxt instance is still reachable.
  const aiConfig = nativeAiConfig()

  const onDevice = async () => {
    if (!aiConfig) {
      // Loud on purpose: an unset key is the single likeliest reason this
      // feature appears to do nothing on a phone, and it used to fail silently.
      console.warn('[AI series] No on-device AI key configured (NUXT_PUBLIC_AI_SERIES_API_KEY) — skipping the ordering fallback.')
      return empty
    }
    const { enumerateSeriesOnDevice } = await loadDeviceSearch()
    return enumerateSeriesOnDevice({ seriesName, author, anchors, missing, config: aiConfig })
  }

  try {
    if (native && !apiBaseUrl) return await onDevice()

    const query = new URLSearchParams({ series: seriesName })
    if (author) query.set('author', author)
    const anchorParam = Object.entries(anchors)
      .map(([installment, title]) => `${installment}:${String(title).replace(/[|]/g, ' ')}`)
      .join('|')
    if (anchorParam) query.set('anchors', anchorParam)
    if (missing.length) query.set('missing', missing.join(','))

    const response = await fetch(apiUrl(`/api/books/series-order?${query.toString()}`))
    if (!response.ok) throw new Error(`Series ordering failed with ${response.status}`)
    return await response.json()
  } catch {
    if (native) {
      try {
        return await onDevice()
      } catch {
        return empty
      }
    }
    return empty
  }
}

// The author every AI-proposed title is checked against. Owned books are the
// most trustworthy source; the roster's own entries are the fallback. Verifying
// against an author gives the check a second axis, which is what makes an
// unattended write safe — see resolveGapsWithAi.
export const dominantSeriesAuthor = (seedBooks = [], installments = {}) => {
  const counts = new Map()
  const add = (value) => {
    const name = String(value ?? '').trim()
    if (!name) return
    const key = name.toLowerCase()
    const entry = counts.get(key)
    if (entry) entry.count += 1
    else counts.set(key, { name, count: 1 })
  }

  for (const book of seedBooks || []) add(book?.author)
  for (const entry of Object.values(installments || {})) add(entry?.author)

  let best = null
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry
  }
  return best?.name || null
}

// THE step that makes an AI-proposed book safe to store — and the one that
// makes the whole idea work.
//
// Measured behaviour, not theory: asked for the Lucas Davenport installments a
// walled roster could not supply, a model recited every confirmed book perfectly
// and then answered "33: Ocean Prey", "31: Righteous Prey", "34: Hellfire" —
// two real books at the WRONG numbers and one that is not in this series at all.
// Its numbering is simply not reliable.
//
// But its TITLES are useful, and a title is the one thing the providers cannot
// guess. So the model's numbering is discarded outright: we search for the title
// it suggested and let the provider say where the book belongs — Goodreads
// search answers "Ocean Prey → Lucas Davenport #31" even while the series PAGE
// is rate-limited, which is the whole reason the gap existed. The model points
// at a book; the providers place it. Every stored fact, the number included,
// comes from a provider, so a misnumbered or invented suggestion cannot corrupt
// the series — it just finds nothing, or lands correctly somewhere else.
export const confirmPlacement = (results = [], { title, author, seriesName } = {}) => {
  for (const result of results || []) {
    if (!installmentMatchesBook({ title, author: author || '' }, result)) continue
    // The provider must place it in THIS series...
    if (!seriesMatches(result?.series, seriesName)) continue
    // ...at a whole number. A half-number (novella "#4.5") is not a slot.
    const stated = Number(result?.seriesInstallment)
    if (!Number.isSafeInteger(stated) || stated < 1) continue
    return { result, installment: stated }
  }

  return null
}

// SECOND route to a verified placement, for when the first cannot run.
//
// confirmPlacement needs a provider to state "this book is installment N", and
// Goodreads is the ONLY provider that reports an installment at all — Google
// Books and Open Library return none. So on a device Goodreads is rate-limiting
// (HTTP 202, measured on the reader's phone) nothing can ever confirm a
// position, and the AI fallback is blocked by the very wall it exists to route
// around.
//
// Publication years are the way out, because the reachable providers DO supply
// them. A series runs forward in time, so a proposed slot has to sit between the
// years of the books already confirmed either side of it. That is a real
// structural test, not a softening: it rejects every misplacement measured from
// a weaker model — "Storm Prey" (2010) offered as book 33 lands before book 30's
// 2020 and is thrown out — while accepting a correct 31=2021 between 30=2020 and
// 36=2025.
//
// The year checked is always the PROVIDER's, never the model's, so no fact the
// model asserted is ever what justifies the write.
export const yearFitsBetweenAnchors = ({ installment, year, anchors = {} } = {}) => {
  const slot = Number(installment)
  const value = Number(year)
  if (!Number.isSafeInteger(slot) || slot < 1) return false
  if (!Number.isFinite(value) || value < 1400 || value > 2200) return false

  const known = Object.entries(anchors || {})
    .map(([number, entry]) => [Number(number), Number(entry?.year)])
    .filter(([number, entryYear]) => (
      Number.isSafeInteger(number) && number >= 1
      && Number.isFinite(entryYear) && entryYear > 1400
      && number !== slot
    ))

  // One dated book is enough to place another relative to it, and it is often
  // all there is: a reader owning a single book of a series whose roster could
  // not be fetched. Each book resolved during a sweep becomes an anchor for the
  // next, so the constraint tightens as it goes rather than staying at one.
  if (!known.length) return false

  for (const [number, entryYear] of known) {
    // Earlier books cannot be published after this one, later ones cannot come
    // before it. Equality is allowed: two installments do ship in one year.
    if (number < slot && entryYear > value) return false
    if (number > slot && entryYear < value) return false
  }

  return true
}

// At least this many roster-confirmed books must exist before an AI ordering is
// used for writes. The model's contribution is POSITION — which title sits at
// which number — and anchors are the only way to check it got positions right.
// With too few, a plausible-but-shifted ordering would be undetectable.
// One is enough now that a book the reader OWNS counts: a model that cannot
// place their own book at the number their own library records is plainly not
// recalling this series, and every proposal is provider-verified afterwards
// regardless. Requiring two locked out every series where the reader owns a
// single book and Goodreads was unreachable — which is most of them.
const MIN_AI_ANCHORS = 1

// A 40-book roster would make an unwieldy URL and a needlessly expensive prompt,
// so the model gets an evenly-spread SAMPLE of the confirmed books. Spread
// rather than the first N, because early books alone would not catch a model
// that drifts in the later stretch — which is exactly where the gaps are.
export const sampleAnchors = (anchors = {}, max = 12) => {
  const entries = Object.entries(anchors)
    .map(([installment, title]) => [Number(installment), title])
    .filter(([installment, title]) => Number.isSafeInteger(installment) && installment >= 1 && !!title)
    .sort((a, b) => a[0] - b[0])
  if (entries.length <= max) return Object.fromEntries(entries)

  const step = (entries.length - 1) / (max - 1)
  const picked = new Map()
  for (let i = 0; i < max; i += 1) {
    const [installment, title] = entries[Math.round(i * step)]
    picked.set(installment, title)
  }
  return Object.fromEntries(picked)
}

// Turn AI candidates into stored installments — but only ones the real metadata
// providers confirm. For each proposed title we search the cross-checked
// pipeline (Google Books, Open Library, Kobo, Internet Archive, Goodreads) and
// require a title AND author match, then keep the PROVIDER'S cover, author and
// year. Nothing the model said about a book is stored; it only suggested where
// to look. A hallucinated title finds no match and is silently dropped.
export const resolveGapsWithAi = async ({
  seriesName,
  cached = {},
  missing = [],
  seedBooks = [],
  shouldStop,
  onCandidate,
} = {}) => {
  const gaps = (missing || []).filter((installment) => !cached[installment]?.title)
  if (!seriesName || !gaps.length) return {}

  // Anchors steer the model and catch it when it is reconstructing rather than
  // recalling. They come from BOTH the roster and the books the reader owns.
  //
  // Owning books used to be ignored here, and that was the bug that made this
  // whole fallback useless in exactly the case it exists for: when Goodreads
  // refuses outright the roster cache is EMPTY, so there were no anchors, so the
  // model was never asked, so the series stayed blank forever. Meanwhile the
  // reader's own shelf held the best anchor available — a title, an installment
  // and a year that came from a provider and that they can see is right.
  const anchors = {}
  const dateAnchors = {}
  for (const [installment, entry] of Object.entries(cached)) {
    if (entry?.title) anchors[installment] = entry.title
    if (entry?.year) dateAnchors[installment] = { year: entry.year }
  }
  for (const book of seedBooks || []) {
    const installment = Number(book?.seriesInstallment)
    if (!Number.isSafeInteger(installment) || installment < 1) continue
    // The reader's own record wins over the roster: it is what they see.
    if (book.title) anchors[installment] = book.title
    const year = Number(book.publishYear)
    if (Number.isFinite(year) && year > 1400) dateAnchors[installment] = { year }
  }
  if (Object.keys(anchors).length < MIN_AI_ANCHORS) return {}

  const author = dominantSeriesAuthor(seedBooks, cached)
  // Without a known author the verification has only the title to go on, which
  // is not enough to safely place someone else's book into this series.
  if (!author) return {}

  const { books, anchored } = await fetchAiSeriesOrder({
    seriesName,
    author,
    anchors: sampleAnchors(anchors),
    missing: gaps,
  })
  if (!anchored || !books?.length) return {}

  // Titles already placed somewhere in the series — a proposal that repeats one
  // is the model shuffling a book it knows into a slot it does not.
  const placed = new Set(
    Object.values(cached).map((entry) => normalizeSeriesKey(entry?.title)).filter(Boolean),
  )

  const wanted = new Set(gaps.map(Number))
  const resolved = {}

  for (const proposal of books) {
    if (shouldStop?.()) break
    // Stop as soon as every gap is closed — no point paying for more lookups.
    if (Object.keys(resolved).length >= wanted.size) break
    const proposedKey = normalizeSeriesKey(proposal.title)
    // Already sitting somewhere in this series: the model is recycling a book
    // it knows rather than naming the one we are missing.
    if (!proposedKey || placed.has(proposedKey)) continue

    try {
      const results = await fetchBookMetadataResults(proposal.title, author, undefined, { light: true })

      // FIRST choice: a provider states the number outright. Strongest evidence,
      // and it overrides whatever the model believed the number was.
      let match = null
      let installment = 0
      const stated = confirmPlacement(results, { title: proposal.title, author, seriesName })
      if (stated) {
        match = stated.result
        installment = stated.installment
      } else {
        // FALLBACK: no provider will state a position — the usual case when
        // Goodreads is rate-limiting this device, since nothing else reports an
        // installment. Confirm the book exists, then require the PROVIDER's
        // publication year to sit correctly among the books already dated. The
        // model's number is only a hypothesis the years have to support.
        const found = bestResultForInstallment({ title: proposal.title, author }, results)
        const providerYear = Number(found?.publishYear)
        const candidate = Number(proposal.installment)
        if (
          found
          && Number.isFinite(providerYear)
          && wanted.has(candidate)
          && yearFitsBetweenAnchors({ installment: candidate, year: providerYear, anchors: dateAnchors })
        ) {
          match = found
          installment = candidate
        }
      }

      if (!match || !installment) continue
      // The providers may place it at a number we already have, or outside the
      // gaps entirely. Either way it is not something we need.
      if (!wanted.has(installment) || resolved[installment] || cached[installment]?.title) continue

      resolved[installment] = {
        title: match.title || proposal.title,
        author: match.author || author,
        cover: match.cover || null,
        // The provider's year is authoritative; the model's is a last resort.
        year: Number(match.publishYear) || proposal.year || null,
      }
      placed.add(proposedKey)
      // Each confirmed book tightens the constraint on the ones still to come:
      // a series resolved from one owned book ends up fully bracketed by the
      // time it reaches the end, rather than judged against that single date.
      const resolvedYear = Number(match.publishYear) || Number(proposal.year)
      if (Number.isFinite(resolvedYear) && resolvedYear > 1400) {
        dateAnchors[installment] = { year: resolvedYear }
      }
      onCandidate?.({ installment, title: match.title || proposal.title })
    } catch {
      // Providers unreachable — leave this gap for a later sweep.
    }
  }

  return resolved
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

// Union of two installment maps: existing entries win on a field-by-field
// basis, so a later thinner roster tops up gaps without ever removing detail.
export function mergeInstallments(existing = {}, incoming = {}) {
  const merged = { ...existing }
  for (const [installment, entry] of Object.entries(incoming || {})) {
    if (!entry) continue
    const current = merged[installment]
    merged[installment] = current
      ? {
        title: current.title || entry.title || null,
        author: current.author || entry.author || null,
        cover: current.cover || entry.cover || null,
        year: current.year || entry.year || null,
      }
      : entry
  }
  return merged
}

// Give a different owned book the first go each time a series is retried, so a
// series that keeps resolving partially isn't asked the same failing question
// forever. Deterministic per attempt count, not random, so it is testable.
export function rotateSeeds(seeds, seriesName, attempt = attemptCountFor(seriesName)) {
  const list = (seeds || []).filter(Boolean)
  if (list.length < 2) return list.slice(0, 2)
  const offset = attempt % list.length
  return [...list.slice(offset), ...list.slice(0, offset)].slice(0, 3)
}

// How many times this series has been fetched, so seed rotation can advance.
const ATTEMPT_PREFIX = 'bookish:series-attempts:'

function attemptCountFor(seriesName) {
  if (typeof localStorage === 'undefined') return 0
  return Number(localStorage.getItem(ATTEMPT_PREFIX + normalizeSeriesKey(seriesName))) || 0
}

function bumpAttemptCount(seriesName) {
  if (typeof localStorage === 'undefined') return
  try {
    const key = ATTEMPT_PREFIX + normalizeSeriesKey(seriesName)
    localStorage.setItem(key, String((Number(localStorage.getItem(key)) || 0) + 1))
  } catch {}
}

// Fetch (and cache) the resolvable installments for a series, seeded by the
// books the user owns. `neededInstallments` — the numbers the library is
// missing — decides whether a cached result is still useful.
export const fetchSeriesInstallments = async (seriesName, seedBooks = [], neededInstallments = [], { forceRefresh = false } = {}) => {
  if (!seriesName) return {}
  const store = useSuggestionsStore()
  const key = normalizeSeriesKey(seriesName)

  // The explicit "Search for missing books" action bypasses the cache — the
  // roster on disk may be a stale partial page, and the whole point is to go
  // and fetch the rest.
  const cached = forceRefresh ? null : readCache(seriesName, neededInstallments)
  if (cached) {
    store.value = { ...store.value, [key]: cached }
    return cached
  }

  // Start from whatever is already on disk: a fetch that comes back thinner
  // than last time must never erase installments already resolved.
  let installments = { ...(readCacheRaw(seriesName) || {}) }

  // Every seed gets a turn, and the results are merged. Stopping at the first
  // seed that returned anything meant a thin roster won over a fuller one that
  // the next owned book would have found. Seeds are rotated per attempt so a
  // series that keeps coming back partial tries a different door each cycle.
  const seeds = rotateSeeds(seedBooks.filter((book) => book?.title), seriesName)
  const needed = (neededInstallments || []).map(Number).filter(Number.isFinite)

  for (const seed of seeds) {
    try {
      const roster = await fetchRoster(seed.title, seed.author || undefined, seriesName)
      installments = mergeInstallments(installments, indexRoster(roster, seriesName))
    } catch {
      // Try the next owned book before giving up.
    }
    // Stop early only when the gaps are actually closed.
    if (needed.length && needed.every((n) => installments[n])) break
  }

  bumpAttemptCount(seriesName)
  writeCache(seriesName, installments)
  store.value = { ...store.value, [key]: installments }
  return installments
}

// Load every cached series into the reactive store in one pass.
//
// The cache always lived on the device, but the store started empty on each
// app open, so a series page rendered blank slots and only filled them after
// its own fetch resolved — a visible wait for data already on disk. Hydrating
// up front means the page paints from the store on first render.
// Rosters shipped with the app (public/series-seed.json).
//
// Resolving a series costs a Goodreads scrape that is rate-limited per network,
// or an AI call drawn from one shared quota — and every reader who owns a given
// series pays that same cost to learn the same unchanging answer. Series that
// have already been resolved and verified are therefore bundled, so a common
// series is complete the moment the app opens: no network, no quota, no wait,
// and it works offline.
//
// It is a SEED, not an authority: anything already on the device wins, and a
// seeded series is a normal cache entry afterwards — the sweep can still top it
// up or correct it. Regenerate with scripts/build-series-seed.mjs.
let _seeded = false

export const seedSeriesSuggestions = async () => {
  if (_seeded || typeof localStorage === 'undefined' || typeof fetch !== 'function') return 0
  _seeded = true

  let payload = null
  try {
    const response = await fetch('/series-seed.json', { cache: 'force-cache' })
    if (!response.ok) return 0
    payload = await response.json()
  } catch {
    // No seed shipped, or unreadable — the normal resolution path still works.
    return 0
  }

  const entries = Object.entries(payload?.series || {})
  if (!entries.length) return 0

  const store = useSuggestionsStore()
  const next = { ...store.value }
  let added = 0

  for (const [key, series] of entries) {
    const installments = series?.installments
    if (!key || !installments || !Object.keys(installments).length) continue

    // Merge rather than replace: the device's own resolutions are newer and
    // came from this reader's own lookups, so they take precedence field by
    // field. A seed only ever fills blanks.
    let existing = null
    try {
      const raw = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || 'null')
      existing = raw?.installments || null
    } catch {
      existing = null
    }

    const merged = mergeInstallments(existing || {}, installments)
    if (existing && Object.keys(merged).length === Object.keys(existing).length) {
      // Nothing gained; leave the stored entry (and its savedAt) untouched.
      next[key] = merged
      continue
    }

    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt: Date.now(), installments: merged }))
    } catch {
      // Quota — the store still gets it for this session.
    }
    next[key] = merged
    added += 1
  }

  store.value = next
  return added
}

export const hydrateSeriesSuggestions = () => {
  if (typeof localStorage === 'undefined') return 0
  const store = useSuggestionsStore()
  const next = { ...store.value }
  let loaded = 0

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(CACHE_PREFIX)) continue
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null')
      if (!parsed?.installments) continue
      if (Date.now() - (parsed.savedAt || 0) > CACHE_TTL_MS) continue
      next[key.slice(CACHE_PREFIX.length)] = parsed.installments
      loaded += 1
    } catch {
      // Corrupt entry — skip it; the sweep will rebuild that series.
    }
  }

  store.value = next
  return loaded
}

// A suggestion is only finished when it can be shown properly: cover, author
// and year. The roster often returns just a title and a number.
export const installmentNeedsDetails = (entry) => (
  !entry?.title || !entry?.cover || !entry?.author || !entry?.year
)

const filledDisplayFields = (entry) => (
  ['title', 'cover', 'author', 'year'].filter((field) => Boolean(entry?.[field])).length
)

const installmentImproved = (before, after) => (
  filledDisplayFields(after) > filledDisplayFields(before)
)

const countIncompleteInstallments = (installments = {}, missing = []) => (
  (missing || []).filter((installment) => installmentNeedsDetails(installments[installment])).length
)

// Does an owned book look like this missing installment? Title must match (or
// one contain the other — sources vary on subtitles), and the author agree
// when both are known. Same shape as the metadata guard, so a wrong book never
// gets pulled into the series.
export const installmentMatchesBook = (entry, book) => {
  if (!entry?.title || !book?.title) return false
  return metadataResultMatchesBook(
    { title: entry.title, author: entry.author || '' },
    { title: book.title, author: book.author || '' },
  )
}

// Pick the metadata result that is REALLY this installment — the first one that
// matches, not blindly results[0]. Goodreads/Google routinely return a box set,
// an omnibus, or a different edition as the top hit; taking only [0] made the
// match guard reject it and leave the slot blank even when the right book sat
// at [1] or [2]. Scanning for the first true match is what finally fills them.
export const bestResultForInstallment = (entry, results = []) => (
  (results || []).find((result) => installmentMatchesBook(entry, result)) || null
)

// Same idea for an owned book: the first result that is genuinely this book.
export const bestResultForOwnedBook = (book, results = []) => (
  (results || []).find((result) => metadataResultMatchesBook(book, result)) || null
)

// What a resolved roster actually covers: its highest installment, and whether
// every installment from 1 to that high point is present. A contiguous roster
// is treated as the authoritative length of the series — the metadata "works"
// count Goodreads reports overcounts (novellas, box sets, announced numbers),
// which is what puts phantom "Book 29 / Book 30" cards past the real last book.
export const rosterCoverage = (installments = {}) => {
  const numbers = Object.keys(installments || {})
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n >= 1)
  if (!numbers.length) return { max: 0, contiguous: false }
  const max = Math.max(...numbers)
  const present = new Set(numbers)
  let contiguous = true
  for (let n = 1; n <= max; n += 1) {
    if (!present.has(n)) { contiguous = false; break }
  }
  return { max, contiguous }
}

// Decide the real number of installments from the roster and the stored "N
// works" total. A contiguous roster is authoritative outright. Otherwise the
// claimed total wins so a roster page the fetch missed can't hide real books —
// UNLESS the claim is only a novella or two above the highest book the roster
// actually names, in which case that excess is the works-count padding (box
// sets, novellas) and gets trimmed away. Pure so the rule is unit-testable.
export const reconcileEffectiveTotal = ({ contiguous = false, rosterMax = 0, claimedTotal = 0 } = {}) => {
  const claimed = Number(claimedTotal) || 0
  if (contiguous) return rosterMax
  if (rosterMax > 0 && claimed > rosterMax && claimed - rosterMax <= TRAILING_PHANTOM_MARGIN) return rosterMax
  return Math.max(rosterMax, claimed)
}

// PHASE 1 — the visible sweep. Re-fetch the roster in full (paginated), then for
// every missing installment fill any blank cover / title / author / year from
// the cross-checked metadata engine, reporting progress so the page can show a
// modal. Everything it fills is written to the device cache and the live store,
// so the cards update in place. Returns the roster's coverage so the caller can
// reconcile the series total.
export const fillMissingInstallmentDetails = async ({
  seriesName,
  seedBooks = [],
  ownedInstallments = [],
  claimedTotal = 0,
  onProgress,
  shouldStop,
} = {}) => {
  const empty = { coverage: { max: 0, contiguous: false }, effectiveTotal: 0, cached: {}, unresolved: 0 }
  if (!seriesName) return empty

  const beforeFetch = { ...(readCacheRaw(seriesName) || {}) }

  // Force a fresh, fully-paginated roster first — this is what pulls in the
  // installments a stale first-page-only cache was missing.
  await fetchSeriesInstallments(seriesName, seedBooks, [], { forceRefresh: true })

  const store = useSuggestionsStore()
  const key = normalizeSeriesKey(seriesName)
  const cached = { ...(readCacheRaw(seriesName) || {}) }

  // The roster is the authoritative length when it runs 1..max with no gaps;
  // then its max caps the phantom installments the metadata "works" count
  // invents. When it has gaps (a page that could not be fetched), keep the
  // larger of the two so a real book is never hidden — EXCEPT when the stored
  // total is only a book or two above the highest installment the roster
  // actually lists. That small excess is almost always the "N works" count
  // padding in box sets and novellas that have no numbered slot (e.g. Prey
  // reports 37 works but the last real book is #36), so trust the roster and
  // drop those trailing phantom cards. A larger gap is treated as a page the
  // fetch missed, and the claimed total is kept so real books stay visible.
  const coverage = rosterCoverage(cached)
  const rosterMax = coverage.max
  const effectiveTotal = reconcileEffectiveTotal({
    contiguous: coverage.contiguous,
    rosterMax,
    claimedTotal,
  })

  // The real missing list, recomputed against the fresh roster and the
  // reconciled total.
  const owned = new Set((ownedInstallments || []).map(Number).filter((n) => Number.isSafeInteger(n) && n >= 1))
  const missing = []
  for (let n = 1; n <= effectiveTotal; n += 1) {
    if (!owned.has(n)) missing.push(n)
  }

  const total = missing.length
  let done = 0
  const improvedInstallments = new Set(missing.filter((installment) => (
    installmentImproved(beforeFetch[installment], cached[installment])
  )))
  let filled = improvedInstallments.size
  let unresolved = countIncompleteInstallments(cached, missing)
  // A metadata lookup that throws means a source was down or rate-limiting us —
  // the book is fillable, just not right now, so we must not tell the reader it
  // is permanently missing.
  let sourceThrew = false
  onProgress?.({ done, total, filled, unresolved, current: null })

  // ── AI gap fill ────────────────────────────────────────────────────────────
  // Installments the roster never named cannot be filled by the metadata
  // providers, because searching for them requires a title we do not have. Ask
  // the model which books belong at those numbers, then verify every proposal
  // against the real providers before storing it (resolveGapsWithAi). This is
  // what finally closes gaps left by a Goodreads series page we cannot reach.
  const rosterGaps = missing.filter((installment) => !cached[installment]?.title)
  if (rosterGaps.length && !shouldStop?.()) {
    onProgress?.({ done, total, filled, unresolved, current: 'Working out which books are missing…' })
    try {
      const resolved = await resolveGapsWithAi({
        seriesName,
        cached,
        missing: rosterGaps,
        seedBooks,
        shouldStop,
        onCandidate: ({ title }) => {
          onProgress?.({ done, total, filled, unresolved, current: title })
        },
      })

      for (const [installment, entry] of Object.entries(resolved)) {
        if (installmentImproved(cached[installment], entry)) improvedInstallments.add(Number(installment))
        cached[installment] = entry
      }
      if (Object.keys(resolved).length) {
        filled = improvedInstallments.size
        unresolved = countIncompleteInstallments(cached, missing)
        writeCache(seriesName, cached)
        store.value = { ...store.value, [key]: { ...cached } }
      }
    } catch {
      // The ordering fallback is best-effort; the roster pass still stands.
      sourceThrew = true
    }
  }

  for (const installment of missing) {
    if (shouldStop?.()) break
    const entry = cached[installment]

    if (entry?.title && installmentNeedsDetails(entry)) {
      try {
        const results = await fetchBookMetadataResults(
          entry.title,
          entry.author || undefined,
          undefined,
          { light: true },
        )
        const top = bestResultForInstallment(entry, results)
        if (top) {
          const next = {
            title: entry.title,
            author: entry.author || top.author || null,
            cover: entry.cover || top.cover || null,
            year: entry.year || Number(top.publishYear) || null,
          }
          if (installmentImproved(entry, next)) {
            improvedInstallments.add(installment)
            filled = improvedInstallments.size
          }
          cached[installment] = next
          unresolved = countIncompleteInstallments(cached, missing)
          // Publish as we go so each card fills before the sweep finishes.
          writeCache(seriesName, cached)
          store.value = { ...store.value, [key]: { ...cached } }
        }
      } catch {
        // Source down or rate-limited — leave this one for a later pass.
        sourceThrew = true
      }
    }

    done += 1
    onProgress?.({ done, total, filled, unresolved, current: entry?.title || `Book ${installment}` })
  }

  unresolved = countIncompleteInstallments(cached, missing)
  writeCache(seriesName, cached)
  store.value = { ...store.value, [key]: cached }

  // Why are the leftovers still blank? A missing installment the roster never
  // named at all (no title in the cache) is a book the series-page fetch didn't
  // return — usually because Goodreads rate-limited (HTTP 202) this device, not
  // because the book does not exist. Those, plus any lookup that threw, mean the
  // sources were unreachable and trying again later genuinely helps. This is the
  // difference between an honest "the database is busy, they'll fill in" and a
  // misleading "already up to date" / "try again in a moment" that never moved.
  const absentFromRoster = missing.filter((n) => !cached[n]?.title)
  const sourcesUnreachable = sourceThrew || absentFromRoster.length > 0
  return {
    coverage,
    effectiveTotal,
    cached,
    unresolved,
    absent: absentFromRoster.length,
    sourcesUnreachable,
  }
}

// PHASE 2 — the background reconcile. A book the reader already owns but that
// was never tagged with this series shows up as a "missing" gap. Match each
// resolved installment against the whole library and, where an owned book is
// the same book, tag it with the series and installment so it slides from
// "missing" into its real place — and fill in the rest of ITS metadata while
// there. No modal: this runs quietly after the visible sweep.
export const reconcileSeriesWithLibrary = async ({
  seriesName,
  missing = [],
  allBooks = [],
  updateBook,
  shouldStop,
} = {}) => {
  if (!seriesName || !missing.length || typeof updateBook !== 'function') return { linked: 0 }

  const cached = readCacheRaw(seriesName) || {}
  const key = normalizeSeriesKey(seriesName)
  const linkedBookIds = new Set()
  let linked = 0

  for (const installment of missing) {
    if (shouldStop?.()) break
    const entry = cached[installment]
    if (!entry?.title) continue

    const match = allBooks.find((book) => (
      book?.id
      && !linkedBookIds.has(book.id)
      // Not already correctly placed in this series.
      && !(normalizeSeriesKey(book.series) === key && Number(book.seriesInstallment) === installment)
      && installmentMatchesBook(entry, book)
    ))
    if (!match) continue

    linkedBookIds.add(match.id)

    // Tag it into the series, then top up whatever else the book itself is
    // missing from the metadata engine — this is the "fetch and populate the
    // metadata for that specific book" step, done in the background.
    let record = {
      ...match,
      series: seriesName,
      seriesInstallment: Number(match.seriesInstallment) || installment,
    }
    try {
      const results = await fetchBookMetadataResults(
        match.title,
        match.author || undefined,
        undefined,
        { light: true },
      )
      const top = bestResultForOwnedBook(match, results)
      if (top) {
        record = mergeMetadataIntoBook(record, top) || record
      }
    } catch {
      // Metadata top-up failed; the tag alone still moves it into the series.
    }

    await updateBook(record)
    linked += 1
  }

  return { linked }
}

let _hydrated = false

// Live view of one series' resolved suggestions, for the detail page.
export const useSeriesSuggestions = (seriesNameRef) => {
  // Runs in setup, so the runtime config is reachable here — capture it now for
  // the sweep, which runs from handlers and timers where it would not be.
  rememberPublicConfig()
  const store = useSuggestionsStore()
  // The native plugin hydrates on app open; this covers the web and any route
  // reached before that ran. Once per session either way.
  if (!_hydrated) {
    _hydrated = true
    hydrateSeriesSuggestions()
    // Bundled rosters fill anything the device has never resolved. Not awaited:
    // the page paints from what is already stored, and seeded series appear as
    // soon as the file is read — which is local, so effectively immediately.
    seedSeriesSuggestions().catch(() => {})
  }
  const installments = computed(() => store.value[normalizeSeriesKey(seriesNameRef?.value)] || {})
  return {
    installments,
    fetchSeriesInstallments,
    fillMissingInstallmentDetails,
    reconcileSeriesWithLibrary,
  }
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

    // Every roster is resolved — now fill in the suggestions that came back as
    // little more than a title, so a series page is complete before it is
    // opened rather than after.
    const detailed = await topUpSuggestionDetails(seriesList?.value || [])
    if (detailed) return detailed

    // Anything the roster could not name at all (a Goodreads series page we
    // cannot reach) gets the AI ordering fallback, verified against the real
    // providers before it is stored.
    const named = await fillRosterGapsWithAi(seriesList?.value || [])
    return named || 'idle'
  } finally {
    _sweepInFlight = false
  }
}

// How many under-detailed suggestions to enrich per cycle. Small on purpose:
// this shares the metadata sources with the automatic book-details backfill.
const DETAIL_BATCH = 2

// The AI ordering costs a paid API call, and a series' book list does not change
// hour to hour — so the unattended sweep asks at most once a day per series.
// The manual "Search for missing books" button ignores this: the reader asked.
const AI_ATTEMPT_PREFIX = 'bookish:series-ai-attempt:'
const AI_RETRY_AFTER_MS = 1000 * 60 * 60 * 24

const aiAttemptedRecently = (seriesName) => {
  if (typeof localStorage === 'undefined') return false
  const at = Number(localStorage.getItem(AI_ATTEMPT_PREFIX + normalizeSeriesKey(seriesName))) || 0
  return Date.now() - at < AI_RETRY_AFTER_MS
}

const markAiAttempt = (seriesName) => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(AI_ATTEMPT_PREFIX + normalizeSeriesKey(seriesName), String(Date.now()))
  } catch {
    // Quota/private mode — worst case the sweep asks again next cycle.
  }
}

// Background counterpart to the AI phase of the visible sweep: find the first
// series whose roster still has unnamed installments and try to close them,
// so a series page is complete before it is ever opened. Same verification —
// every proposed title is confirmed by the real providers before it is stored.
const fillRosterGapsWithAi = async (seriesList) => {
  const store = useSuggestionsStore()

  for (const series of seriesList) {
    const books = series?.books || []
    const totals = books.map((book) => Number(book.seriesTotal)).filter((total) => Number.isSafeInteger(total) && total > 0)
    const total = totals.length ? Math.max(...totals) : 0
    if (!total) continue

    const cached = readCacheRaw(series?.name)
    if (!cached) continue

    const owned = new Set(books.map((book) => Number(book.seriesInstallment)).filter((n) => Number.isSafeInteger(n) && n >= 1))
    const gaps = []
    for (let n = 1; n <= total; n += 1) {
      if (!owned.has(n) && !cached[n]?.title) gaps.push(n)
    }
    if (!gaps.length || aiAttemptedRecently(series.name)) continue

    markAiAttempt(series.name)
    const resolved = await resolveGapsWithAi({
      seriesName: series.name,
      cached,
      missing: gaps,
      seedBooks: books,
    })
    if (!Object.keys(resolved).length) continue

    const merged = { ...cached, ...resolved }
    writeCache(series.name, merged)
    store.value = { ...store.value, [normalizeSeriesKey(series.name)]: merged }
    return `named:${series.name}`
  }

  return null
}

// Find the first series holding suggestions that are missing a cover, author or
// year, fill a couple of them from the cross-checked metadata engine, and write
// the result back to the device so it is there on the next open.
const topUpSuggestionDetails = async (seriesList) => {
  const store = useSuggestionsStore()

  for (const series of seriesList) {
    const cached = readCacheRaw(series?.name)
    if (!cached) continue

    const gaps = Object.keys(cached)
      .filter((installment) => installmentNeedsDetails(cached[installment]))
      .slice(0, DETAIL_BATCH)
    if (!gaps.length) continue

    let changed = false
    for (const installment of gaps) {
      const entry = cached[installment]
      if (!entry?.title) continue
      try {
        const results = await fetchBookMetadataResults(
          entry.title,
          entry.author || undefined,
          undefined,
          { light: true },
        )
        // Same guard the automatic backfill uses: never accept another book's
        // details just because the search returned something — and scan every
        // result for the real match, not just the first.
        const top = bestResultForInstallment(entry, results)
        if (!top) continue
        cached[installment] = {
          ...entry,
          author: entry.author || top.author || null,
          cover: entry.cover || top.cover || null,
          year: entry.year || Number(top.publishYear) || null,
        }
        changed = true
      } catch {
        // Source down or throttled — try again on a later cycle.
      }
    }

    if (!changed) continue
    writeCache(series.name, cached)
    store.value = { ...store.value, [normalizeSeriesKey(series.name)]: cached }
    return `detailed:${series.name}`
  }

  return null
}

// Start the repeating sweep. Idempotent — safe to call from a plugin on every
// app start.
export const startSeriesSuggestionSweep = ({ seriesList }) => {
  if (_sweepTimer !== null || typeof setInterval !== 'function') return
  // Started from a plugin, so a Nuxt instance is live — the background sweep
  // later runs on a timer, where it would not be.
  rememberPublicConfig()
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
