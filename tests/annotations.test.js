import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  ANNOTATION_MARK_SELECTOR,
  HIGHLIGHT_COLORS,
  NOTE_COLOR,
  anchorFromSelection,
  clearAnnotationMarks,
  colorValue,
  offsetInChunk,
  paintAnnotations,
} from '../composables/useAnnotations.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

// The reader wraps every readable sentence in a chunk span; annotations are
// anchored to those, so the fixture mirrors that shape.
const mountChunks = (sentences) => {
  const host = document.createElement('div')
  host.innerHTML = sentences
    .map((text, i) => `<span data-tts-chunk="${i}">${text}</span>`)
    .join(' ')
  document.body.appendChild(host)
  return host
}

const marksIn = (host) => [...host.querySelectorAll(ANNOTATION_MARK_SELECTOR)]

describe('annotation anchoring', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('a DOM point resolves to its chunk index and character offset', () => {
    const host = mountChunks(['The quick brown fox.', 'It jumped over the dog.'])
    const textNode = host.querySelector('[data-tts-chunk="1"]').firstChild

    expect(offsetInChunk(textNode, 3)).toEqual({ chunkIndex: 1, offset: 3 })
  })

  test('a point outside any chunk has no anchor', () => {
    const host = mountChunks(['Only sentence.'])
    const heading = document.createElement('h2')
    heading.textContent = 'Chapter One'
    host.appendChild(heading)

    expect(offsetInChunk(heading.firstChild, 2)).toBeNull()
  })

  test('a selection becomes a storable anchor with normalized text', () => {
    const host = mountChunks(['The quick brown fox.'])
    const textNode = host.querySelector('[data-tts-chunk="0"]').firstChild
    const range = document.createRange()
    range.setStart(textNode, 4)
    range.setEnd(textNode, 19)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    expect(anchorFromSelection(selection)).toMatchObject({
      startChunk: 0,
      startOffset: 4,
      endChunk: 0,
      text: 'quick brown fox',
    })
  })

  test('a collapsed selection is not an anchor', () => {
    const host = mountChunks(['The quick brown fox.'])
    const range = document.createRange()
    range.setStart(host.querySelector('[data-tts-chunk="0"]').firstChild, 4)
    range.collapse(true)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    expect(anchorFromSelection(selection)).toBeNull()
  })
})

describe('annotation painting', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('paints a highlight over exactly the anchored characters', () => {
    const host = mountChunks(['The quick brown fox.'])
    paintAnnotations(host, [
      { id: 'a', startChunk: 0, startOffset: 4, endChunk: 0, endOffset: 19, color: 'green' },
    ])

    const marks = marksIn(host)
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('quick brown fox')
    expect(marks[0].dataset.annotationId).toBe('a')
  })

  test('a note is painted in the note colour and carries a badge marker', () => {
    const host = mountChunks(['The quick brown fox.'])
    paintAnnotations(host, [
      { id: 'n', startChunk: 0, startOffset: 4, endChunk: 0, endOffset: 9, color: 'yellow', note: 'Mine' },
    ])

    const mark = marksIn(host)[0]
    expect(mark.className).toContain('has-note')
    expect(mark.dataset.hasNote).toBe('true')
    // Handed to CSS as a custom property: the reader tints light and dark
    // paper differently, so an inline background-color would outrank both.
    expect(mark.style.getPropertyValue('--annotation-tint')).toBe(NOTE_COLOR)
  })

  test('a selection spanning sentences is painted once per chunk, badged once', () => {
    const host = mountChunks(['The quick brown fox.', 'It jumped over the dog.'])
    paintAnnotations(host, [
      { id: 'span', startChunk: 0, startOffset: 4, endChunk: 1, endOffset: 10, note: 'Across' },
    ])

    const marks = marksIn(host)
    expect(marks).toHaveLength(2)
    expect(marks.filter((m) => m.dataset.hasNote === 'true')).toHaveLength(1)
  })

  test('painting two annotations keeps both, later offsets intact', () => {
    // Regression guard: painting the earlier range first would shift the DOM
    // out from under the later one, so painting runs in descending order.
    const host = mountChunks(['The quick brown fox jumps over the lazy dog.'])
    paintAnnotations(host, [
      { id: 'first', startChunk: 0, startOffset: 4, endChunk: 0, endOffset: 9, color: 'green' },
      { id: 'second', startChunk: 0, startOffset: 35, endChunk: 0, endOffset: 43, color: 'blue' },
    ])

    const marks = marksIn(host)
    expect(marks.map((m) => m.textContent)).toEqual(['quick', 'lazy dog'])
  })

  test('repainting is idempotent — marks never nest', () => {
    const host = mountChunks(['The quick brown fox.'])
    const list = [{ id: 'a', startChunk: 0, startOffset: 4, endChunk: 0, endOffset: 9, color: 'green' }]
    paintAnnotations(host, list)
    paintAnnotations(host, list)

    expect(marksIn(host)).toHaveLength(1)
    expect(host.querySelector('mark mark')).toBeNull()
  })

  test('clearing restores the original text without leftover nodes', () => {
    const host = mountChunks(['The quick brown fox.'])
    const before = host.textContent
    paintAnnotations(host, [
      { id: 'a', startChunk: 0, startOffset: 4, endChunk: 0, endOffset: 9, color: 'green' },
    ])
    clearAnnotationMarks(host)

    expect(marksIn(host)).toHaveLength(0)
    expect(host.textContent).toBe(before)
  })

  test('an annotation whose chunk is not mounted is skipped, not thrown', () => {
    const host = mountChunks(['The quick brown fox.'])
    expect(() => paintAnnotations(host, [
      { id: 'far', startChunk: 99, startOffset: 0, endChunk: 99, endOffset: 5, color: 'green' },
    ])).not.toThrow()
    expect(marksIn(host)).toHaveLength(0)
  })

  test('an unknown colour falls back to the first swatch', () => {
    expect(colorValue('chartreuse')).toBe(HIGHLIGHT_COLORS[0].value)
    expect(colorValue('blue')).toBe('#90caf9')
  })
})

describe('annotation wiring', () => {
  test('the reader lets the platform select text so the native handles appear', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).toMatch(/\.reader-mobile-text\b[^}]*user-select:\s*text/s)
    expect(reader).toContain('selection-settled')
    expect(reader).toContain('annotation-tap')
    // Annotations load when the book arrives, not on mount — the page fetches
    // the book asynchronously.
    expect(reader).toMatch(/watch\(\s*\(\)\s*=>\s*props\.book\?\.id/)
  })

  test('the selection menu offers every annotation action', () => {
    const menu = read('components/mobile/ReaderSelectionMenu.vue')
    for (const action of ['Read from here', 'Copy', 'Highlight', 'Dictionary', 'Make note']) {
      expect(menu, action).toContain(action)
    }
  })

  test('the highlight and note viewers are top-level routes, not children of the book page', () => {
    // pages/book/[id].vue plus a pages/book/[id]/ directory makes Nuxt treat
    // the detail page as a parent route, so a child would only render inside a
    // <NuxtPage /> it does not have.
    expect(existsSync(resolve(root, 'pages/book/[id]'))).toBe(false)
    expect(read('pages/highlights/[id].vue')).toContain('AnnotationListMobile')
    expect(read('pages/notes/[id].vue')).toContain('AnnotationListMobile')

    const detail = read('components/mobile/BookDetailMobile.vue')
    expect(detail).toContain('/highlights/${book.id}')
    expect(detail).toContain('/notes/${book.id}')
  })

  test('painting targets the live reader, never the offscreen page measurer', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    // The measurer carries `.paged-content` too and is always in the DOM, so a
    // bare selector matched it and painted every highlight into a hidden div.
    expect(reader).toContain('.paged-reader .paged-content')
    expect(reader).not.toMatch(/querySelector(".paged-content")/)
  })

  test('a repaint waits for the chunk spans, not just the rendered HTML', () => {
    // Sentences are wrapped in chunk spans over idle slices AFTER the section
    // HTML lands, so "content rendered" is not the same moment as "content
    // anchorable" — painting on the former found nothing to anchor to.
    expect(read('components/mobile/ReaderMobile.vue')).toContain('chunkMapVersion')
    expect(read('pages/reader/[id].vue')).toContain('chunkMapVersion.value += 1')
  })

  test('switching between page and scroll mode rebuilds the chunk spans', () => {
    // The scroll container is created fresh with no spans in it, and nothing
    // else schedules a rebuild.
    expect(read('pages/reader/[id].vue')).toContain('watch(chaptersContainerRef, async (el) => {')
  })

  test('the annotations store ships in the library database and its backup', () => {
    expect(read('composables/useLibraryStore.js')).toContain("'annotations'")
    const backup = read('composables/useLibraryBackup.js')
    expect(backup).toContain('annotations')
    // A backup opening the DB at an older version throws VersionError, so the
    // two version constants have to move together.
    const storeVersion = read('composables/useLibraryStore.js').match(/DB_VERSION\s*=\s*(\d+)/)?.[1]
    const backupVersion = backup.match(/LIBRARY_DB_VERSION\s*=\s*(\d+)/)?.[1]
    expect(backupVersion).toBe(storeVersion)
  })
})

