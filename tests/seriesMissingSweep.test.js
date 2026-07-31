import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  bestResultForInstallment,
  bestResultForOwnedBook,
  installmentMatchesBook,
  reconcileEffectiveTotal,
  rosterCoverage,
} from '../composables/useSeriesSuggestions.js'

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

describe('the fill picks the real match, not just the first result', () => {
  // This is the bug the reader hit: the top hit was a box set / wrong edition,
  // so results[0] failed the guard and the slot stayed blank forever — even
  // though the correct book was sitting right behind it.
  const entry = { title: 'Neon Prey', author: 'John Sandford' }
  const results = [
    { title: 'The Prey Series Box Set', author: 'John Sandford', cover: 'box.jpg', publishYear: 2020 },
    { title: 'Neon Prey', author: 'John Sandford', cover: 'neon.jpg', publishYear: 2019 },
  ]

  test('an installment fill skips the non-matching first result', () => {
    expect(installmentMatchesBook(entry, results[0])).toBe(false)
    expect(bestResultForInstallment(entry, results)).toBe(results[1])
  })

  test('an owned-book match skips the non-matching first result', () => {
    expect(bestResultForOwnedBook(entry, results)).toBe(results[1])
  })

  test('no real match means nothing is filled (never a wrong book)', () => {
    expect(bestResultForInstallment(entry, [results[0]])).toBeNull()
    expect(bestResultForInstallment(entry, [])).toBeNull()
    expect(bestResultForOwnedBook(entry, undefined)).toBeNull()
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

describe('the series total is reconciled against roster evidence', () => {
  test('a contiguous roster is authoritative', () => {
    expect(reconcileEffectiveTotal({ contiguous: true, rosterMax: 28, claimedTotal: 30 })).toBe(28)
  })

  test('a small overcount above the roster max is trimmed (Prey: works=37, last book #36)', () => {
    // The real Lucas Davenport bug: one owned book carried seriesTotal 37, but
    // the roster's highest real book is Revenge Prey #36, so slot 37 is a
    // phantom from the "works" count and must be dropped.
    expect(reconcileEffectiveTotal({ contiguous: false, rosterMax: 36, claimedTotal: 37 })).toBe(36)
  })

  test('a large gap keeps the claimed total so a missed page never hides real books', () => {
    // Roster only reached book 30 (a later page failed) but the series really
    // has 37 — do NOT trim to 30, or books 31-37 vanish.
    expect(reconcileEffectiveTotal({ contiguous: false, rosterMax: 30, claimedTotal: 37 })).toBe(37)
  })

  test('a roster larger than the stored total wins', () => {
    expect(reconcileEffectiveTotal({ contiguous: false, rosterMax: 40, claimedTotal: 34 })).toBe(40)
  })

  test('no claimed total falls back to the roster', () => {
    expect(reconcileEffectiveTotal({ contiguous: false, rosterMax: 12, claimedTotal: 0 })).toBe(12)
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
    // Fills only the four gap fields, guarded by the match check — and scans
    // every returned result for the real match, not just results[0].
    expect(suggestions).toContain('bestResultForInstallment(entry, results)')
    expect(suggestions).toContain('installmentMatchesBook(entry, result)')
    expect(suggestions).toContain('installmentNeedsDetails(entry)')
    // The blind first-result grab that left slots blank is gone everywhere.
    expect(suggestions).not.toContain('results?.[0]')
    // Publishes each fill as it goes so the cards update mid-sweep.
    expect(suggestions).toMatch(/onProgress\?\.\(\{ done, total, filled, unresolved, current/)
  })

  test('the AI ordering fallback only ever PROPOSES — providers verify before storage', () => {
    // The model names books the Goodreads roster could not; nothing it says is
    // stored until the real providers confirm it.
    expect(suggestions).toContain('export const resolveGapsWithAi')
    expect(suggestions).toContain('fetchBookMetadataResults(proposal.title, author')
    // The model's NUMBERING is discarded — measured to be unreliable. The
    // provider states where the book belongs, and only gaps get filled.
    expect(suggestions).toContain('export const confirmPlacement')
    expect(suggestions).toContain('confirmPlacement(results, { title: proposal.title, author, seriesName })')
    expect(suggestions).toMatch(/const \{ result: match, installment \} = placement/)
    expect(suggestions).toMatch(/if \(!wanted\.has\(installment\)/)
    expect(suggestions).toMatch(/seriesMatches\(result\?\.series, seriesName\)/)
    // Cover/author/year come from the verified provider result, not the model.
    expect(suggestions).toMatch(/cover: match\.cover/)
    // Two independent safety gates: a known author, and enough roster anchors.
    expect(suggestions).toContain('MIN_AI_ANCHORS')
    expect(suggestions).toMatch(/if \(!author\) return \{\}/)
    // A model that contradicts confirmed books is refused outright.
    expect(suggestions).toMatch(/if \(!anchored \|\| !books\?\.length\) return \{\}/)
  })

  test('the AI fallback runs both on demand and in the background, but is rate-limited', () => {
    // The visible sweep uses it for installments the roster never named.
    expect(suggestions).toMatch(/const rosterGaps = missing\.filter/)
    // The unattended sweep does too, so pages are complete before being opened.
    expect(suggestions).toContain('fillRosterGapsWithAi')
    // ...but at most once a day per series, because each call is billable.
    expect(suggestions).toContain('AI_RETRY_AFTER_MS')
    expect(suggestions).toContain('aiAttemptedRecently')
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
    expect(page).toContain('still need details')
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
    // Corrects when the roster is authoritative (contiguous) OR when it trimmed
    // the stored total DOWN — never silently raises off a gappy roster.
    expect(page).toMatch(/effectiveTotal > 0 && effectiveTotal !== derivedSeriesTotal\.value/)
    expect(page).toMatch(/coverage\.contiguous \|\| effectiveTotal < derivedSeriesTotal\.value/)
    // Owned installments are handed to the composable so it can rebuild the list.
    expect(page).toContain('ownedInstallments')
  })
})
