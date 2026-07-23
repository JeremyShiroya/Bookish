import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  BOOKISH_DEVICE_IMPORTS_KEY,
  BOOKISH_SCAN_FOLDERS_KEY,
  MAX_DEVICE_IMPORT_BYTES,
  cleanTitleFromFileName,
  fileInScanFolders,
  isTooLargeError,
  mergeMetadataIntoBook,
  normalizeScanFolder,
  readImportRegistry,
  readScanFolders,
  selectNewDeviceFiles,
  writeImportRegistry,
  writeScanFolders,
} from '../composables/useDeviceLibrarySync.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const fakeStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

describe('device library sync', () => {
  test('imports only unseen or changed pdf/epub files', () => {
    const registry = {
      '/storage/emulated/0/Books/known.epub': { size: 100, modified: 5 },
      '/storage/emulated/0/Books/changed.pdf': { size: 100, modified: 5 },
      '/storage/emulated/0/Books/failed.epub': { size: 70, modified: 3, failed: true },
    }
    const files = [
      { path: '/storage/emulated/0/Books/known.epub', name: 'known.epub', size: 100, modified: 5 },
      { path: '/storage/emulated/0/Books/changed.pdf', name: 'changed.pdf', size: 250, modified: 9 },
      { path: '/storage/emulated/0/Books/new.pdf', name: 'new.pdf', size: 300, modified: 10 },
      { path: '/storage/emulated/0/Books/failed.epub', name: 'failed.epub', size: 70, modified: 3 },
      { path: '/storage/emulated/0/Notes/readme.txt', name: 'readme.txt', size: 10, modified: 1 },
      { path: '/storage/emulated/0/Books/huge.pdf', name: 'huge.pdf', size: 900 * 1024 * 1024, modified: 2 },
    ]

    expect(selectNewDeviceFiles(files, registry).map((file) => file.name)).toEqual(['changed.pdf', 'new.pdf'])
  })

  test('round-trips the import registry through storage', () => {
    const storage = fakeStorage()
    writeImportRegistry({ '/a.pdf': { size: 1, modified: 2 } }, storage)
    expect(JSON.parse(storage.getItem(BOOKISH_DEVICE_IMPORTS_KEY))).toEqual({ '/a.pdf': { size: 1, modified: 2 } })
    expect(readImportRegistry(storage)).toEqual({ '/a.pdf': { size: 1, modified: 2 } })
    expect(readImportRegistry(fakeStorage({ [BOOKISH_DEVICE_IMPORTS_KEY]: 'not-json' }))).toEqual({})
  })

  test('derives a readable title from a file name', () => {
    expect(cleanTitleFromFileName('the_martian-andy_weir.epub')).toBe('the martian andy weir')
    expect(cleanTitleFromFileName('Project Hail Mary.pdf')).toBe('Project Hail Mary')
  })

  test('backfill only fills empty fields and never overwrites user data', () => {
    const book = {
      id: '1',
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      blurb: '',
      genre: '',
      publishYear: null,
      series: null,
      seriesInstallment: null,
      seriesTotal: null,
      cover: 'data:image/svg+xml,placeholder',
      webReview: null,
    }
    const meta = {
      title: 'Project Hail Mary (different)',
      author: 'Somebody Else',
      blurb: 'An astronaut wakes alone.',
      genre: 'Science Fiction',
      publishYear: 2021,
      cover: 'https://covers.example/phm.jpg',
      webReview: { rating: 4.5 },
    }

    const updated = mergeMetadataIntoBook(book, meta)
    expect(updated.title).toBe('Project Hail Mary')
    expect(updated.author).toBe('Andy Weir')
    expect(updated.blurb).toBe('An astronaut wakes alone.')
    expect(updated.genre).toBe('Science Fiction')
    expect(updated.publishYear).toBe(2021)
    expect(updated.cover).toBe('https://covers.example/phm.jpg')
    expect(updated.webReview).toEqual({ rating: 4.5 })

    // A real (non-placeholder) cover is never replaced.
    const covered = mergeMetadataIntoBook({ ...book, cover: 'blob:local-cover' }, meta)
    expect(covered.cover).toBe('blob:local-cover')

    // Nothing to fill → no update.
    expect(mergeMetadataIntoBook({ ...updated, series: 'S', seriesInstallment: 1, seriesTotal: 3, publisher: 'P' }, meta)).toBeNull()
  })

  test('scan folders normalize, persist, and gate which files import', () => {
    expect(normalizeScanFolder('Download')).toBe('/storage/emulated/0/Download')
    expect(normalizeScanFolder('/storage/emulated/0/Books/')).toBe('/storage/emulated/0/Books')
    expect(normalizeScanFolder('  ')).toBe('')

    const storage = fakeStorage()
    expect(writeScanFolders(['Download', 'Download', '/storage/emulated/0/Books'], storage))
      .toEqual(['/storage/emulated/0/Download', '/storage/emulated/0/Books'])
    expect(readScanFolders(storage)).toEqual(['/storage/emulated/0/Download', '/storage/emulated/0/Books'])

    // Default (never configured) scans everything; explicitly empty = scan off.
    expect(readScanFolders(fakeStorage())).toEqual(['/storage/emulated/0'])
    expect(readScanFolders(fakeStorage({ [BOOKISH_SCAN_FOLDERS_KEY]: '[]' }))).toEqual([])

    const folders = ['/storage/emulated/0/Download']
    expect(fileInScanFolders('/storage/emulated/0/Download/book.epub', folders)).toBe(true)
    expect(fileInScanFolders('/storage/emulated/0/Download/sub/book.pdf', folders)).toBe(true)
    expect(fileInScanFolders('/storage/emulated/0/Downloads-old/book.pdf', folders)).toBe(false)
  })

  test('native shell wires up the DeviceBooks plugin and permissions', () => {
    expect(existsSync(resolve(root, 'android/app/src/main/java/com/bookish/app/DeviceBooksPlugin.java'))).toBe(true)

    const mainActivity = read('android/app/src/main/java/com/bookish/app/MainActivity.java')
    expect(mainActivity).toContain('registerPlugin(DeviceBooksPlugin.class)')

    const manifest = read('android/app/src/main/AndroidManifest.xml')
    expect(manifest).toContain('android.permission.MANAGE_EXTERNAL_STORAGE')
    expect(manifest).toContain('android.permission.READ_EXTERNAL_STORAGE')

    const plugin = read('android/app/src/main/java/com/bookish/app/DeviceBooksPlugin.java')
    expect(plugin).toContain('ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION')
    expect(plugin).toContain('.pdf')
    expect(plugin).toContain('.epub')

    const nuxtPlugin = read('plugins/device-library-sync.client.js')
    expect(nuxtPlugin).toContain('syncDeviceLibrary')
    expect(nuxtPlugin).toContain('isNativeCapacitorPlatform')
  })
})

// Regression: a library with hundreds of books almost always contains one huge
// document. Base64-ing an 80MB book needed ~380MB against Android's 256MB heap
// cap, and the OutOfMemoryError (an Error, not an Exception) escaped the
// plugin's catch and killed the whole app on launch.
describe('oversized device documents never crash the app', () => {
  test('the import cap is small enough for the base64 bridge to survive', () => {
    // Peak native cost is ~3.7x the file size; the cap must leave room inside
    // a 256MB heap that the WebView is already using part of.
    expect(MAX_DEVICE_IMPORT_BYTES).toBeLessThanOrEqual(64 * 1024 * 1024)
    expect(selectNewDeviceFiles(
      [{ path: '/storage/emulated/0/Books/huge.pdf', size: 81 * 1024 * 1024, modified: 1 }],
      {},
    )).toEqual([])
  })

  test('a file proven too large is never retried on later scans', () => {
    const file = { path: '/storage/emulated/0/Books/big.epub', size: 40 * 1024 * 1024, modified: 7 }
    const registry = { [file.path]: { size: file.size, modified: file.modified, failed: true, tooLarge: true } }
    expect(selectNewDeviceFiles([file], registry)).toEqual([])

    // …but a genuinely different file at that path is fair game again.
    const replaced = { ...file, size: 2 * 1024 * 1024, modified: 9 }
    expect(selectNewDeviceFiles([replaced], registry)).toEqual([replaced])
  })

  test('recognises the native too-large rejection by code and by message', () => {
    expect(isTooLargeError({ code: 'FILE_TOO_LARGE' })).toBe(true)
    expect(isTooLargeError({ message: 'Not enough memory to import a 90MB file' })).toBe(true)
    expect(isTooLargeError({ message: 'Ran out of memory reading: /x.pdf' })).toBe(true)
    expect(isTooLargeError({ message: 'File cannot be read: /x.pdf' })).toBe(false)
    expect(isTooLargeError(undefined)).toBe(false)
  })

  test('the native plugin catches Throwable so an OOM can never be fatal', () => {
    const plugin = read('android/app/src/main/java/com/bookish/app/DeviceBooksPlugin.java')
    // Both bridge readers must catch Error, not just Exception.
    expect(plugin.match(/catch \(OutOfMemoryError/g) || []).toHaveLength(2)
    expect(plugin.match(/catch \(Throwable/g) || []).toHaveLength(2)
    expect(plugin).not.toMatch(/catch \(Exception e\) \{\s*call\.reject\("Failed to read file/)
    // And refuse a read up front when the heap cannot afford it.
    expect(plugin).toContain('availableHeapBytes')
    expect(plugin).toContain('FILE_TOO_LARGE')
    // The doubling ByteArrayOutputStream is gone from the path-based read.
    expect(plugin).toContain('byte[] bytes = new byte[(int) length]')
  })
})

// Regression: metadata "not working" on a real 300-book phone. Live probes on
// device showed Google Books returning 429 (anonymous quota burned by the
// backfill + series sweep), Open Library unreachable, and Goodreads reachable
// but ~9s per page — so the parallel detail scrapes blew their budget and the
// timeout threw away the search results along with them.
describe('metadata pipeline survives slow and rate-limited providers', () => {
  test('Goodreads search results are kept even when detail scraping times out', () => {
    const source = read('composables/useDeviceMetadataSearch.js')
    // Search results are the baseline; scrapes only enrich them.
    expect(source).toContain('goodreadsSourceFrom')
    expect(source).toMatch(/if \(!searchResults\.length\) return \[\]/)
    // Fewer parallel ~900KB page fetches, and a budget that fits a slow phone
    // (a single Goodreads page measured ~9s on the affected device).
    expect(source).toContain('searchResults.slice(0, 2)')
    const getSources = source.slice(
      source.indexOf('async function getGoodreadsSources'),
      source.indexOf('async function getKoboSources'),
    )
    expect(getSources).not.toContain('15000')
    expect(getSources).toContain('25000')
  })

  test('Google Books backs off instead of hammering an exhausted quota', () => {
    const api = read('server/utils/googleBooksApi.ts')
    expect(api).toContain('googleBooksRateLimited')
    expect(api).toContain('res.status === 429')
    expect(api).toMatch(/if \(googleBooksRateLimited\(\)\) return \[\]/)
  })

  test('the library backfill runs outside component scope so navigation cannot kill it', () => {
    const composable = read('composables/useMetadataBackfill.js')
    expect(composable).toContain('useLibraryBackfill')
    expect(composable).toContain('startLibraryBackfill')

    const page = read('components/mobile/SettingsStorageMobile.vue')
    // The page observes shared state; it must not own the loop or its flags.
    expect(page).toContain('useLibraryBackfill()')
    expect(page).not.toContain('let _stopRequested = false')
    expect(page).not.toMatch(/backfill\.running = true/)
  })
})

// The publisher-site crawl measured as the bulk of a 35s on-device lookup and
// almost never matched without a publisher name to aim at. At ~300 books that
// alone turned a library backfill into a multi-hour job.
describe('publisher crawling is not performed blind', () => {
  test('bulk sweeps skip the blind crawl; interactive fetches keep it', () => {
    const source = read('composables/useDeviceMetadataSearch.js')
    expect(source).toContain('options.light === true')
    expect(source).toContain('!publisherSources.length && (publisherCandidates.length || !light)')

    // Every background caller opts into light mode; the Add/Edit screens do
    // not, so a user watching a spinner still gets the richest result.
    expect(read('composables/useMetadataBackfill.js')).toContain('{ light: true }')
    expect(read('composables/useDeviceLibrarySync.js')).toContain('{ light: true }')
    for (const page of ['components/mobile/EditBookMobile.vue', 'components/mobile/AddBookMobile.vue']) {
      expect(read(page), page).not.toContain('light: true')
    }
  })
})

// Google Books' keyless quota is shared across every anonymous caller and is
// measured PER DAY. Observed exhausted in the wild:
// "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'".
// A short cooldown just walks back into the same wall on every later lookup.
describe('Google Books quota handling', () => {
  test('a per-day quota backs off for hours, a per-minute one for seconds', async () => {
    const { googleBooksCooldownFor } = await import('../server/utils/googleBooksApi.ts')
    const perDay = googleBooksCooldownFor("Quota exceeded for quota metric 'Queries' and limit 'Queries per day'")
    const perMinute = googleBooksCooldownFor("Quota exceeded for quota metric 'Queries' and limit 'Queries per minute'")
    expect(perDay).toBeGreaterThanOrEqual(60 * 60 * 1000)
    expect(perMinute).toBeLessThanOrEqual(5 * 60 * 1000)
    expect(perDay).toBeGreaterThan(perMinute)
  })

  test('lookups stop early instead of burning every query variant', () => {
    const api = read('server/utils/googleBooksApi.ts')
    expect(api).toContain('if (results.length >= ENOUGH_RESULTS) break')
    // process does not exist in the WebView; reading env unguarded would throw
    // on import and take the whole on-device metadata pipeline with it.
    expect(api).toContain("typeof process === 'undefined'")
  })
})

// The native app has no server to keep a key behind, so the Books key is baked
// into the bundle at build time. Without it the phone falls back to the shared
// anonymous Google project, whose daily quota is routinely already spent.
describe('on-device Google Books key', () => {
  test('the key is exposed through public runtime config', () => {
    const config = read('nuxt.config.ts')
    expect(config).toContain('googleBooksApiKey')
    // Read from the environment, never hardcoded into the repo.
    expect(config).toMatch(/googleBooksApiKey:\s*process\.env\./)
  })

  test('the device pipeline injects the key into the provider module', () => {
    const device = read('composables/useDeviceMetadataSearch.js')
    expect(device).toContain('setGoogleBooksApiKey')
    expect(device).toContain('applyGoogleBooksKey()')

    const api = read('server/utils/googleBooksApi.ts')
    // An injected key must win, since `process` does not exist in the WebView.
    expect(api).toContain('export function setGoogleBooksApiKey')
    expect(api).toContain('if (injectedGoogleBooksKey) return injectedGoogleBooksKey')
    // And the process read must stay guarded or the module throws on import.
    expect(api).toContain("typeof process === 'undefined'")
  })
})

// Google Books fails a large share of single requests with 503, in bursts,
// behind every front door — measured across params, connections, DNS answers
// and edge IPs. Treating one failed request as a verdict silently dropped the
// provider from the merge.
describe('Google Books survives its own backend flakiness', () => {
  test('retries alternate front doors and straddle burst windows', () => {
    const api = read('server/utils/googleBooksApi.ts')
    expect(api).toContain('res.status >= 500')
    // The two hosts fail only partially in sync (5 of 14 simultaneous pairs
    // split), so alternating them decorrelates attempts.
    expect(api).toContain("BOOKS_HOSTS = ['www.googleapis.com', 'books.googleapis.com']")
    expect(api).toContain('BOOKS_HOSTS[attempt % BOOKS_HOSTS.length]')
    // Early retries quick, later ones spaced — an unlucky start still escapes
    // a multi-second 503 burst.
    expect(api).toContain('RETRY_DELAYS_MS = [250, 250, 500, 750, 1250, 2000, 3000]')
    // Bounded: a real outage degrades to "no contribution", never a hang.
    expect(api).toContain('REQUEST_BUDGET_MS')
    expect(api).toContain('LOOKUP_BUDGET_MS')
    expect(api).toContain('await googleBooksRequest(')
    // A 429 is a quota verdict, not a blip — it must NOT be retried here.
    expect(api).toContain('res.status === 429')
  })

  test('successes are cached so a title only has to win once', () => {
    const api = read('server/utils/googleBooksApi.ts')
    expect(api).toContain('readBooksCache')
    expect(api).toContain('writeBooksCache')
    // Only 200s are stored — a 503 must never be remembered as an answer.
    expect(api).toMatch(/if \(!res\.ok\) continue;\s*\n\s*data = await res\.json\(\);\s*\n\s*writeBooksCache/)
  })

  test('the connection test exercises the same engine, not a one-shot probe', () => {
    const checks = read('composables/useConnectionChecks.js')
    expect(checks).toContain('googleBooksRequest')
  })
})
