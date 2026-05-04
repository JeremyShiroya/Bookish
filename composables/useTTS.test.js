import { describe, it, expect } from 'vitest'
import { stripHtml, splitToChunks, formatDuration } from './useTTS.js'

describe('stripHtml', () => {
  it('removes block tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hello</p><p>World</p>')).toBe('Hello World')
  })
  it('removes style blocks entirely', () => {
    expect(stripHtml('<style>body{color:red}</style><p>Text</p>')).toBe('Text')
  })
  it('removes script blocks entirely', () => {
    expect(stripHtml('<script>alert(1)</script><p>Safe</p>')).toBe('Safe')
  })
  it('decodes common HTML entities', () => {
    expect(stripHtml('&amp; &lt; &gt; &quot; &#39; &nbsp;')).toBe('& < > " \' ')
  })
  it('returns empty string for null/empty', () => {
    expect(stripHtml(null)).toBe('')
    expect(stripHtml('')).toBe('')
  })
})

describe('splitToChunks', () => {
  it('splits long text at sentence boundaries', () => {
    const text = 'First sentence. Second sentence. Third sentence.'
    const chunks = splitToChunks(text, 30)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join(' ')).toContain('First sentence')
    expect(chunks.join(' ')).toContain('Third sentence')
  })
  it('preserves all text content across chunks', () => {
    const text = 'Alpha sentence. Beta sentence. Gamma sentence.'
    const chunks = splitToChunks(text, 30)
    const rejoined = chunks.join(' ')
    expect(rejoined).toContain('Alpha')
    expect(rejoined).toContain('Beta')
    expect(rejoined).toContain('Gamma')
  })
  it('returns non-empty chunks only', () => {
    const chunks = splitToChunks('  .  .  ')
    chunks.forEach(c => expect(c.length).toBeGreaterThan(0))
  })
  it('handles text with no sentence terminators as one chunk', () => {
    const text = 'A plain sentence without terminator'
    const chunks = splitToChunks(text)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join(' ')).toContain('plain sentence')
  })
})

describe('formatDuration', () => {
  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
  it('formats 65 seconds as 1:05', () => {
    expect(formatDuration(65)).toBe('1:05')
  })
  it('pads single-digit seconds', () => {
    expect(formatDuration(61)).toBe('1:01')
  })
  it('formats large values', () => {
    expect(formatDuration(3600)).toBe('60:00')
  })
})
