import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { groupBooksBySeries, normalizeLibrarySeriesName } from '../composables/useBooks.js'
import { DEFAULT_BOOKISH_SETTINGS, normalizeBookishSettings } from '../composables/useBookishSettings.js'

describe('library series grouping', () => {
  test('normalizes manually entered series names into one group', () => {
    const groups = groupBooksBySeries([
      { id: '1', title: 'First', author: 'Author', series: 'Grant County' },
      { id: '2', title: 'Second', author: 'Author', series: ' grant   county ' },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      id: 'Grant%20County',
      name: 'Grant County',
    })
    expect(groups[0].books.map((book) => book.id)).toEqual(['1', '2'])
  })

  test('normalizes punctuation and casing for matching but keeps the first display name', () => {
    expect(normalizeLibrarySeriesName('The Wheel-of Time')).toBe('the wheel of time')
    expect(normalizeLibrarySeriesName('  the   wheel of time  ')).toBe('the wheel of time')
  })

  test('promotes the highest known total onto the series group', () => {
    const groups = groupBooksBySeries([
      { id: '1', title: 'First', author: 'Author', series: 'Grant County' },
      { id: '2', title: 'Second', author: 'Author', series: ' grant county ', seriesTotal: 4 },
    ])

    expect(groups[0].seriesTotal).toBe(4)
  })
})

// Series suggestions (Settings → Preferences): the series detail page shows the
// installments the library is missing as muted cards, in reading order.
describe('series suggestion placeholders', () => {
  const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8')

  test('the preference is defined and defaults to off', () => {
    expect(DEFAULT_BOOKISH_SETTINGS.seriesSuggestions).toBe(false)
    expect(normalizeBookishSettings({}).seriesSuggestions).toBe(false)
    expect(normalizeBookishSettings({ seriesSuggestions: true }).seriesSuggestions).toBe(true)
    // Anything other than a real `true` stays off.
    expect(normalizeBookishSettings({ seriesSuggestions: 'yes' }).seriesSuggestions).toBe(false)
  })

  test('the series detail page renders placeholders in installment order', () => {
    const source = read('components/mobile/SeriesDetailMobile.vue')
    expect(source).toContain('seriesSuggestions')
    expect(source).toContain('missingInstallments')
    // Owned books and placeholders come from one ordered list, so a missing
    // book sits between the installments either side of it.
    expect(source).toContain('seriesEntries')
    expect(source).toContain('missing-book-card')
    // Placeholders only in the unfiltered view: they have no status or format.
    expect(source).toMatch(/selectedStatus\.value === 'all'/)
  })
})
