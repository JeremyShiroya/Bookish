import { describe, expect, it } from 'vitest'
import { normalizeAuthorImageResults } from './useAuthorImageSearch.js'

describe('normalizeAuthorImageResults', () => {
  it('keeps source labels and supports legacy string results', () => {
    expect(normalizeAuthorImageResults([
      { url: 'https://example.com/author.jpg', source: 'google', label: 'Google Images' },
      'https://example.com/legacy.png',
      { url: 'https://example.com/author.jpg', source: 'duplicate', label: 'Duplicate' },
    ])).toEqual([
      { url: 'https://example.com/author.jpg', source: 'google', label: 'Google Images' },
      { url: 'https://example.com/legacy.png', source: 'unknown', label: 'Web image' },
    ])
  })
})
