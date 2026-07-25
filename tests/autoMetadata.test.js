import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  metadataResultMatchesBook,
  pickAutoTargets,
} from '../composables/useAutoMetadata.js'
import {
  applyMetadataResult,
  bookNeedsMetadata,
  missingMetadataFields,
  needsSeriesLookup,
} from '../composables/useMetadataBackfill.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('missing-details detection', () => {
  const complete = {
    title: 'A Book', author: 'An Author', blurb: 'words', genre: 'Fiction',
    publishYear: 2020, cover: 'https://x/cover.jpg', webReview: { rating: 4.2 },
    // A standalone whose series has already been determined — otherwise the
    // unknown series name is itself a gap.
    seriesChecked: true,
  }

  test('a fully populated standalone book has no gaps', () => {
    expect(missingMetadataFields(complete)).toEqual([])
    expect(bookNeedsMetadata(complete)).toBe(false)
  })

  test('every scalar gap is reported', () => {
    expect(missingMetadataFields({ ...complete, author: '' })).toContain('author')
    expect(missingMetadataFields({ ...complete, blurb: '' })).toContain('blurb')
    expect(missingMetadataFields({ ...complete, genre: '' })).toContain('genre')
    expect(missingMetadataFields({ ...complete, publishYear: 0 })).toContain('publishYear')
  })

  test('an svg placeholder counts as a missing cover', () => {
    expect(missingMetadataFields({ ...complete, cover: 'data:image/svg+xml,abc' })).toContain('cover')
  })

  test('a missing Goodreads rating is a gap', () => {
    expect(missingMetadataFields({ ...complete, webReview: null })).toContain('goodreadsRating')
    expect(missingMetadataFields({ ...complete, webReview: { rating: 0 } })).toContain('goodreadsRating')
  })

  test('an unknown series name is itself a gap, until it has been checked', () => {
    // This is the fix for series never being auto-filled: a book with no series
    // set is looked up, not left for the reader to fill by hand.
    const unknown = { ...complete, series: '', seriesChecked: false }
    expect(missingMetadataFields(unknown)).toContain('series')
    expect(needsSeriesLookup(unknown)).toBe(true)

    // Once checked and found standalone, the series stops being a gap.
    const checked = { ...complete, series: '', seriesChecked: true }
    expect(missingMetadataFields(checked)).not.toContain('series')
    expect(needsSeriesLookup(checked)).toBe(false)
  })

  test('installment and total become gaps once the series name is known', () => {
    const seriesBook = { ...complete, series: 'The Saga' }
    const gaps = missingMetadataFields(seriesBook)
    expect(gaps).not.toContain('series')
    expect(gaps).toContain('seriesInstallment')
    expect(gaps).toContain('seriesTotal')

    const filled = { ...seriesBook, seriesInstallment: 2, seriesTotal: 5 }
    expect(missingMetadataFields(filled)).toEqual([])
  })

  test('applying a result that finds no series marks the standalone as checked', () => {
    const book = { ...complete, series: '', seriesChecked: false }
    const { record, filled } = applyMetadataResult(book, { title: 'A Book' }, { didLookup: true })
    expect(record.seriesChecked).toBe(true)
    expect(filled).toBe(false)
    // ...and a lookup that returned nothing at all does NOT conclude standalone.
    expect(applyMetadataResult(book, null, { didLookup: false }).record).toBeNull()
  })

  test('applying a result that finds a series fills it and does not mark checked', () => {
    const book = { ...complete, series: '', seriesChecked: false }
    const { record, filled } = applyMetadataResult(
      book, { title: 'A Book', series: 'The Saga', seriesInstallment: 1 }, { didLookup: true },
    )
    expect(record.series).toBe('The Saga')
    expect(record.seriesInstallment).toBe(1)
    // A series was found, so it is not marked "checked, standalone".
    expect(record.seriesChecked).not.toBe(true)
    expect(filled).toBe(true)
  })
})

describe('result verification (guards against false data)', () => {
  test('an exact title/author match is accepted', () => {
    expect(metadataResultMatchesBook(
      { title: 'Red Rising', author: 'Pierce Brown' },
      { title: 'Red Rising', author: 'Pierce Brown' },
    )).toBe(true)
  })

  test('a subtitle or series suffix still matches', () => {
    expect(metadataResultMatchesBook(
      { title: 'Red Rising', author: 'Pierce Brown' },
      { title: 'Red Rising (Red Rising Saga #1)', author: 'Pierce Brown' },
    )).toBe(true)
  })

  test('a different book is rejected', () => {
    expect(metadataResultMatchesBook(
      { title: 'Red Rising', author: 'Pierce Brown' },
      { title: 'Golden Son', author: 'Pierce Brown' },
    )).toBe(false)
  })

  test('a title match with a conflicting author is rejected', () => {
    expect(metadataResultMatchesBook(
      { title: 'The Hobbit', author: 'J.R.R. Tolkien' },
      { title: 'The Hobbit', author: 'Some Other Person' },
    )).toBe(false)
  })

  test('a book missing its own author accepts a matching-title result', () => {
    // This is exactly the gap the fill is here to close.
    expect(metadataResultMatchesBook(
      { title: 'The Hobbit', author: '' },
      { title: 'The Hobbit', author: 'J.R.R. Tolkien' },
    )).toBe(true)
  })

  test('an empty or absent result never matches', () => {
    expect(metadataResultMatchesBook({ title: 'X' }, null)).toBe(false)
    expect(metadataResultMatchesBook({ title: 'X' }, { title: '' })).toBe(false)
  })
})

describe('auto-target selection', () => {
  const now = 1_000_000_000_000

  test('only books with gaps are picked', () => {
    const books = [
      { id: 'a', title: 'Gap', author: '' },
      { id: 'b', title: 'Full', author: 'Auth', blurb: 'b', genre: 'g', publishYear: 2000, cover: 'http://c', webReview: { rating: 4 }, seriesChecked: true },
    ]
    expect(pickAutoTargets(books, { now }).map((b) => b.id)).toEqual(['a'])
  })

  test('a book checked recently is skipped until its cooldown lapses', () => {
    const books = [
      { id: 'a', title: 'Gap', author: '', metaCheckedAt: now - 1000 },
    ]
    expect(pickAutoTargets(books, { now, cooldownMs: 10_000 })).toHaveLength(0)
    expect(pickAutoTargets(books, { now: now + 20_000, cooldownMs: 10_000 })).toHaveLength(1)
  })

  test('the batch is capped so a cycle never hammers the sources', () => {
    const books = Array.from({ length: 10 }, (_, i) => ({ id: String(i), title: `T${i}`, author: '' }))
    expect(pickAutoTargets(books, { now, limit: 3 })).toHaveLength(3)
  })
})

describe('wiring', () => {
  test('the background loop is started by a client plugin, gated on the setting', () => {
    const plugin = read('plugins/auto-metadata.client.js')
    expect(plugin).toContain('startAutoMetadata')
    expect(plugin).toContain('metadataAutoFill')
    // The loop starts once and re-reads the setting every cycle, so toggling
    // it takes effect without an app restart AND without stopping the series
    // sweep that now shares the same scheduler.
    expect(plugin).toContain('isFillEnabled')
  })

  test('the runner cross-checks sources and never fights the manual sweep', () => {
    const auto = read('composables/useAutoMetadata.js')
    // Uses the multi-source engine (Google Books, Open Library, Internet
    // Archive, Goodreads) rather than a single provider.
    expect(auto).toContain('fetchBookMetadataResults')
    expect(auto).toContain('metadataResultMatchesBook')
    expect(auto).toContain('isBackfillRunning')
    // Rests between cycles — for as long as the backlog and the sources warrant.
    expect(auto).toContain('nextCooldownMs')
  })

  test('Settings → Storage exposes the automatic toggle', () => {
    const storage = read('components/mobile/SettingsStorageMobile.vue')
    expect(storage).toContain('setAutoMetadata')
    expect(storage).toContain('metadataAutoFill')
  })
})
