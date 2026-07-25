import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { installmentMatchesBook } from '../composables/useSeriesSuggestions.js'

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

describe('the two-phase sweep is wired correctly', () => {
  const suggestions = read('composables/useSeriesSuggestions.js')

  test('phase 1 fills blanks and reports progress', () => {
    expect(suggestions).toContain('export const fillMissingInstallmentDetails')
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
})
