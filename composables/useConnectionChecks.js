// Plain-language health checks for everything Pages needs the internet for.
//
// The point is to answer "is it me, the app, or the service?" without the user
// having to read a stack trace. Each check returns a status, a sentence anyone
// can act on, and a short technical detail worth copying into a bug report.
//
// Every check runs the SAME code path the feature itself uses wherever
// possible, so a pass here means the feature really works — not that some
// simplified probe worked.

import { useApiEndpoint } from '~/composables/useApiEndpoint'
import { isNativeCapacitorPlatform } from '~/composables/useNativePlatform'

const loadDeviceSearch = () => import('~/composables/useDeviceMetadataSearch')

// pass    — working
// warn    — degraded but the app copes (another provider covers it)
// fail    — this capability is broken
// skipped — not applicable on this device/build
export const CHECK_STATUS = Object.freeze({
  pass: 'pass',
  warn: 'warn',
  fail: 'fail',
  skipped: 'skipped',
})

const withTimeout = async (promise, ms, label) => {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

// Google Books is the only provider with a key, so its failures are the ones
// users can actually do something about — hence the specific messages.
const describeGoogleBooks = (status, body) => {
  if (status === 200) return null
  if (status === 429) {
    return /per day/i.test(body)
      ? {
          status: CHECK_STATUS.warn,
          summary: "Google Books has hit today's limit. It resets tomorrow — other sources are covering in the meantime.",
        }
      : {
          status: CHECK_STATUS.warn,
          summary: 'Google Books is briefly rate limiting us. It usually clears within a minute.',
        }
  }
  if (status === 403) {
    return {
      status: CHECK_STATUS.fail,
      summary: /blocked/i.test(body)
        ? 'The Google Books key is refusing this app. Its "Application restrictions" should be set to None.'
        : 'The Google Books key was rejected. Check it is correct and that the Books API is enabled.',
    }
  }
  if (status >= 500) {
    return {
      status: CHECK_STATUS.warn,
      summary: 'Google Books stayed unavailable even after several retries. This is trouble at their end — nothing to fix here, and other sources cover for it.',
    }
  }
  return { status: CHECK_STATUS.fail, summary: `Google Books replied unexpectedly (code ${status}).` }
}

async function checkInternet() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      status: CHECK_STATUS.fail,
      summary: 'This device says it is offline. Everything else below needs a connection.',
      detail: 'navigator.onLine === false',
    }
  }
  try {
    const started = Date.now()
    await withTimeout(fetch('https://openlibrary.org/search.json?title=a&limit=1'), 15000, 'Connection test')
    return {
      status: CHECK_STATUS.pass,
      summary: 'Connected to the internet.',
      detail: `reachable in ${Date.now() - started}ms`,
    }
  } catch (error) {
    return {
      status: CHECK_STATUS.fail,
      summary: 'Could not reach the internet. Check Wi-Fi or mobile data.',
      detail: String(error?.message || error),
    }
  }
}

async function checkGoogleBooksKey({ googleBooksApiKey }) {
  if (!googleBooksApiKey) {
    return {
      status: CHECK_STATUS.warn,
      summary: 'No Google Books key is set, so Pages shares a public allowance that is often used up. Other sources still work.',
      detail: 'runtimeConfig.public.googleBooksApiKey is empty',
    }
  }
  return {
    status: CHECK_STATUS.pass,
    summary: 'A Google Books key is set up in this build.',
    detail: `key present (${googleBooksApiKey.length} characters)`,
  }
}

async function checkGoogleBooksSearch({ googleBooksApiKey }) {
  const query = '/books/v1/volumes?q=intitle:Dune&maxResults=3&country=US'
    + (googleBooksApiKey ? `&key=${encodeURIComponent(googleBooksApiKey)}` : '')
  try {
    const started = Date.now()
    // The same retrying engine the app itself uses (alternating hosts, burst
    // straddling). Google Books fails a share of single requests as a matter
    // of course; a one-shot probe here reported "trouble" whenever one attempt
    // landed in a 503 burst, even though real lookups were riding it out fine.
    const { googleBooksRequest } = await import('~/server/utils/googleBooksApi')
    const response = await withTimeout(googleBooksRequest(query), 25000, 'Google Books')
    const body = await response.text()
    const problem = describeGoogleBooks(response.status, body)
    if (problem) {
      return { ...problem, detail: `HTTP ${response.status} · ${body.slice(0, 160).replace(/\s+/g, ' ')}` }
    }
    let count = 0
    try { count = (JSON.parse(body).items || []).length } catch {}
    return {
      status: count ? CHECK_STATUS.pass : CHECK_STATUS.warn,
      summary: count
        ? `Google Books answered with ${count} results.`
        : 'Google Books answered but found nothing for the test book.',
      detail: `HTTP 200 · ${count} items · ${Date.now() - started}ms`,
    }
  } catch (error) {
    return {
      status: CHECK_STATUS.fail,
      summary: 'Could not reach Google Books at all.',
      detail: String(error?.message || error),
    }
  }
}

const simpleProvider = (label, url, { optional = false } = {}) => async () => {
  try {
    const started = Date.now()
    const response = await withTimeout(fetch(url), 20000, label)
    if (response.status === 200) {
      return {
        status: CHECK_STATUS.pass,
        summary: `${label} is responding normally.`,
        detail: `HTTP 200 · ${Date.now() - started}ms`,
      }
    }
    return {
      status: optional ? CHECK_STATUS.warn : CHECK_STATUS.fail,
      summary: `${label} replied with a problem (code ${response.status}).`
        + (optional ? ' Book details still work without it.' : ''),
      detail: `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      status: optional ? CHECK_STATUS.warn : CHECK_STATUS.fail,
      summary: `Could not reach ${label}.` + (optional ? ' Book details still work without it.' : ''),
      detail: String(error?.message || error),
    }
  }
}

// The real thing: run an actual metadata lookup exactly as Add/Edit does.
async function checkMetadataPipeline() {
  const { apiBaseUrl, apiUrl } = useApiEndpoint()
  const native = isNativeCapacitorPlatform()
  const started = Date.now()

  try {
    let results = []
    if (native && !apiBaseUrl) {
      const { fetchBookMetadataOnDevice } = await loadDeviceSearch()
      results = await withTimeout(fetchBookMetadataOnDevice('Dune', 'Frank Herbert', undefined, { light: true }), 90000, 'Book details')
    } else {
      const response = await withTimeout(
        fetch(apiUrl('/api/books/metadata?title=Dune&author=Frank%20Herbert')),
        90000,
        'Book details',
      )
      if (!response.ok) throw new Error(`server replied ${response.status}`)
      results = (await response.json())?.results || []
    }

    return {
      status: results.length ? CHECK_STATUS.pass : CHECK_STATUS.fail,
      summary: results.length
        ? `Book details are working — found ${results.length} matches for a test book.`
        : 'Book details found nothing for a well-known test book, so something is wrong.',
      detail: `${results.length} results · ${Math.round((Date.now() - started) / 1000)}s`,
    }
  } catch (error) {
    return {
      status: CHECK_STATUS.fail,
      summary: 'The book details lookup failed.',
      detail: String(error?.message || error),
    }
  }
}

async function checkSeriesLookup() {
  const started = Date.now()
  try {
    const { apiBaseUrl } = useApiEndpoint()
    if (!isNativeCapacitorPlatform() && !apiBaseUrl) {
      // Web dev/server build: the endpoint covers this and is already
      // exercised by the book-details check above.
      return {
        status: CHECK_STATUS.skipped,
        summary: 'Series suggestions are checked as part of book details on this device.',
        detail: 'web build',
      }
    }
    const { fetchSeriesBooksOnDevice } = await loadDeviceSearch()
    const roster = await withTimeout(fetchSeriesBooksOnDevice('Red Rising', 'Pierce Brown', 'Red Rising'), 60000, 'Series lookup')
    const books = roster?.books?.length || 0
    return {
      status: books ? CHECK_STATUS.pass : CHECK_STATUS.warn,
      summary: books
        ? `Series suggestions are working — listed ${books} books in a test series.`
        : 'Could not list a test series. Suggestions may show blank slots for now.',
      detail: `${books} installments · ${Math.round((Date.now() - started) / 1000)}s`,
    }
  } catch (error) {
    return {
      status: CHECK_STATUS.warn,
      summary: 'The series lookup failed. Suggestions may show blank slots.',
      detail: String(error?.message || error),
    }
  }
}

// Ordered so the most fundamental thing is tested first: if the internet check
// fails, everything under it is expected to fail too.
export const CONNECTION_CHECKS = [
  { id: 'internet', label: 'Internet connection', hint: 'Everything below needs this', run: checkInternet },
  { id: 'googleKey', label: 'Google Books setup', hint: 'Whether this build has its own key', run: checkGoogleBooksKey },
  { id: 'googleSearch', label: 'Google Books search', hint: 'Covers, blurbs and publication years', run: checkGoogleBooksSearch },
  {
    id: 'openLibrary',
    label: 'Open Library',
    hint: 'Free book database — no key needed',
    run: simpleProvider('Open Library', 'https://openlibrary.org/search.json?title=Dune&limit=2', { optional: true }),
  },
  {
    id: 'archive',
    label: 'Internet Archive',
    hint: 'Free book database — no key needed',
    run: simpleProvider('Internet Archive', 'https://archive.org/advancedsearch.php?q=title%3A%28Dune%29&rows=2&output=json', { optional: true }),
  },
  {
    id: 'goodreads',
    label: 'Goodreads',
    hint: 'Ratings and series information',
    run: simpleProvider('Goodreads', 'https://www.goodreads.com/book/title?id=Dune%20Frank%20Herbert', { optional: true }),
  },
  { id: 'metadata', label: 'Book details (full test)', hint: 'Runs a real lookup, exactly like the app does', run: checkMetadataPipeline },
  { id: 'series', label: 'Series suggestions', hint: 'Finding books you are missing from a series', run: checkSeriesLookup },
]

export const useConnectionChecks = () => {
  const context = () => {
    let googleBooksApiKey = ''
    try {
      googleBooksApiKey = useRuntimeConfig()?.public?.googleBooksApiKey || ''
    } catch {}
    return { googleBooksApiKey }
  }

  const runCheck = async (check) => {
    try {
      return await check.run(context())
    } catch (error) {
      return {
        status: CHECK_STATUS.fail,
        summary: 'This test could not finish.',
        detail: String(error?.message || error),
      }
    }
  }

  return { checks: CONNECTION_CHECKS, runCheck }
}

// A single block of text the user can copy into a bug report.
export function buildDiagnosticsReport(results, meta = {}) {
  const lines = [
    `Pages connection test — ${new Date().toISOString()}`,
    `App ${meta.appVersion || 'unknown'} · ${meta.platform || 'unknown'}`,
    '',
  ]
  for (const check of CONNECTION_CHECKS) {
    const result = results[check.id]
    if (!result) continue
    lines.push(`[${String(result.status).toUpperCase()}] ${check.label}: ${result.summary}`)
    if (result.detail) lines.push(`    ${result.detail}`)
  }
  return lines.join('\n')
}
