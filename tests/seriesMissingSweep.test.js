import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { installmentMatchesBook, rosterCoverage } from '../composables/useSeriesSuggestions.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('matching a missing installment to an owned book', () => {
  test('same title and author is a match', () => {
    expect(installmentMatchesBook(
      { title: 'Neon Prey', author: 'John Sandford' },
      { title: 'Neon Prey', author: 'John Sandford' },
    )).toBe(true)
  })

  test('a subtitle or series suffix still matches', () => {
    expect(installmentMatchesBook(
      { title: 'Neon Prey', author: 'John Sandford' },
      { title: 'Neon Prey (A Prey Novel #29)', author: 'John Sandford' },
    )).toBe(true)
  })

  test('a different book is not a match', () => {
    expect(installmentMatchesBook(
      { title: 'Neon Prey', author: 'John Sandford' },
      { title: 'Masked Prey', author: 'John Sandford' },
    )).toBe(false)
  })

  test('a conflicting author is rejected', () => {
    expect(installmentMatchesBook(
      { title: 'Neon Prey', author: 'John Sandford' },
      { title: 'Neon Prey', author: 'Someone Else' },
    )).toBe(false)
  })

  test('an untitled entry or book never matches', () => {
    expect(installmentMatchesBook({ title: '' }, { title: 'X' })).toBe(false)
    expect(installmentMatchesBook({ title: 'X' }, { title: '' })).toBe(false)
  })
})

describe('roster coverage decides the real series length', () => {
  test('a contiguous roster is authoritative — its max is the total', () => {
    // Wesley Peterson: roster 1-28, metadata "works" count claims 30. The two
    // phantom cards vanish because the contiguous roster wins.
    const installments = Object.fromEntries(
      Array.from({ length: 28 }, (_, i) => [i + 1, { title: `Book ${i + 1}` }]),
    )
    expect(rosterCoverage(installments)).toEqual({ max: 28, contiguous: true })
  })

  test('a roster with an internal gap is not authoritative', () => {
    // Lucas Davenport before pagination: 1-30 then 36 — a page is missing, so
    // the metadata total is kept rather than hiding real books.
    const installments = { 1: {}, 2: {}, 30: {}, 36: {} }
    const coverage = rosterCoverage(installments)
    expect(coverage.max).toBe(36)
    expect(coverage.contiguous).toBe(false)
  })

  test('an empty roster covers nothing', () => {
    expect(rosterCoverage({})).toEqual({ max: 0, contiguous: false })
  })
})

describe('the roster scraper walks every page', () => {
  const scraper = read('server/utils/goodreadsScraper.ts')

  test('it paginates instead of reading only the first 30 books', () => {
    // Goodreads lists ~30 per page; a long series stopped at 30 without this.
    expect(scraper).toContain('page=')
    expect(scraper).toContain('MAX_SERIES_PAGES')
    expect(scraper).toContain('scrapeGoodreadsSeriesPage')
    // Stops when a page comes back short or adds nothing new.
    expect(scraper).toMatch(/books\.length < SERIES_PAGE_SIZE/)
  })
})

describe('the two-phase sweep is wired correctly', () => {
  const suggestions = read('composables/useSeriesSuggestions.js')

  test('phase 1 force-refreshes the roster, reconciles the total, fills blanks', () => {
    expect(suggestions).toContain('export const fillMissingInstallmentDetails')
    // The stale first-page cache is bypassed so the rest of the roster loads.
    expect(suggestions).toContain('{ forceRefresh: true }')
    // The contiguous roster is authoritative for the series length.
    expect(suggestions).toContain('coverage.contiguous')
    // Fills only the four gap fields, guarded by the match check.
    expect(suggestions).toContain('installmentMatchesBook(entry, top)')
    expect(suggestions).toContain('installmentNeedsDetails(entry)')
    // Publishes each fill as it goes so the cards update mid-sweep.
    expect(suggestions).toMatch(/onProgress\?\.\(\{ done, total, filled, current/)
  })

  test('phase 2 links owned-but-untagged books and never overwrites the right one', () => {
    expect(suggestions).toContain('export const reconcileSeriesWithLibrary')
    // Sets series + installment on the matched book.
    expect(suggestions).toContain('series: seriesName')
    expect(suggestions).toContain('seriesInstallment: Number(match.seriesInstallment) || installment')
    // Skips a book already correctly placed at this installment.
    expect(suggestions).toContain('Number(book.seriesInstallment) === installment')
    // And still fills that book's own metadata in the background.
    expect(suggestions).toContain('mergeMetadataIntoBook(record, top)')
  })
})

describe('the series detail page exposes the missing-book actions', () => {
  const page = read('components/mobile/SeriesDetailMobile.vue')

  test('an overflow menu like the playlist detail carries both actions', () => {
    expect(page).toContain('#actions')
    expect(page).toContain('Series options')
    expect(page).toContain('Search for missing books')
    expect(page).toMatch(/Show missing books|Hide missing books/)
  })

  test('hiding the missing books is a per-page override on top of the setting', () => {
    expect(page).toContain('hideMissing')
    expect(page).toMatch(/suggestionsEnabled = computed\(\(\) => \([\s\S]*?!hideMissing\.value/)
  })

  test('the first pass is shown in a modal, the reconcile runs in the background', () => {
    expect(page).toContain('sweep-overlay')
    expect(page).toContain('fillMissingInstallmentDetails')
    expect(page).toContain('reconcileSeriesWithLibrary')
    // The reconcile is not awaited — the modal's Done is about the visible pass.
    expect(page).toMatch(/reconcileSeriesWithLibrary\(\{[\s\S]*?\}\)\s*\n\s*\.then/)
  })

  test('the sweep still runs against the real missing list while gaps are hidden', () => {
    // allMissingInstallments is independent of the show/hide toggle.
    expect(page).toContain('allMissingInstallments')
    expect(page).toMatch(/const missing = allMissingInstallments\.value/)
  })

  test('a corrected total is written back so phantom cards disappear', () => {
    expect(page).toContain('propagateSeriesTotal')
    // Only when the roster is authoritative and disagrees with what is stored.
    expect(page).toMatch(/coverage\.contiguous && effectiveTotal > 0 && effectiveTotal !== derivedSeriesTotal\.value/)
    // Owned installments are handed to the composable so it can rebuild the list.
    expect(page).toContain('ownedInstallments')
  })
})
