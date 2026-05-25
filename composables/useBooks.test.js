import { describe, it, expect } from 'vitest'
import { resolveLibraryDataResult, useBooks } from '~/composables/useBooks'

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
})
