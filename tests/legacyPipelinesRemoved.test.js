import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('legacy reader pipelines', () => {
  it('does not build or search a DOM PDF text layer', () => {
    const viewer = source('components/shared/PdfViewer.vue')

    expect(viewer).not.toContain('usePdfHighlight')
    expect(viewer).not.toContain('TextLayer')
    expect(viewer).not.toContain('document.createRange')
    expect(viewer).not.toContain('findPdfHighlightRange')
  })

  it('does not infer PDF chunks from HTML section counts', () => {
    const reader = source('pages/reader/[id].vue')

    expect(reader).not.toContain('chunkIndexForSection')
    expect(reader).not.toContain('sectionForChunkIndex')
    expect(reader).not.toContain('sectionChunkCounts')
  })
})

describe('legacy author totals pipeline', () => {
  it('does not consume unvalidated provider work counts', () => {
    const detail = source('components/shared/AuthorDetailComp.vue')
    const route = source('server/api/authors/bio.get.ts')

    expect(detail).not.toContain('authorBooksCount')
    expect(detail).not.toContain('authorSeriesCount')
    expect(route).not.toContain('extractBibliographyStats')
  })
})
