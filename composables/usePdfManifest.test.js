import { describe, expect, it } from 'vitest'
import {
  PDF_MANIFEST_VERSION,
  buildPdfManifest,
  chunkForId,
  firstChunkForPage,
  pageForChunk,
  wordSpansWithinChunk,
} from './usePdfManifest.js'

const item = (str, x, y, width = str.length * 6, extra = {}) => ({
  str,
  width,
  height: 10,
  transform: [1, 0, 0, 10, x, y],
  ...extra,
})

describe('buildPdfManifest', () => {
  it('keeps PDF item order and inserts readable spaces without losing spans', () => {
    const manifest = buildPdfManifest([{
      page: 1,
      width: 600,
      height: 800,
      items: [
        item('Hello', 10, 700),
        item('world.', 46, 700),
        item('Next sentence.', 10, 680),
      ],
    }])

    expect(manifest.version).toBe(PDF_MANIFEST_VERSION)
    expect(manifest.chunks.map(chunk => chunk.text)).toEqual([
      'Hello world.',
      'Next sentence.',
    ])
    expect(manifest.chunks[0].spans).toEqual([
      { itemIndex: 0, start: 0, end: 5 },
      { itemIndex: 1, start: 0, end: 6 },
    ])
  })

  it('keeps repeated sentences as distinct chunks with distinct source spans', () => {
    const manifest = buildPdfManifest([{
      page: 1,
      width: 600,
      height: 800,
      items: [
        item('Again.', 10, 700),
        item('Again.', 10, 680),
      ],
    }])

    expect(manifest.chunks.map(chunk => chunk.text)).toEqual(['Again.', 'Again.'])
    expect(manifest.chunks[0].id).not.toBe(manifest.chunks[1].id)
    expect(manifest.chunks[0].spans[0].itemIndex).toBe(0)
    expect(manifest.chunks[1].spans[0].itemIndex).toBe(1)
  })

  it('preserves empty pages and forwards page lookup to the next readable page', () => {
    const manifest = buildPdfManifest([
      { page: 1, width: 600, height: 800, items: [item('First.', 10, 700)] },
      { page: 2, width: 600, height: 800, items: [] },
      { page: 3, width: 600, height: 800, items: [item('Third.', 10, 700)] },
    ])

    expect(manifest.pages).toHaveLength(3)
    expect(manifest.pages[1].items).toEqual([])
    expect(firstChunkForPage(manifest, 2)?.text).toBe('Third.')
    expect(firstChunkForPage(manifest, 99)).toBeNull()
  })

  it('records partial first and last item offsets for a sentence', () => {
    const manifest = buildPdfManifest([{
      page: 1,
      width: 600,
      height: 800,
      items: [
        item('Prefix. Start', 10, 700),
        item('middle', 100, 700),
        item('end. Suffix.', 150, 700),
      ],
    }])

    const chunk = manifest.chunks.find(entry => entry.text === 'Start middle end.')
    expect(chunk.spans).toEqual([
      { itemIndex: 0, start: 8, end: 13 },
      { itemIndex: 1, start: 0, end: 6 },
      { itemIndex: 2, start: 0, end: 4 },
    ])
  })

  it('keeps words separated by spaces inside one PDF item as one span', () => {
    const manifest = buildPdfManifest([{
      page: 1,
      width: 600,
      height: 800,
      items: [
        item('Frank was right. Not many people agreed.', 10, 700),
      ],
    }])

    expect(manifest.chunks[0]).toMatchObject({
      text: 'Frank was right.',
      spans: [{ itemIndex: 0, start: 0, end: 16 }],
    })
  })

  it('never creates a sentence chunk across a page boundary', () => {
    const manifest = buildPdfManifest([
      { page: 1, width: 600, height: 800, items: [item('Unfinished line', 10, 700)] },
      { page: 2, width: 600, height: 800, items: [item('continues here.', 10, 700)] },
    ])

    expect(manifest.chunks.map(chunk => [chunk.page, chunk.text])).toEqual([
      [1, 'Unfinished line'],
      [2, 'continues here.'],
    ])
  })
})

describe('manifest lookup helpers', () => {
  const manifest = buildPdfManifest([
    { page: 1, width: 600, height: 800, items: [item('One. Two.', 10, 700)] },
    { page: 2, width: 600, height: 800, items: [item('Three.', 10, 700)] },
  ])

  it('resolves chunks and pages by stable numeric ID', () => {
    const chunk = firstChunkForPage(manifest, 2)
    expect(chunkForId(manifest, chunk.id)).toEqual(chunk)
    expect(pageForChunk(manifest, chunk.id)).toBe(2)
    expect(pageForChunk(manifest, -1)).toBeNull()
  })
})

describe('wordSpansWithinChunk', () => {
  const manifest = buildPdfManifest([{
    page: 1,
    width: 600,
    height: 800,
    items: [
      item('Prefix. Start', 10, 700),
      item('middle', 100, 700),
      item('end. Suffix.', 150, 700),
    ],
  }])
  const chunk = manifest.chunks.find(entry => entry.text === 'Start middle end.')

  it('records the chunk start offset within the page text', () => {
    expect(chunk.textStart).toBe(8)
  })

  it('maps a word fully inside the first item to that item span', () => {
    expect(wordSpansWithinChunk(manifest, chunk.id, 0, 5)).toEqual([
      { itemIndex: 0, start: 8, end: 13 },
    ])
  })

  it('maps a middle word to its own source item', () => {
    expect(wordSpansWithinChunk(manifest, chunk.id, 6, 12)).toEqual([
      { itemIndex: 1, start: 0, end: 6 },
    ])
  })

  it('clamps a word range that runs past the chunk text', () => {
    expect(wordSpansWithinChunk(manifest, chunk.id, 13, 999)).toEqual([
      { itemIndex: 2, start: 0, end: 4 },
    ])
  })

  it('maps a hyphenated word split across two PDF items to two spans', () => {
    const m = buildPdfManifest([{
      page: 1,
      width: 600,
      height: 800,
      items: [item('Full-', 10, 700), item('time. Yes.', 40, 700)],
    }])
    const c = m.chunks.find(entry => entry.text === 'Full-time.')
    expect(c.textStart).toBe(0)
    expect(wordSpansWithinChunk(m, c.id, 0, 9)).toEqual([
      { itemIndex: 0, start: 0, end: 5 },
      { itemIndex: 1, start: 0, end: 4 },
    ])
  })

  it('returns [] for an unknown chunk', () => {
    expect(wordSpansWithinChunk(manifest, 999, 0, 5)).toEqual([])
  })

  it('returns [] for an empty range', () => {
    expect(wordSpansWithinChunk(manifest, chunk.id, 3, 3)).toEqual([])
  })
})
