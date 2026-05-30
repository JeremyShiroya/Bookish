import { describe, it, expect } from 'vitest'
import { useBooks } from '~/composables/useBooks'
import { getGoodreadsRating } from '~/composables/useGoodreadsRating'

describe('useBooks', () => {
  it('should be resolvable', () => {
    expect(useBooks).toBeDefined()
  })

  it('parses Goodreads ratings from saved web reviews', () => {
    expect(getGoodreadsRating({ webReview: 'Goodreads Rating: 4.28/5 (based on 1,511,111 reviews).' })).toBe(4.28)
    expect(getGoodreadsRating({ webReview: 'Rating: 3.91/5' })).toBe(3.91)
    expect(getGoodreadsRating({ webReview: '' })).toBe(0)
  })
})
