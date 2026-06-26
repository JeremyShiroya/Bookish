import { describe, it, expect } from 'vitest'
import {
  stripHtml, splitToChunks, groupChunks, formatDuration, findContentStart,
  buildReadableChunks, buildChapterBoundariesFromHtml,
  chunkIndexForPdfProgress, chunkIndexForProgress,
  resolvePlaybackChunks, takeMatchingPrefetch, ttsPrewarmKey,
} from './useTTS.js'

describe('takeMatchingPrefetch', () => {
  it('refuses late audio that belongs to a different chunk', () => {
    expect(takeMatchingPrefetch({
      chunkIdx: 12,
      chunkText: 'Future sentence.',
      audio: 'future-audio',
      boundaries: [],
    }, 9, 'Expected sentence.')).toBeNull()
  })

  it('returns audio only for the active chunk index and text', () => {
    const prefetch = {
      chunkIdx: 9,
      chunkText: 'Matching sentence.',
      audio: 'matching-audio',
      boundaries: [{ offset: 0 }],
    }
    expect(takeMatchingPrefetch(prefetch, 9, 'Matching sentence.')).toEqual(prefetch)
  })

  it('rejects cached audio at the same index when its sentence text differs', () => {
    expect(takeMatchingPrefetch({
      chunkIdx: 9,
      chunkText: 'He was directing his men.',
      audio: 'wrong-audio',
      boundaries: [],
    }, 9, 'Lena had woken out of a dead sleep.')).toBeNull()
  })
})

describe('resolvePlaybackChunks', () => {
  it('uses explicit manifest chunks for PDFs instead of stored HTML', () => {
    const chunks = resolvePlaybackChunks({
      format: 'pdf',
      html: '<p>Wrong reconstructed text.</p>',
      explicitChunks: ['Exact first sentence.', 'Exact second sentence.'],
    })

    expect(chunks).toEqual(['Exact first sentence.', 'Exact second sentence.'])
  })

  it('keeps existing section-aware HTML chunking for EPUB content', () => {
    const chunks = resolvePlaybackChunks({
      format: 'epub',
      html: '<p>First.</p><hr class="chapter-break"><p>Second.</p>',
    })

    expect(chunks).toEqual(['First.', 'Second.'])
  })
})

describe('buildReadableChunks', () => {
  const section = (text) => `<p>${text}</p>`
  const join = (...parts) => `<div class="epub-content">${parts.join('<hr class="chapter-break"/>')}</div>`

  it('keeps per-section chunk counts summing to the flat total (no cross-section drift)', () => {
    // A section that ends without a terminator would merge into the next one if
    // the whole book were chunked at once — per-section chunking must not.
    const html = join(section('Chapter One'), section('It began here'), section('Then it ended. Done.'))
    const { chunks, sectionCounts } = buildReadableChunks(html)
    expect(sectionCounts.reduce((a, b) => a + b, 0)).toBe(chunks.length)
    expect(sectionCounts.length).toBe(3)
  })

  it('a chapter split lands on the exact chunk that starts the section', () => {
    const html = join(section('Alpha one. Alpha two.'), section('Beta one. Beta two.'))
    const { chunks, sectionCounts } = buildReadableChunks(html)
    const bounds = buildChapterBoundariesFromHtml(html, chunks.length,
      ['Alpha', 'Beta'])
    // Second chapter's chunkStart must index the real first chunk of section 2.
    expect(chunks[bounds[1].chunkStart]).toBe('Beta one.')
    expect(bounds[1].chunkStart).toBe(sectionCounts[0])
  })

  it('falls back to whole-text chunking when there are no chapter breaks', () => {
    const { chunks, sectionCounts } = buildReadableChunks('<p>Just one. Section here.</p>')
    expect(chunks).toEqual(['Just one.', 'Section here.'])
    expect(sectionCounts).toEqual([2])
  })
})

describe('chunk index mapping', () => {
  it('maps saved EPUB progress to section boundaries instead of proportional chunk guesses', () => {
    const sectionCounts = [10, 1, 1, 1]

    expect(chunkIndexForProgress(67, sectionCounts, 0)).toBe(11)
  })

  it('respects content-start when a new book has no saved progress', () => {
    expect(chunkIndexForProgress(0, [3, 4, 5], 3)).toBe(3)
  })

  it('maps saved PDF progress to the first manifest chunk on that page', () => {
    const manifest = {
      pages: [
        { page: 1, chunkIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
        { page: 2, chunkIds: [] },
        { page: 3, chunkIds: [10] },
        { page: 4, chunkIds: [11] },
      ],
      chunks: [
        ...Array.from({ length: 10 }, (_, id) => ({ id, page: 1, text: `Page one ${id}.` })),
        { id: 10, page: 3, text: 'PAGE THREE EXPECTED START.' },
        { id: 11, page: 4, text: 'Page four.' },
      ],
    }

    expect(chunkIndexForPdfProgress(67, manifest, 0)).toBe(10)
  })
})

describe('buildChapterBoundariesFromHtml', () => {
  const join = (parts) => parts.join('<hr class="chapter-break"/>')

  it('emits one segment per titled section, matching the TOC', () => {
    const parts = [
      '<p>Front matter copyright.</p>',
      '<p>Body one. Body two.</p>',
      '<p>Body three. Body four.</p>',
    ]
    const html = join(parts)
    const total = buildReadableChunks(html).chunks.length
    const bounds = buildChapterBoundariesFromHtml(html, total, [null, 'Chapter One', 'Chapter Two'])
    expect(bounds.map(b => b.title)).toEqual(['Chapter One', 'Chapter Two'])
    expect(bounds[bounds.length - 1].chunkEnd).toBe(total - 1)
  })

  it('returns [] for flat content with no chapter breaks', () => {
    expect(buildChapterBoundariesFromHtml('<p>Flat. Text.</p>', 2)).toEqual([])
  })
})

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
  it('keeps normal sentences as individual playback chunks', () => {
    const chunks = splitToChunks('First sentence. Second sentence! Third sentence?')
    expect(chunks).toEqual(['First sentence.', 'Second sentence!', 'Third sentence?'])
  })
})

describe('groupChunks', () => {
  it('combines short sentence chunks for local Kokoro playback', () => {
    const chunks = ['First sentence.', 'Second sentence.', 'Third sentence.']
    expect(groupChunks(chunks, 40)).toEqual(['First sentence. Second sentence.', 'Third sentence.'])
  })

  it('preserves text while grouping chunks', () => {
    const chunks = ['Alpha.', 'Beta is longer.', 'Gamma.']
    expect(groupChunks(chunks, 30).join(' ')).toBe(chunks.join(' '))
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
      'Chapter 1. The story begins.',    // also boilerplate — matches chapter\s+\d TOC pattern
    ]
    expect(findContentStart(chunks)).toBe(4)
  })

  // ── Table of contents detection ─────────────────────────────────────────
  it('skips "Table of Contents" heading chunk and short follow-on inside TOC window', () => {
    const chunks = [
      'Table of Contents',
      // 57 chars — below the 60-char prose threshold, so still treated as TOC content
      'She walked alone down the empty street and heard nothing.',
    ]
    expect(findContentStart(chunks)).toBe(2)
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
      // 47 chars — below the 60-char prose threshold, treated as inside TOC window
      'She had waited her entire life for this moment.',
    ]
    expect(findContentStart(chunks)).toBe(3)
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
  it('formats 65 seconds as clock time', () => {
    expect(formatDuration(65)).toBe('1:05')
  })
  it('pads single-digit seconds', () => {
    expect(formatDuration(40)).toBe('0:40')
    expect(formatDuration(61)).toBe('1:01')
  })
  it('formats large values as hours, minutes, and seconds', () => {
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(60188)).toBe('16:43:08')
  })
})

describe('ttsPrewarmKey', () => {
  it('differs when voice or speed differ', () => {
    const base = ttsPrewarmKey('Hello there.', 'en-US-JennyNeural', 1)
    expect(base).not.toBe(ttsPrewarmKey('Hello there.', 'en-US-GuyNeural', 1))
    expect(base).not.toBe(ttsPrewarmKey('Hello there.', 'en-US-JennyNeural', 1.5))
  })

  it('matches for identical text, voice, and speed', () => {
    expect(ttsPrewarmKey('Hi.', 'v', 1)).toBe(ttsPrewarmKey('Hi.', 'v', 1))
  })
})
