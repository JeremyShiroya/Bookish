import { describe, expect, it } from 'vitest'
import {
  findPdfChunkRange,
  findPdfHighlightRange,
  highlightsForPdfRange,
  mergePdfHighlightRects,
  normalizePdfHighlightText,
} from './usePdfHighlight.js'

describe('PDF read-aloud highlighting', () => {
  const buildPdfTextItems = (segments) => {
    let flatText = ''
    const items = segments.map((segment, index) => {
      const start = flatText.length
      flatText += `${segment.text} `
      return {
        pageNumber: segment.pageNumber || 1,
        start,
        end: start + segment.text.length - 1,
        rect: segment.rect || { left: index * 100, top: 10, width: segment.text.length * 10, height: 8 },
      }
    })

    return { flatText, items }
  }

  it('normalizes whitespace and case for matching', () => {
    expect(normalizePdfHighlightText('  The   Door\nOpened.  ')).toBe('the door opened.')
  })

  it('finds an exact active sentence range', () => {
    const flatText = 'Before text. The door opened slowly. After text.'
    const range = findPdfHighlightRange(flatText, 'The door opened slowly.')

    expect(flatText.slice(range.start, range.end + 1)).toBe('The door opened slowly.')
  })

  it('finds a whitespace-normalized active sentence range', () => {
    const flatText = 'Before text. The   door\nopened slowly. After text.'
    const range = findPdfHighlightRange(flatText, 'The door opened slowly.')

    expect(flatText.slice(range.start, range.end + 1).replace(/\s+/g, ' ')).toBe('The door opened slowly.')
  })

  it('falls back to a stable prefix for long active sentences', () => {
    const flatText = 'The woman stood by the window and listened to the rain hit the roof while the house creaked and the hallway stayed dark.'
    const activeText = `${flatText} This extra tail is not present in the PDF layer.`

    const range = findPdfHighlightRange(flatText, activeText)

    expect(range.start).toBe(0)
    expect(flatText.slice(range.start, range.end + 1)).toBe(flatText.slice(0, 120))
  })

  it('returns null when no active sentence matches', () => {
    expect(findPdfHighlightRange('The PDF text is here.', 'Nothing like it.')).toBeNull()
  })

  it('resolves repeated sentences by canonical chunk order, not the first text match', () => {
    const chunks = [
      'Again.',
      'Some intervening text.',
      'Again.',
      'Lena had woken out of a dead sleep.',
    ]
    const flatText = chunks.join(' ')

    const range = findPdfChunkRange(flatText, chunks, 2)

    expect(flatText.slice(range.start, range.end + 1)).toBe('Again.')
    expect(range.start).toBe(flatText.lastIndexOf('Again.'))
  })

  it('builds clipped highlight rectangles for intersecting text items only', () => {
    const highlights = highlightsForPdfRange([
      { pageNumber: 1, start: 0, end: 4, rect: { left: 10, top: 10, width: 20, height: 8 } },
      { pageNumber: 1, start: 6, end: 10, rect: { left: 35, top: 10, width: 22, height: 8 } },
      { pageNumber: 2, start: 20, end: 25, rect: { left: 10, top: 20, width: 30, height: 8 } },
    ], { start: 3, end: 12 })

    expect(highlights).toEqual({
      1: [{ left: 20, top: 9, width: 39, height: 10 }],
    })
  })

  it('merges neighboring word boxes into one continuous line highlight', () => {
    expect(mergePdfHighlightRects([
      { left: 48, top: 81, width: 42, height: 20 },
      { left: 94, top: 81, width: 31, height: 20 },
      { left: 130, top: 81, width: 51, height: 20 },
      { left: 30, top: 111, width: 88, height: 20 },
    ])).toEqual([
      { left: 48, top: 81, width: 133, height: 20 },
      { left: 30, top: 111, width: 88, height: 20 },
    ])
  })

  it('does not highlight the previous sentence when a PDF text item contains both sentences', () => {
    const previous = 'about the least of things? '
    const active = 'When was there going to come a time when it started being about the most?'
    const flatText = `${previous}${active}`
    const range = findPdfHighlightRange(flatText, active)
    const highlights = highlightsForPdfRange([
      { pageNumber: 1, start: 0, end: flatText.length - 1, rect: { left: 28, top: 20, width: 300, height: 14 } },
    ], range)

    const highlight = highlights[1][0]
    const expectedLeft = 28 + (300 * previous.length / flatText.length) - 2
    const expectedWidth = (300 * active.length / flatText.length) + 4

    expect(highlight.left).toBeCloseTo(expectedLeft, 5)
    expect(highlight.width).toBeCloseTo(expectedWidth, 5)
  })

  it('uses measured glyph advances when clipping inside a proportional-font text item', () => {
    const text = 'called. He was directing'
    const active = 'He was directing'
    const range = findPdfHighlightRange(text, active)
    const advances = Array.from(
      { length: text.length + 1 },
      (_, index) => index <= 8 ? index * 10 : 80 + ((index - 8) * 2),
    )
    const highlights = highlightsForPdfRange([{
      pageNumber: 1,
      start: 0,
      end: text.length - 1,
      text,
      advances,
      rect: { left: 20, top: 12, width: 192, height: 16 },
    }], range)

    const expectedLeft = 20 + (192 * advances[8] / advances.at(-1)) - 2
    const expectedWidth = (192 * ((advances.at(-1) - advances[8]) / advances.at(-1))) + 4

    expect(highlights[1][0].left).toBeCloseTo(expectedLeft, 5)
    expect(highlights[1][0].width).toBeCloseTo(expectedWidth, 5)
  })

  it('clips a highlight that starts at the beginning of a text item', () => {
    const text = 'First sentence. Second sentence.'
    const range = findPdfHighlightRange(text, 'First sentence.')
    const highlights = highlightsForPdfRange([
      { pageNumber: 1, start: 0, end: text.length - 1, rect: { left: 10, top: 12, width: 290, height: 10 } },
    ], range)

    expect(highlights[1][0]).toEqual({
      left: 8,
      top: 11,
      width: 290 * ('First sentence.'.length / text.length) + 4,
      height: 12,
    })
  })

  it('clips a highlight that ends at the end of a text item', () => {
    const text = 'First sentence. Second sentence.'
    const range = findPdfHighlightRange(text, 'Second sentence.')
    const highlights = highlightsForPdfRange([
      { pageNumber: 1, start: 0, end: text.length - 1, rect: { left: 10, top: 12, width: 290, height: 10 } },
    ], range)
    const expectedLeft = 10 + (290 * 'First sentence. '.length / text.length) - 2
    const expectedWidth = 290 * ('Second sentence.'.length / text.length) + 4

    expect(highlights[1][0].left).toBeCloseTo(expectedLeft, 5)
    expect(highlights[1][0].top).toBe(11)
    expect(highlights[1][0].width).toBeCloseTo(expectedWidth, 5)
    expect(highlights[1][0].height).toBe(12)
  })

  it('clips the first and last items when a sentence spans multiple PDF text items', () => {
    const { flatText, items } = buildPdfTextItems([
      { text: 'Noise. The sentence', rect: { left: 0, top: 10, width: 190, height: 8 } },
      { text: 'continues through here', rect: { left: 0, top: 24, width: 220, height: 8 } },
      { text: 'and ends. More noise.', rect: { left: 0, top: 38, width: 210, height: 8 } },
    ])
    const active = 'The sentence continues through here and ends.'
    const range = findPdfHighlightRange(flatText, active)
    const highlights = highlightsForPdfRange(items, range)

    expect(highlights[1][0].left).toBeCloseTo(68, 5)
    expect(highlights[1][0].width).toBeCloseTo(124, 5)
    expect(highlights[1][1]).toEqual({ left: 0, top: 23, width: 224, height: 10 })
    expect(highlights[1][2].left).toBeCloseTo(0, 5)
    expect(highlights[1][2].width).toBeCloseTo(210 * ('and ends.'.length / 'and ends. More noise.'.length) + 4, 5)
  })
})
