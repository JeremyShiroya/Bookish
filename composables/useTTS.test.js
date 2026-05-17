import { describe, it, expect } from 'vitest'
import { stripHtml, splitToChunks, formatDuration, findContentStart } from './useTTS.js'

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
    expect(stripHtml('&amp; &lt; &gt; &quot; &#39; &nbsp;')).toBe('& < > " \'')
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

describe('findContentStart', () => {
  // ── No boilerplate ──────────────────────────────────────────────────────
  it('returns 0 when there is no copyright page', () => {
    const chunks = [
      'The night was dark and full of stars.',
      'She walked alone down the empty street.',
      'A dog barked somewhere in the distance.',
    ]
    expect(findContentStart(chunks)).toBe(0)
  })

  it('single weak signal alone does not trigger a skip', () => {
    const chunks = [
      'Copyright is a complex topic in modern publishing.',
      'The author wrote many acclaimed books.',
    ]
    expect(findContentStart(chunks)).toBe(0)
  })

  // ── Copyright detection ─────────────────────────────────────────────────
  it('skips a chunk with © symbol', () => {
    const chunks = [
      'Copyright © 2024 Jane Smith. All rights reserved.',
      'The night was dark and full of stars.',
    ]
    expect(findContentStart(chunks)).toBe(1)
  })

  it('skips a chunk with an ISBN signal', () => {
    const chunks = [
      'ISBN 978-1-234-56789-0',
      'She walked alone down the empty street.',
    ]
    expect(findContentStart(chunks)).toBe(1)
  })

  it('skips a chunk matching two weak copyright signals', () => {
    const chunks = [
      'First published by Riverhead Books. This is a work of fiction.',
      'Chapter One. It began on a rainy Tuesday morning.',
    ]
    expect(findContentStart(chunks)).toBe(1)
  })

  it('skips past the last boilerplate chunk even with clean gaps between', () => {
    const chunks = [
      'Copyright © 2023 Author Name.',   // boilerplate
      'For my mother, who believed.',    // dedication — no signals
      'eISBN 978-0-000-00000-0',         // boilerplate
      'Chapter 1. The story begins.',    // content
    ]
    expect(findContentStart(chunks)).toBe(3)
  })

  // ── Table of contents detection ─────────────────────────────────────────
  it('skips "Table of Contents" heading chunk', () => {
    const chunks = [
      'Table of Contents',
      'She walked alone down the empty street and heard nothing.',
    ]
    expect(findContentStart(chunks)).toBe(1)
  })

  it('skips TOC entries detected by dot leaders', () => {
    const chunks = [
      'Table of Contents',
      'Chapter 1 ......... 1 Chapter 2 ......... 18',
      'Chapter 3 ......... 42 Chapter 4 ......... 67',
      'The door opened slowly. She stepped inside and held her breath.',
    ]
    // heading at 0, dot-leader entries at 1 and 2, prose at 3
    expect(findContentStart(chunks)).toBe(3)
  })

  it('skips TOC entries detected by 3+ chapter-word pattern', () => {
    const chunks = [
      'Table of Contents',
      'Chapter 1 The Beginning 1 Chapter 2 The Middle 24 Chapter 3 The End 67',
      'She had waited her entire life for this moment.',
    ]
    expect(findContentStart(chunks)).toBe(2)
  })

  it('stops the TOC window early when real prose is encountered', () => {
    const chunks = [
      'Table of Contents',
      'Chapter 1 The Arrival 1 Chapter 2 The Storm 22 Chapter 3 The Calm 45',
      // Next chunk is real prose — window should stop here
      'The rain had not let up for three days. She stood at the window and watched it fall.',
    ]
    expect(findContentStart(chunks)).toBe(2)
  })

  it('handles copyright page followed immediately by TOC then story', () => {
    const chunks = [
      'Copyright © 2022 Publisher Inc. All rights reserved. ISBN 978-0-000-00000-0',
      'Table of Contents',
      'Chapter 1 Into the Wild 1 Chapter 2 The River 18 Chapter 3 Home 52',
      'Epilogue 89',
      'He woke before dawn. The tent was cold and the fire had died.',
    ]
    expect(findContentStart(chunks)).toBe(4)
  })

  // ── Edge cases ──────────────────────────────────────────────────────────
  it('returns 0 for an empty chunk array', () => {
    expect(findContentStart([])).toBe(0)
  })

  it('never skips past MAX_SCAN_CHUNKS', () => {
    const chunks = Array.from({ length: 80 }, (_, i) =>
      i === 58 ? 'Copyright © 2024 Publisher.' : `Sentence number ${i} ends here.`
    )
    const result = findContentStart(chunks)
    expect(result).toBeLessThanOrEqual(60)
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
