import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  metadataResultMatchesBook,
  pickAutoTargets,
} from '../composables/useAutoMetadata.js'
import {
  bookNeedsMetadata,
  missingMetadataFields,
} from '../composables/useMetadataBackfill.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

describe('missing-details detection', () => {
  const complete = {
    title: 'A Book', author: 'An Author', blurb: 'words', genre: 'Fiction',
    publishYear: 2020, cover: 'https://x/cover.jpg', webReview: { rating: 4.2 },
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

  test('series details are only gaps once the book is in a series', () => {
    const standalone = { ...complete, series: '' }
    expect(missingMetadataFields(standalone)).not.toContain('seriesInstallment')

    const seriesBook = { ...complete, series: 'The Saga' }
    const gaps = missingMetadataFields(seriesBook)
    expect(gaps).toContain('seriesInstallment')
    expect(gaps).toContain('seriesTotal')

    const filled = { ...seriesBook, seriesInstallment: 2, seriesTotal: 5 }
    expect(missingMetadataFields(filled)).toEqual([])
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
      { id: 'b', title: 'Full', author: 'Auth', blurb: 'b', genre: 'g', publishYear: 2000, cover: 'http://c', webReview: { rating: 4 } },
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
    // Reacts to the toggle without an app restart.
    expect(plugin).toContain('watch(() => settings.value.metadataAutoFill')
  })

  test('the runner cross-checks sources and never fights the manual sweep', () => {
    const auto = read('composables/useAutoMetadata.js')
    // Uses the multi-source engine (Google Books, Open Library, Internet
    // Archive, Goodreads) rather than a single provider.
    expect(auto).toContain('fetchBookMetadataResults')
    expect(auto).toContain('metadataResultMatchesBook')
    expect(auto).toContain('isBackfillRunning')
    // Rests between cycles.
    expect(auto).toMatch(/CYCLE_COOLDOWN_MS/)
  })

  test('Settings → Storage exposes the automatic toggle', () => {
    const storage = read('components/mobile/SettingsStorageMobile.vue')
    expect(storage).toContain('setAutoMetadata')
    expect(storage).toContain('metadataAutoFill')
  })
})
