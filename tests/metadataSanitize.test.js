import { describe, expect, test } from 'vitest'
import { parseSeriesFromText } from '../server/utils/goodreadsScraper'
import { sanitizeMetadataResult } from '../server/utils/metadataAggregator'

describe('metadata series sanitation', () => {
  test('parseSeriesFromText rejects bylines and sentence-like junk', () => {
    expect(parseSeriesFromText('By Andy Weir').series).toBeNull()
    expect(parseSeriesFromText('1234').series).toBeNull()
    expect(parseSeriesFromText('a rather long descriptive phrase that is clearly not a series name').series).toBeNull()
  })

  test('parseSeriesFromText still keeps real numbered series', () => {
    const a = parseSeriesFromText('The Expanse #3')
    expect(a.series).toBe('The Expanse')
    expect(a.seriesInstallment).toBe('3')

    const b = parseSeriesFromText('Book 1 of 6 in the Wheel of Time')
    expect(b.series).toBe('Wheel of Time')
    expect(b.seriesInstallment).toBe('1')
    expect(b.seriesTotal).toBe('6')

    // A plain, short series title with letters is allowed.
    expect(parseSeriesFromText('Discworld').series).toBe('Discworld')
  })

  test('sanitizeMetadataResult drops a series that echoes the author', () => {
    expect(sanitizeMetadataResult({ series: 'By Andy Weir', author: 'Andy Weir', seriesInstallment: '1' }))
      .toEqual({ series: null, author: 'Andy Weir', seriesInstallment: null, seriesTotal: null })

    expect(sanitizeMetadataResult({ series: 'Andy Weir', author: 'Andy Weir' }).series).toBeNull()
  })

  test('sanitizeMetadataResult keeps a genuine series', () => {
    const result = sanitizeMetadataResult({ series: 'The Expanse', author: 'James S. A. Corey', seriesInstallment: '3', seriesTotal: '9' })
    expect(result.series).toBe('The Expanse')
    expect(result.seriesInstallment).toBe('3')
    expect(result.seriesTotal).toBe('9')
  })
})
