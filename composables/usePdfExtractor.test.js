import { describe, expect, it } from 'vitest'
import {
  extractPdf,
  extractPdfOutline,
  extractPdfTocFromDocument,
  extractVisiblePdfToc,
} from './usePdfExtractor.js'

function createFakePdf(outline = []) {
  return {
    getOutline: async () => outline,
    getDestination: async (name) => [`ref-${name}`],
    getPageIndex: async (ref) => ({
      'ref-ch1': 2,
      'ref-ch1a': 3,
      'ref-ch2': 9,
      directRef: 4,
    }[ref] ?? 0),
  }
}

describe('extractVisiblePdfToc', () => {
  it('extracts embedded PDF outline entries with nested levels', async () => {
    const toc = await extractPdfOutline(createFakePdf([
      {
        title: ' Chapter One ',
        dest: 'ch1',
        items: [
          { title: 'Scene A', dest: 'ch1a', items: [] },
        ],
      },
      { title: 'Chapter Two', dest: ['directRef'], items: [] },
    ]))

    expect(toc).toEqual([
      { title: 'Chapter One', page: 3, level: 0 },
      { title: 'Scene A', page: 4, level: 1 },
      { title: 'Chapter Two', page: 5, level: 0 },
    ])
  })

  it('prefers embedded outline entries over a printed contents page', async () => {
    const toc = await extractPdfTocFromDocument(createFakePdf([
      { title: 'Outline Chapter', dest: 'ch2', items: [] },
    ]), [
      { page: 1, lines: ['Contents', 'Printed Chapter .......... 1'] },
    ])

    expect(toc).toEqual([
      { title: 'Outline Chapter', page: 10, level: 0 },
    ])
  })

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

  it('returns no TOC when the PDF has no outline and no explicit contents heading', async () => {
    const toc = await extractPdfTocFromDocument(createFakePdf([]), [
      { page: 1, lines: ['Chapter One .......... 7', 'The first sentence of the book starts here.'] },
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
