import { describe, expect, test } from 'vitest'
import { groupBooksBySeries, normalizeLibrarySeriesName } from '../composables/useBooks.js'

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
})
