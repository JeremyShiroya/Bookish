import { describe, expect, it } from 'vitest'
import { buildAuthorCollectionStats, groupAuthorWorks } from './useAuthorDetails.js'

describe('groupAuthorWorks', () => {
  it('separates standalone books from complete author series groups', () => {
    const works = groupAuthorWorks([
      { id: 1, title: 'Standalone', series: '' },
      { id: 2, title: 'Second', series: 'Grant County', seriesInstallment: 2 },
      { id: 3, title: 'First', series: 'Grant County', seriesInstallment: 1 },
      { id: 4, title: 'Other', series: 'Will Trent', seriesInstallment: 1 },
    ])

    expect(works.standaloneBooks.map(book => book.id)).toEqual([1])
    expect(works.seriesGroups).toHaveLength(2)
    expect(works.seriesGroups[0].name).toBe('Grant County')
    expect(works.seriesGroups[0].books.map(book => book.id)).toEqual([3, 2])
  })

  it('builds explicit owned and total book and series statistics', () => {
    expect(buildAuthorCollectionStats({
      ownedBooks: 4,
      totalBooks: 18,
      ownedSeries: 2,
      totalSeries: null,
    })).toEqual({
      books: { owned: 4, total: 18, totalLabel: '18' },
      series: { owned: 2, total: null, totalLabel: '?' },
    })
  })

  it('never reports an external total below the owned collection', () => {
    expect(buildAuthorCollectionStats({
      ownedBooks: 4,
      totalBooks: 2,
      ownedSeries: 2,
      totalSeries: 0,
    })).toEqual({
      books: { owned: 4, total: 4, totalLabel: '4' },
      series: { owned: 2, total: 2, totalLabel: '2' },
    })
  })
})
