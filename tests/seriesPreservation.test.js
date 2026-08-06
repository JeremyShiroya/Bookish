import { describe, it, expect, vi } from 'vitest'
import { buildMetadataResults } from '../server/utils/metadataAggregator'
import { applyMetadataResult, unmarkFalseStandalones } from '../composables/useMetadataBackfill'

describe('Series Metadata Preservation & Standalone Protection', () => {
  it('buildMetadataResults preserves series from candidate sources when primary lacks series', () => {
    const googleBooksSources = [
      { id: 'gb:1', source: 'googleBooks', title: 'Fourth Wing', author: 'Rebecca Yarros', series: null },
    ]
    const hardcoverSources = [
      { id: 'hc:1', source: 'hardcover', title: 'Fourth Wing', author: 'Rebecca Yarros', series: 'The Empyrean', seriesInstallment: '1', seriesTotal: '3' },
    ]

    const results = buildMetadataResults('Fourth Wing', 'Rebecca Yarros', {
      goodreadsSources: [],
      googleBooksSources,
      internetArchiveSources: [],
      openLibrarySources: [],
      koboSources: [],
      publisherSources: [],
      hardcoverSources,
      wikidataSources: [],
      openAlexSources: [],
      libraryOfCongressSources: [],
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].series).toBe('The Empyrean')
    expect(results[0].seriesInstallment).toBe('1')
  })

  it('applyMetadataResult does not mark seriesChecked = true during light background passes', () => {
    const book = { id: 'b1', title: 'Genesis', author: 'Karin Slaughter', series: null, seriesChecked: false }
    const meta = { title: 'Genesis', author: 'Karin Slaughter', blurb: 'A thriller', series: null }

    const { record } = applyMetadataResult(book, meta, { didLookup: true, isLightPass: true })
    expect(record.seriesChecked).not.toBe(true)
  })

  it('unmarkFalseStandalones clears seriesChecked on books without a series name', async () => {
    const books = [
      { id: 'b1', title: 'Genesis', series: null, seriesChecked: true },
      { id: 'b2', title: 'Real Standalone', series: null, seriesChecked: true },
      { id: 'b3', title: 'Harry Hole #1', series: 'Harry Hole', seriesChecked: true },
    ]

    const updated = []
    const updateBook = vi.fn().mockImplementation(async (b) => updated.push(b))

    await unmarkFalseStandalones(books, updateBook)

    expect(updated).toHaveLength(2)
    expect(updated[0].id).toBe('b1')
    expect(updated[0].seriesChecked).toBe(false)
  })

  it('realignEntireLibrarySeries handles books without series gracefully', async () => {
    const { realignEntireLibrarySeries } = await import('../composables/useSeriesSuggestions')
    const books = [
      { id: 'b1', title: 'Faithless', author: 'Karin Slaughter', series: null },
    ]
    const updateBook = vi.fn().mockImplementation(async (b) => b)

    const result = await realignEntireLibrarySeries({ books, seriesList: [], updateBook })
    expect(result).toHaveProperty('updated')
  })
})
