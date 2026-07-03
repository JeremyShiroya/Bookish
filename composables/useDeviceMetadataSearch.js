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

  for (const id of ['publisherName', 'publisherSearch', 'publisherScrape']) {
    onProgress?.({
      type: 'step',
      id,
      status: 'skipped',
      detail: 'Publisher-site research runs on the Bookish server (set a server URL in Settings to enable it)',
    })
  }

  onProgress?.({ type: 'step', id: 'merge', status: 'active', detail: 'Combining provider metadata' })
  const results = buildMetadataResults(title, author, {
    goodreadsSources,
    googleBooksSources,
    internetArchiveSources,
    openLibrarySources,
    koboSources,
    publisherSources: [],
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
