import { describe, it, expect } from 'vitest'
import { useBooks } from '~/composables/useBooks'

describe('useBooks', () => {
  it('should be resolvable', () => {
    expect(useBooks).toBeDefined()
  })
})
