import { describe, expect, it } from 'vitest'
import {
  chunkHighlightRects,
  chunkSubRangeRects,
  itemSpanRect,
  scrollTargetForChunk,
} from './usePdfGeometry.js'
import { buildPdfManifest } from './usePdfManifest.js'

const page = {
  page: 2,
  width: 600,
  height: 800,
  items: [
    { str: 'Prefix. Start', width: 130, height: 10, transform: [1, 0, 0, 10, 20, 700] },
    { str: 'middle', width: 60, height: 10, transform: [1, 0, 0, 10, 160, 700] },
    { str: 'end. Suffix.', width: 120, height: 10, transform: [1, 0, 0, 10, 20, 680] },
  ],
}

const manifest = {
  pages: [page],
  chunks: [{
    id: 7,
    page: 2,
    text: 'Start middle end.',
    spans: [
      { itemIndex: 0, start: 8, end: 13 },
      { itemIndex: 1, start: 0, end: 6 },
      { itemIndex: 2, start: 0, end: 4 },
    ],
  }],
}

const viewport = [1, 0, 0, -1, 0, 800]

describe('PDF highlight geometry', () => {
  it('clips the first and last items to the recorded character spans', () => {
    const first = itemSpanRect(page.items[0], manifest.chunks[0].spans[0], viewport)
    const last = itemSpanRect(page.items[2], manifest.chunks[0].spans[2], viewport)

    expect(first.left).toBeCloseTo(100)
    expect(first.width).toBeCloseTo(50)
    expect(last.left).toBeCloseTo(20)
    expect(last.width).toBeCloseTo(40)
  })

  it('merges neighboring source items into one band per visual line', () => {
    const rects = chunkHighlightRects(manifest, 7, viewport)

    expect(rects).toHaveLength(2)
    expect(rects[0].top).toBe(90)
    expect(rects[0].left).toBeCloseTo(100)
    expect(rects[0].width).toBeCloseTo(120)
    expect(rects[1].top).toBe(110)
  })

  it('returns no rectangles for an unknown chunk', () => {
    expect(chunkHighlightRects(manifest, 99, viewport)).toEqual([])
  })

  it('centers explicit jumps on the first highlight rectangle', () => {
    expect(scrollTargetForChunk(manifest, 7, viewport)).toEqual({
      page: 2,
      top: 90,
      left: 100,
    })
  })
})

describe('PDF word sub-range geometry', () => {
  const builtManifest = buildPdfManifest([{
    page: 1,
    width: 600,
    height: 800,
    items: [
      { str: 'Prefix. Start', width: 130, height: 10, transform: [1, 0, 0, 10, 20, 700] },
      { str: 'middle', width: 60, height: 10, transform: [1, 0, 0, 10, 160, 700] },
      { str: 'end. Suffix.', width: 120, height: 10, transform: [1, 0, 0, 10, 20, 680] },
    ],
  }])
  const builtChunk = builtManifest.chunks.find(entry => entry.text === 'Start middle end.')
  const vp = [1, 0, 0, -1, 0, 800]

  it('draws the word rectangle clipped to the source item', () => {
    const rects = chunkSubRangeRects(builtManifest, builtChunk.id, 0, 5, vp)
    expect(rects).toHaveLength(1)
    expect(rects[0].left).toBeCloseTo(100)
    expect(rects[0].width).toBeCloseTo(50)
    expect(rects[0].top).toBe(90)
  })

  it('returns [] for an empty word range', () => {
    expect(chunkSubRangeRects(builtManifest, builtChunk.id, 3, 3, vp)).toEqual([])
  })

  it('returns [] for an unknown chunk', () => {
    expect(chunkSubRangeRects(builtManifest, 999, 0, 5, vp)).toEqual([])
  })
})
