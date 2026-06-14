import { describe, expect, it } from 'vitest'
import {
  chunkIndexForSection,
  visiblePageFromRects,
  pdfProgressForPage,
  sectionForChunkIndex,
} from './useReaderPosition.js'

describe('reader position mapping', () => {
  it('maps a one-based PDF page to the first chunk in that page section', () => {
    expect(chunkIndexForSection([2, 3, 1, 4], 3)).toBe(5)
  })

  it('moves to the next readable section when the requested section is empty', () => {
    expect(chunkIndexForSection([2, 0, 0, 3], 2)).toBe(2)
    expect(chunkIndexForSection([2, 3, 0], 3)).toBe(4)
  })

  it('maps a chunk index back to its one-based section', () => {
    expect(sectionForChunkIndex([2, 3, 1], 0)).toBe(1)
    expect(sectionForChunkIndex([2, 3, 1], 4)).toBe(2)
    expect(sectionForChunkIndex([2, 3, 1], 5)).toBe(3)
  })

  it('calculates progress from the selected PDF page even when moving backward', () => {
    expect(pdfProgressForPage(74, 110)).toEqual({
      progress: 67,
      status: 'Reading',
    })
    expect(pdfProgressForPage(1, 110)).toEqual({
      progress: 0,
      status: 'Unread',
    })
  })

  it('chooses the page nearest the reader toolbar anchor at click time', () => {
    expect(visiblePageFromRects([
      { page: 73, top: -700, bottom: 20 },
      { page: 74, top: 64, bottom: 864 },
      { page: 75, top: 900, bottom: 1700 },
    ], 56)).toBe(74)
  })
})
