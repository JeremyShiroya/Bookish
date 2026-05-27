import { describe, it, expect } from 'vitest'
import { resolveLibraryDataResult, useBooks } from '~/composables/useBooks'
import { getGoodreadsRating } from '~/composables/useGoodreadsRating'

describe('useBooks', () => {
  it('should be resolvable', () => {
    expect(useBooks).toBeDefined()
  })

  it('preserves existing library data when a fetch result fails', () => {
    const existingBooks = [{ id: 1, title: 'Existing Book' }]
    const result = resolveLibraryDataResult(
      { status: 'rejected', reason: new Error('database unavailable') },
      existingBooks
    )

    expect(result).toBe(existingBooks)
  })

  it('uses fresh library data when a fetch result succeeds', () => {
    const freshBooks = [{ id: 2, title: 'Fresh Book' }]
    const result = resolveLibraryDataResult(
      { status: 'fulfilled', value: freshBooks },
      []
    )

    expect(result).toBe(freshBooks)
  })

  it('parses Goodreads ratings from saved web reviews', () => {
    expect(getGoodreadsRating({ webReview: 'Goodreads Rating: 4.28/5 (based on 1,511,111 reviews).' })).toBe(4.28)
    expect(getGoodreadsRating({ webReview: 'Rating: 3.91/5' })).toBe(3.91)
    expect(getGoodreadsRating({ webReview: '' })).toBe(0)
  })
})
