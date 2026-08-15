import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchHardcoverSeriesRoster } from '../server/utils/hardcoverApi'
import { formatSeriesCollectionProgress, ensureSeriesTotal } from '../composables/useSeriesProgress'
import { reconcileEffectiveTotal, installmentMatchesBook, yearFitsBetweenAnchors } from '../composables/useSeriesSuggestions'

describe('Series Accuracy & Roster Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchHardcoverSeriesRoster parses series GraphQL query into a numbered roster', async () => {
    const mockSeriesResponse = {
      data: {
        series: [
          {
            name: 'Red Rising Saga',
            books_count: 6,
            book_series: [
              { position: 1, book: { title: 'Red Rising', release_date: '2014-01-28', image: { url: 'https://example.com/red.jpg' }, contributions: [{ author: { name: 'Pierce Brown' } }] } },
              { position: 2, book: { title: 'Golden Son', release_date: '2015-01-06', image: { url: 'https://example.com/golden.jpg' }, contributions: [{ author: { name: 'Pierce Brown' } }] } },
              { position: 3, book: { title: 'Morning Star', release_date: '2016-01-26', image: { url: 'https://example.com/morning.jpg' }, contributions: [{ author: { name: 'Pierce Brown' } }] } },
            ],
          },
        ],
      },
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSeriesResponse,
    })

    const roster = await fetchHardcoverSeriesRoster('Red Rising Saga')
    expect(roster.series).toBe('Red Rising Saga')
    expect(roster.total).toBe(6)
    expect(roster.books).toHaveLength(3)
    expect(roster.books[0]).toEqual({
      installment: 1,
      title: 'Red Rising',
      author: 'Pierce Brown',
      cover: 'https://example.com/red.jpg',
      year: 2014,
    })
  })

  it('reconcileEffectiveTotal updates series total from roster max when contiguous', () => {
    const total = reconcileEffectiveTotal({
      contiguous: true,
      rosterMax: 6,
      claimedTotal: 1,
    })
    expect(total).toBe(6)
  })

  it('installmentMatchesBook matches owned book with minor title case / space differences', () => {
    const entry = { title: 'Welcome To Camp Slither', author: 'R.L. Stine' }
    const book = { title: 'Welcome to Camp Slither', author: 'R. L. Stine' }

    expect(installmentMatchesBook(entry, book)).toBe(true)
  })

  it('formatSeriesCollectionProgress formats collection ratio correctly', () => {
    expect(formatSeriesCollectionProgress(1, 6)).toBe('1/6 books collected')
    expect(formatSeriesCollectionProgress(6, 6)).toBe('Complete series')
  })

  it('yearFitsBetweenAnchors enforces chronological consistency against anchor dates', () => {
    const anchors = {
      1: { year: 2018 },
    }
    // Book 2 with year 2004 predates Book 1 (2018), so year fitting strictly rejects it
    const fits = yearFitsBetweenAnchors({ installment: 2, year: 2004, anchors })
    expect(fits).toBe(false)
  })
})
