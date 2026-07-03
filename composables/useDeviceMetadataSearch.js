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

import { searchGoodreads, scrapeGoodreadsBook } from '~/server/utils/goodreadsScraper'
import { searchGoogleBooks } from '~/server/utils/googleBooksApi'
import { searchInternetArchive } from '~/server/utils/internetArchiveApi'
import { searchOpenLibrary } from '~/server/utils/openLibraryApi'
import { searchKobo, scrapeKoboBook } from '~/server/utils/koboScraper'
import { buildMetadataResults } from '~/server/utils/metadataAggregator'
import { searchKnownPublisherSites, searchPublisherMetadata } from '~/server/utils/publisherMetadata'

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

async function getGoodreadsSources(title, author) {
  const searchResults = await withTimeout(searchGoodreads(title, author), [], 15000)
  const details = await withTimeout(
    Promise.allSettled(searchResults.slice(0, 4).map(async (item) => ({
      search: item,
      details: await scrapeGoodreadsBook(item.url, item),
    }))),
    [],
    15000,
  )

  return details
    .filter((entry) => entry.status === 'fulfilled')
    .map(({ value }) => ({
      id: value.search.url,
      source: 'goodreads',
      title: value.details?.title ?? value.search.title ?? null,
      author: value.details?.author ?? value.search.author ?? null,
      cover: value.details?.cover ?? value.search.cover ?? null,
      blurb: value.details?.blurb ?? null,
      series: value.details?.series ?? value.search.series ?? null,
      seriesInstallment: value.details?.seriesInstallment ?? value.search.seriesInstallment ?? null,
      seriesTotal: value.details?.seriesTotal ?? value.search.seriesTotal ?? null,
      genre: value.details?.genre ?? null,
      publishYear: value.details?.publishYear ?? null,
      publisher: value.details?.publisher ?? null,
      webReview: value.details?.webReview ?? value.search.webReview ?? null,
    }))
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

  if (!publisherSources.length) {
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
  const onProgress = options.onProgress
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
