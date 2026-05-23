import { describe, expect, it } from 'vitest'
import { extractPdf, extractVisiblePdfToc } from './usePdfExtractor.js'

describe('extractVisiblePdfToc', () => {
  it('extracts only entries from an explicit table of contents page', () => {
    const toc = extractVisiblePdfToc([
      { page: 1, lines: ['Copyright 2024'] },
      {
        page: 2,
        lines: [
          'Contents',
          'Prologue .......... 1',
          'Chapter One .......... 7 Chapter Two .......... 21',
          'Acknowledgements    315',
        ],
      },
      { page: 3, lines: ['The first sentence of the book starts here.'] },
    ])

    expect(toc).toEqual([
      { title: 'Prologue', page: 1, level: 0 },
      { title: 'Chapter One', page: 7, level: 0 },
      { title: 'Chapter Two', page: 21, level: 0 },
      { title: 'Acknowledgements', page: 315, level: 0 },
    ])
  })

  it('does not infer chapters when no contents heading exists', () => {
    const toc = extractVisiblePdfToc([
      { page: 1, lines: ['Chapter One .......... 7', 'Chapter Two .......... 21'] },
    ])

    expect(toc).toEqual([])
  })

  it('preserves the original PDF source when text extraction fails', async () => {
    const brokenPdf = new File(
      [new TextEncoder().encode('%PDF-this-is-not-a-complete-pdf')],
      'broken.pdf',
      { type: 'application/pdf' }
    )

    const result = await extractPdf(brokenPdf)

    expect(result.source).toBeInstanceOf(ArrayBuffer)
    expect(new TextDecoder().decode(result.source)).toBe('%PDF-this-is-not-a-complete-pdf')
    expect(result.content).toBeNull()
    expect(result.pages).toBe(0)
    expect(result.tocItems).toEqual([])
  })
})
