// On-device metadata pipeline for native (Capacitor) builds.
//
// The full server pipeline in server/api/books/metadata.get.ts cannot run on
// the phone (no Nuxt server in the bundled app), but its core providers —
// Goodreads, Google Books, Kobo, Open Library, Internet Archive — are plain
// fetch + cheerio code with no Node dependencies, so we run them directly in
// the WebView. CapacitorHttp (capacitor.config.ts) proxies fetch through the
// native HTTP stack, which bypasses CORS and lets the scraper headers through.
//
// Publisher-site crawling and Groq verification stay server-only: the first
// is too slow for a phone, the second would ship the API key in the APK.
// This module is dynamically imported so the web bundle never carries cheerio.

import { useRuntimeConfig } from '#app'
import { searchGoodreads, scrapeGoodreadsBook, fetchGoodreadsSeriesBooks } from '~/server/utils/goodreadsScraper'
import { searchGoogleBooks, setGoogleBooksApiKey } from '~/server/utils/googleBooksApi'
import { searchInternetArchive } from '~/server/utils/internetArchiveApi'
import { searchOpenLibrary } from '~/server/utils/openLibraryApi'
import { searchKobo, scrapeKoboBook } from '~/server/utils/koboScraper'
import { buildMetadataResults } from '~/server/utils/metadataAggregator'
import { searchKnownPublisherSites, searchPublisherMetadata } from '~/server/utils/publisherMetadata'

// The providers live in server/utils and cannot read Nuxt's runtime config
// themselves, so hand the Books key down before any lookup runs. Without this
// the phone falls back to the shared anonymous project, whose daily quota is
// routinely already spent by other callers.
let _googleKeyApplied = false

function applyGoogleBooksKey() {
  if (_googleKeyApplied) return
  try {
    const key = useRuntimeConfig()?.public?.googleBooksApiKey
    if (key) setGoogleBooksApiKey(key)
    _googleKeyApplied = true
  } catch {
    // Outside a Nuxt context (tests, early startup) — the server-side
    // process.env path still applies, and the next call retries.
  }
}

async function withTimeout(task, fallback, timeoutMs) {
  let timeoutId
  try {
    return await Promise.race([
      task,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs)
      }),
    ])
  } catch {
    return fallback
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const asSource = (source) => (result) => ({
  id: result.url || result.id || `${source}:${result.title}:${result.author || ''}`,
  source,
  title: result.title ?? null,
  author: result.author ?? null,
  cover: result.cover ?? null,
  blurb: result.blurb ?? null,
  series: result.series ?? null,
  seriesInstallment: result.seriesInstallment ?? null,
  seriesTotal: result.seriesTotal ?? null,
  genre: result.genre ?? null,
  publishYear: result.publishYear ?? null,
  publisher: result.publisher ?? null,
  webReview: result.webReview ?? null,
})

const goodreadsSourceFrom = (search, details) => ({
  id: search.url,
  source: 'goodreads',
  title: details?.title ?? search.title ?? null,
  author: details?.author ?? search.author ?? null,
  cover: details?.cover ?? search.cover ?? null,
  blurb: details?.blurb ?? null,
  series: details?.series ?? search.series ?? null,
  seriesInstallment: details?.seriesInstallment ?? search.seriesInstallment ?? null,
  seriesTotal: details?.seriesTotal ?? search.seriesTotal ?? null,
  genre: details?.genre ?? null,
  publishYear: details?.publishYear ?? null,
  publisher: details?.publisher ?? null,
  webReview: details?.webReview ?? search.webReview ?? null,
})

// Goodreads search results ALREADY carry title, author, cover and series; the
// per-book scrape only adds blurb/genre/year. On a slow connection a book page
// can take ~9s, so scraping several in parallel blew the old 15s budget and the
// timeout discarded everything — including the perfectly good search results.
// That was the main reason metadata "didn't work" on a real phone. Now the
// search results are the baseline and detail scrapes only enrich them.
async function getGoodreadsSources(title, author) {
  const searchResults = await withTimeout(searchGoodreads(title, author), [], 25000)
  if (!searchResults.length) return []

  // Two, not four: each is a ~900KB page, and the extra pair added latency and
  // memory pressure for fields the search already mostly provides.
  const candidates = searchResults.slice(0, 2)
  const details = await withTimeout(
    Promise.allSettled(candidates.map((item) => scrapeGoodreadsBook(item.url, item))),
    [],
    25000,
  )

  return candidates.map((search, index) => {
    const entry = details[index]
    const scraped = entry?.status === 'fulfilled' ? entry.value : null
    return goodreadsSourceFrom(search, scraped)
  })
}

async function getKoboSources(title, author) {
  const koboUrls = await withTimeout(searchKobo(title, author), [], 7000)
  const koboDetails = await withTimeout(
    Promise.allSettled(koboUrls.slice(0, 4).map((url) => scrapeKoboBook(url))),
    [],
    7000,
  )
  return koboDetails
    .filter((entry) => entry.status === 'fulfilled' && entry.value !== null)
    .map((entry) => asSource('kobo')(entry.value))
}

const fromPublisher = (result) => ({
  id: result.id,
  source: 'publisher',
  title: result.title ?? null,
  author: result.author ?? null,
  cover: result.cover ?? null,
  blurb: result.blurb ?? null,
  series: null,
  seriesInstallment: null,
  seriesTotal: null,
  genre: null,
  publishYear: null,
  publisher: result.publisher ?? null,
  searchedPublisher: result.searchedPublisher,
  publisherSite: result.publisherSite,
})

function uniquePublishers(sources) {
  const seen = new Set()
  const publishers = []

  for (const source of sources) {
    const publisher = source.publisher?.trim()
    if (!publisher) continue
    const key = publisher.toLowerCase().replace(/[^a-z0-9]+/g, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    publishers.push(publisher)
  }

  return publishers.slice(0, 4)
}

// Mirrors the publisher stage of server/api/books/metadata.get.ts: try the
// publisher names found in provider records first, then research the major
// publisher sites directly.
async function getPublisherSources(title, author, publisherCandidates, onProgress) {
  const relayProgress = (event) => {
    onProgress?.({ type: 'step', id: event.stage, status: event.status, detail: event.message })
  }

  let publisherSources = []
  if (publisherCandidates.length) {
    onProgress?.({ type: 'step', id: 'publisherSearch', status: 'active', detail: 'Finding official publisher book pages' })
    publisherSources = await withTimeout(
      searchPublisherMetadata(title, author, publisherCandidates, { onProgress: relayProgress }),
      [],
      14000,
    ).then((results) => results.map(fromPublisher))
  }

  // The blind crawl of major publisher sites is the slowest stage by far: on a
  // real phone it was the difference between a 20s and a 35s lookup. It does
  // find extra options, so an interactive "Fetch Metadata" (where the user is
  // watching and wants the best result) still runs it. Bulk/background work
  // passes `light` and skips it — at ~300 books those 15s each are the
  // difference between a ~2 hour and a ~3 hour sweep.
  if (!publisherSources.length && (publisherCandidates.length || !light)) {
    onProgress?.({
      type: 'step',
      id: 'publisherSearch',
      status: 'active',
      detail: publisherCandidates.length
        ? 'Publisher-name lookup found no book page; researching major publisher sites by title and author'
        : 'Searching major publisher websites directly',
    })
    publisherSources = await withTimeout(
      searchKnownPublisherSites(title, author, { onProgress: relayProgress }),
      [],
      18000,
    ).then((results) => results.map(fromPublisher))
  }

  onProgress?.({
    type: 'step',
    id: 'publisherSearch',
    status: publisherSources.length ? 'success' : 'error',
    detail: publisherSources.length
      ? 'Found publisher-site metadata'
      : 'No matching publisher book page was found',
  })
  onProgress?.({
    type: 'step',
    id: 'publisherScrape',
    status: publisherSources.length ? 'success' : 'error',
    detail: publisherSources.length
      ? `Scraped ${publisherSources.length} publisher result${publisherSources.length === 1 ? '' : 's'}`
      : 'Publisher pages could not be scraped or did not match this book',
  })

  return publisherSources
}

export async function fetchBookMetadataOnDevice(title, author, publisher, options = {}) {
  applyGoogleBooksKey()
  const onProgress = options.onProgress
  // Bulk/background lookups set this to skip the slowest, lowest-yield stage.
  const light = options.light === true
  onProgress?.({
    type: 'step',
    id: 'core',
    status: 'active',
    detail: 'Searching Goodreads, Google Books, Kobo, Open Library, and Internet Archive from this device',
  })

  const [internetArchiveResults, openLibraryResults, googleBooksResults, koboSources, goodreadsSources] = await Promise.all([
    withTimeout(searchInternetArchive(title, author), [], 9000),
    withTimeout(searchOpenLibrary(title, author), [], 9000),
    withTimeout(searchGoogleBooks(title, author), [], 9000),
    getKoboSources(title, author),
    getGoodreadsSources(title, author),
  ])

  const internetArchiveSources = internetArchiveResults.map(asSource('internetArchive'))
  const openLibrarySources = openLibraryResults.map(asSource('openLibrary'))
  const googleBooksSources = googleBooksResults.map(asSource('googleBooks'))

  const coreCount = internetArchiveSources.length
    + openLibrarySources.length
    + googleBooksSources.length
    + koboSources.length
    + goodreadsSources.length
  onProgress?.({
    type: 'step',
    id: 'core',
    status: coreCount ? 'success' : 'error',
    detail: coreCount
      ? `Found ${coreCount} source result${coreCount === 1 ? '' : 's'}`
      : 'No metadata providers returned results',
  })

  onProgress?.({ type: 'step', id: 'publisherName', status: 'active', detail: 'Reading publisher fields from returned metadata' })
  const publisherCandidates = uniquePublishers([
    ...(publisher ? [{ publisher }] : []),
    ...googleBooksSources,
    ...openLibrarySources,
    ...internetArchiveSources,
    ...koboSources,
    ...goodreadsSources,
  ])
  onProgress?.({
    type: 'step',
    id: 'publisherName',
    status: publisherCandidates.length ? 'success' : 'skipped',
    detail: publisherCandidates.length
      ? `Trying ${publisherCandidates.join(', ')}`
      : 'No publisher field was found; researching major publisher sites by title and author',
  })

  const publisherSources = await getPublisherSources(title, author, publisherCandidates, onProgress)

  onProgress?.({ type: 'step', id: 'merge', status: 'active', detail: 'Combining provider and publisher metadata' })
  const results = buildMetadataResults(title, author, {
    goodreadsSources,
    googleBooksSources,
    internetArchiveSources,
    openLibrarySources,
    koboSources,
    publisherSources,
  })
  onProgress?.({
    type: 'step',
    id: 'merge',
    status: results.length ? 'success' : 'error',
    detail: results.length
      ? `Prepared ${results.length} metadata option${results.length === 1 ? '' : 's'}`
      : 'No metadata options could be prepared',
  })

  return results
}

// On-device port of server/api/books/series-books.get.ts: resolve the whole
// series roster (title/cover per installment) from an owned seed book. Runs in
// the WebView through CapacitorHttp exactly like the metadata pipeline above.
export async function fetchSeriesBooksOnDevice(seedTitle, author, seriesName) {
  return withTimeout(fetchGoodreadsSeriesBooks(seedTitle, author, seriesName), { series: null, books: [] }, 30000)
}

// On-device port of server/api/books/series-total.get.ts.
export async function fetchSeriesTotalOnDevice(title, author) {
  const searchResults = await withTimeout(searchGoodreads(title, author), [], 15000)
  const details = await Promise.allSettled(
    searchResults.slice(0, 3).map((result) => scrapeGoodreadsBook(result.url, result)),
  )

  return details
    .filter((entry) => entry.status === 'fulfilled' && entry.value !== null)
    .map((entry) => entry.value)
    .filter((result) => result.series && Number(result.seriesTotal) > 0)
    .map((result) => ({
      title: result.title,
      author: result.author,
      series: result.series,
      seriesInstallment: result.seriesInstallment,
      seriesTotal: result.seriesTotal,
    }))
}
