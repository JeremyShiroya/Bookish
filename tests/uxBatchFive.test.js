import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  DEFAULT_LIBRARY_FILTERS,
  matchesLibraryFilters,
  normalizeLibraryFilters,
  resetLibraryFiltersForTests,
  useLibraryFilters,
} from '../composables/useLibraryFilters.js'
import {
  chunkForProgress,
  progressForChunk,
  readingPositionUpdate,
  resolveStartChunk,
  statusForProgress,
} from '../composables/useReadingPosition.js'
import {
  enabledAcceptAttribute,
  enabledExtensionPattern,
  enabledFormatsForMode,
  formatModeFor,
  isFormatEnabled,
  normalizeEnabledFormats,
  normalizeBookishSettings,
} from '../composables/useBookishSettings.js'
import { booksOfFormat, formatsRemovedBy } from '../composables/useFormatEnablement.js'
import {
  assembleLines,
  blocksForLines,
  blocksToHtml,
  collectRepeatedMarginText,
  detectColumns,
  headingLevelFor,
  itemGeometry,
  modalFontSize,
  reflowPdfManifest,
  stripRunningHeads,
} from '../composables/usePdfReflow.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

// A text run at (x, y) with the given font size, in PDF text-matrix form.
const run = (str, x, y, size = 10, width = null) => ({
  str,
  width: width ?? str.length * size * 0.5,
  height: size,
  transform: [size, 0, 0, size, x, y],
})

describe('per-page library filters', () => {
  // The Nuxt test environment's localStorage stub has no clear(), so each test
  // uses its own scope names rather than trying to wipe storage between them.
  beforeEach(() => resetLibraryFiltersForTests())

  test('each scope keeps its own values', () => {
    const books = useLibraryFilters('spec-books')
    const favourites = useLibraryFilters('spec-favourites')

    books.setFilter('status', 'Unread')
    favourites.setFilter('format', 'pdf')

    // The bug: format was one library-wide setting every panel wrote, so
    // choosing PDF on Favourites also changed the Books shelf.
    expect(books.filters.value.status).toBe('Unread')
    expect(books.filters.value.format).toBe('all')
    expect(favourites.filters.value.status).toBe('all')
    expect(favourites.filters.value.format).toBe('pdf')
  })

  test('a scope survives being torn down and remounted', () => {
    const entries = new Map()
    const storage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
    }

    useLibraryFilters('spec-remount', {}, storage).setFilter('status', 'Reading')
    // Opening a book unmounts the list; coming back builds a fresh one, which
    // is exactly when a component-local ref lost the choice.
    resetLibraryFiltersForTests()
    expect(useLibraryFilters('spec-remount', {}, storage).filters.value.status).toBe('Reading')
  })

  test('unknown values fall back to the defaults', () => {
    expect(normalizeLibraryFilters({ status: 'Nope', format: 'mobi' }))
      .toEqual(DEFAULT_LIBRARY_FILTERS)
  })

  test('extras keep only values the page still declares', () => {
    const extras = { sort: ['az', 'za'] }
    expect(normalizeLibraryFilters({ sort: 'za' }, extras).sort).toBe('za')
    // A renamed or removed option cannot resurrect a stale stored value.
    expect(normalizeLibraryFilters({ sort: 'oldest' }, extras).sort).toBe('az')
  })

  test('matching applies status and format together', () => {
    const book = { status: 'Reading', format: 'epub' }
    expect(matchesLibraryFilters(book, { status: 'Reading', format: 'epub' })).toBe(true)
    expect(matchesLibraryFilters(book, { status: 'Read', format: 'epub' })).toBe(false)
    expect(matchesLibraryFilters(book, { status: 'all', format: 'pdf' })).toBe(false)
    expect(matchesLibraryFilters({ format: 'PDF' }, { status: 'all', format: 'pdf' })).toBe(true)
  })
})

describe('reading position shared by both reader surfaces', () => {
  test('progress is chunk-accurate, not chapter-accurate', () => {
    expect(progressForChunk(0, 101)).toBe(0)
    expect(progressForChunk(50, 101)).toBe(50)
    expect(progressForChunk(100, 101)).toBe(100)
    // Round-trips, so a restored position lands where it was saved.
    expect(chunkForProgress(progressForChunk(37, 101), 101)).toBe(37)
  })

  test('turning pages inside one chapter is a real position change', () => {
    // The old guard compared only the rounded percentage, so page turns within
    // a chapter wrote nothing — and with them went the lastReadAt stamp that
    // "Currently Reading" depends on.
    const book = { readingChunk: 10, progress: 5, status: 'Reading' }
    const update = readingPositionUpdate(book, { chunk: 11, totalChunks: 1000 })

    expect(update).not.toBeNull()
    expect(update.readingChunk).toBe(11)
    expect(update.lastReadAt).toBeTruthy()
  })

  test('an unchanged position writes nothing', () => {
    const book = { readingChunk: 10, progress: 1, status: 'Reading' }
    expect(readingPositionUpdate(book, { chunk: 10, totalChunks: 1001 })).toBeNull()
  })

  test('readingChunk outranks the legacy percentage', () => {
    expect(resolveStartChunk({ readingChunk: 42, progress: 90 }, 100)).toBe(42)
    // Books saved before chunk positions existed still reopen roughly in place.
    expect(resolveStartChunk({ progress: 50 }, 101)).toBe(50)
    expect(resolveStartChunk({}, 100)).toBe(0)
    // Never past the end of a book whose chunk count shrank.
    expect(resolveStartChunk({ readingChunk: 999 }, 10)).toBe(9)
  })

  test('status follows progress', () => {
    expect(statusForProgress(0)).toBe('Unread')
    expect(statusForProgress(1)).toBe('Reading')
    expect(statusForProgress(100)).toBe('Read')
  })

  test('both surfaces report the same unit', () => {
    // The paged reader emits the chunk on the visible page; the scroll surface
    // resolves the chunk at the anchor line. One unit is what lets a mode
    // switch keep the place instead of restarting the book.
    const paged = read('components/mobile/ReaderPagedEpub.vue')
    expect(paged).toContain('chunk: firstChunkOnCurrentPage()')

    const page = read('pages/reader/[id].vue')
    expect(page).toContain('const currentReadingChunk = ref(-1)')
    expect(page).toContain('chunkIndexForCurrentPosition()')
    expect(page).toContain('function scrollToChunk')
    // Swapping surfaces hands the position over explicitly.
    expect(page).toContain('watch(usePagedReader')
  })
})

describe('formats the app handles at all', () => {
  test('a mode maps to a format set and back', () => {
    expect(enabledFormatsForMode('epub')).toEqual(['epub'])
    expect(enabledFormatsForMode('both')).toEqual(['epub', 'pdf'])
    expect(formatModeFor(['pdf'])).toBe('pdf')
    expect(formatModeFor(['epub', 'pdf'])).toBe('both')
  })

  test('an empty or junk set never bricks the library', () => {
    expect(normalizeEnabledFormats([])).toEqual(['epub', 'pdf'])
    expect(normalizeEnabledFormats(['mobi'])).toEqual(['epub', 'pdf'])
    expect(normalizeEnabledFormats(['pdf', 'pdf'])).toEqual(['pdf'])
  })

  test('the scanner and the file picker share one extension test', () => {
    const pattern = enabledExtensionPattern(['epub'])
    expect(pattern.test('/sdcard/Books/novel.epub')).toBe(true)
    // The point of removal: a PDF dropped on the device later is never seen.
    expect(pattern.test('/sdcard/Books/manual.pdf')).toBe(false)
    expect(enabledAcceptAttribute(['epub'])).toBe('.epub')
  })

  test('removal is computed from what is on now', () => {
    expect(formatsRemovedBy(['epub', 'pdf'], ['epub'])).toEqual(['pdf'])
    // Widening removes nothing, so it needs no confirmation.
    expect(formatsRemovedBy(['epub'], ['epub', 'pdf'])).toEqual([])
  })

  test('the affected books are the ones of the removed format', () => {
    const books = [
      { id: 1, format: 'pdf' },
      { id: 2, format: 'epub' },
      { id: 3, format: 'PDF' },
    ]
    expect(booksOfFormat(books, 'pdf').map((b) => b.id)).toEqual([1, 3])
    expect(isFormatEnabled({ format: 'pdf' }, ['epub'])).toBe(false)
  })

  test('settings carry the choice and whether it has been made', () => {
    const settings = normalizeBookishSettings({ enabledFormats: ['pdf'] })
    expect(settings.enabledFormats).toEqual(['pdf'])
    // First boot has not been answered yet, which is what shows the chooser.
    expect(settings.formatChoiceMade).toBe(false)
  })

  test('the device scan waits for the first-boot choice', () => {
    const sync = read('composables/useDeviceLibrarySync.js')
    // Scanning first would import books the user is about to say they do not
    // want, so the scan holds and the chooser starts it.
    expect(sync).toContain("settings.value.formatChoiceMade !== true")
    expect(sync).toContain('enabledExtensionPattern(enabledFormats)')

    const modal = read('components/shared/FormatChoiceModal.vue')
    expect(modal).toContain('syncDeviceLibrary()')
  })

  test('removing a format never deletes the file', () => {
    const enablement = read('composables/useFormatEnablement.js')
    // useBooks().deleteBook removes the device FILE and tombstones the import
    // registry — right for "delete this book", wrong here, because re-enabling
    // has to be able to re-import from the files still on disk. The purge goes
    // straight to the record and content stores instead.
    expect(enablement).toContain('store.deleteBook(book.id)')
    expect(enablement).toContain('deleteBookContent(book.id)')
    expect(enablement).not.toContain('deleteDeviceImport')
    expect(enablement).not.toMatch(/=\s*useBooks\(\)[\s\S]{0,200}deleteBook/)
  })
})

describe('the book detail playlist icon reflects membership', () => {
  test('it fills the way the favourite heart does', () => {
    const detail = read('components/mobile/BookDetailMobile.vue')
    expect(detail).toContain('const playlistCount = computed')
    expect(detail).toContain("playlistCount > 0 ? 'ri-play-list-2-fill' : 'ri-play-list-2-line'")

    // It marks membership in the BRAND colour, like the same marker on the
    // library cards. Reusing `.active` — the favourite heart's rule — made it
    // red, which reads as a warning rather than as "filed in a playlist".
    expect(detail).toContain(":class=\"{ 'in-playlist': playlistCount > 0 }\"")
    expect(detail).toMatch(/\.icon-action\.in-playlist[^}]*var\(--color-brand-primary\)/s)

    const card = read('components/shared/LibraryBookCard.vue')
    expect(card).toMatch(/\.action-button\.in-playlist[^}]*var\(--color-brand-primary\)/s)
  })
})

describe('PDF reflow', () => {
  test('geometry comes out of the text matrix', () => {
    const geometry = itemGeometry(run('Hello', 72, 700, 12))
    expect(geometry.x).toBe(72)
    expect(geometry.y).toBe(700)
    expect(geometry.fontSize).toBe(12)
  })

  test('runs sharing a baseline become one line, in reading order', () => {
    const lines = assembleLines([
      run('world', 120, 700),
      run('Hello', 72, 700),
      run('Second line', 72, 680),
    ])
    expect(lines).toHaveLength(2)
    expect(lines[0].text).toBe('Hello world')
    // PDF y grows upward, so the higher baseline is read first.
    expect(lines[1].text).toBe('Second line')
  })

  test('a two-column page reads column-major', () => {
    const left = Array.from({ length: 4 }, (_, i) => ({ left: 50, right: 240, centre: 145, y: 700 - i * 20 }))
    const right = Array.from({ length: 4 }, (_, i) => ({ left: 320, right: 520, centre: 420, y: 700 - i * 20 }))
    const columns = detectColumns([...left, ...right], 600)
    expect(columns).toHaveLength(2)
    expect(columns[0]).toHaveLength(4)

    // A single-column page must not be split by one stray indent.
    const single = Array.from({ length: 8 }, (_, i) => ({ left: 50, right: 550, centre: 300, y: 700 - i * 20 }))
    expect(detectColumns(single, 600)).toHaveLength(1)
  })

  test('running heads and page numbers are dropped', () => {
    const pages = Array.from({ length: 6 }, (_, i) => ({
      height: 800,
      lines: [
        { text: 'A History of Everything', y: 780 },
        { text: `Body text on page ${i}`, y: 400 },
        { text: String(i + 1), y: 20 },
      ],
    }))

    const repeated = collectRepeatedMarginText(pages)
    expect(repeated.has('a history of everything')).toBe(true)

    const kept = stripRunningHeads(pages[0].lines, 800, repeated)
    expect(kept.map((line) => line.text)).toEqual(['Body text on page 0'])
  })

  test('body text is never mistaken for a running head', () => {
    // The same sentence in the MIDDLE of every page is prose, not furniture.
    const pages = Array.from({ length: 6 }, () => ({
      height: 800,
      lines: [{ text: 'A repeated refrain', y: 400 }],
    }))
    expect(collectRepeatedMarginText(pages).size).toBe(0)
  })

  test('headings rank by size into a real hierarchy', () => {
    const lines = [
      { text: 'Chapter One', fontSize: 24, bold: true },
      { text: 'A Subsection', fontSize: 16, bold: false },
      { text: 'A'.repeat(300), fontSize: 10, bold: false },
    ]
    const bodySize = 10
    const headingSizes = [24, 16]
    expect(headingLevelFor(lines[0], bodySize, headingSizes)).toBe(1)
    expect(headingLevelFor(lines[1], bodySize, headingSizes)).toBe(2)
    // Long body text is never a heading, however it is set.
    expect(headingLevelFor(lines[2], bodySize, headingSizes)).toBe(0)
  })

  test('the body size is the most-used size, weighted by text', () => {
    expect(modalFontSize([
      { text: 'Chapter One', fontSize: 24 },
      { text: 'A'.repeat(400), fontSize: 10 },
      { text: 'B'.repeat(400), fontSize: 10 },
    ])).toBe(10)
  })

  test('lines merge into paragraphs and hyphens are rejoined', () => {
    const lines = [
      { text: 'The quick brown fox jumped over the lazy under-', y: 700, left: 50, right: 550, fontSize: 10, itemIndexes: [0] },
      { text: 'growth without breaking stride.', y: 686, left: 50, right: 300, fontSize: 10, itemIndexes: [1] },
    ]
    const blocks = blocksForLines(lines, { bodySize: 10, headingSizes: [], columnRight: 550 })
    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toBe('The quick brown fox jumped over the lazy undergrowth without breaking stride.')
  })

  test('bullets and numbers become lists', () => {
    const lines = [
      { text: '• First point', y: 700, left: 50, right: 300, fontSize: 10, itemIndexes: [] },
      { text: '• Second point', y: 686, left: 50, right: 300, fontSize: 10, itemIndexes: [] },
    ]
    const html = blocksToHtml(blocksForLines(lines, { bodySize: 10, headingSizes: [], columnRight: 550 }))
    expect(html).toBe('<ul><li>First point</li><li>Second point</li></ul>')
  })

  test('reflowed text is escaped', () => {
    const html = blocksToHtml([{ type: 'paragraph', text: '<script>alert(1)</script>' }])
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  test('a manifest reflows into EPUB-shaped sections', () => {
    const manifest = {
      pages: [{
        page: 1,
        width: 600,
        height: 800,
        items: [
          run('Chapter One', 72, 700, 24),
          run('It was a bright cold day in April, and the clocks', 72, 650, 10),
          run('were striking thirteen.', 72, 636, 10),
        ],
      }],
    }

    const reflow = reflowPdfManifest(manifest)
    expect(reflow.empty).toBe(false)
    expect(reflow.sections).toHaveLength(1)
    // Sections carry a title and HTML, exactly like EPUB chapters — which is
    // what lets them render through the existing reading surfaces.
    expect(reflow.sections[0].title).toBe('Chapter One')
    expect(reflow.sections[0].html).toContain('<h1>Chapter One</h1>')
    expect(reflow.sections[0].html).toContain('striking thirteen')
    expect(reflow.sections[0].page).toBe(1)
  })

  test('a scan with no text layer reports itself as empty', () => {
    // Rendering a blank reader would look broken, so the control is offered
    // disabled with an explanation instead.
    expect(reflowPdfManifest({ pages: [] }).empty).toBe(true)
    expect(reflowPdfManifest({ pages: [{ page: 1, width: 600, height: 800, items: [] }] }).empty).toBe(true)
  })

  test('reflow rides the EPUB pipeline rather than a parallel PDF one', () => {
    const page = read('pages/reader/[id].vue')
    // The pipeline's question is "is this read as flowing text", not "is the
    // file a PDF" — so a reflowed PDF takes the EPUB path throughout.
    expect(page).toContain('const readsAsEpub = computed')
    expect(page).toContain('if (usePdfReflowView.value) return pdfReflow.value?.sections')
    // The canvas viewer stands down in reflow.
    expect(page).toContain('!!pdfSource.value && !usePdfReflowView.value')
    // Availability is a cheap manifest check, not a full reflow — otherwise
    // every PDF open would pay for a pass over every page before painting.
    expect(page).toContain("(pdfManifest.value?.chunks?.length || 0) > 0")
    expect(page).toContain('usePdfReflowView.value ? reflowPdfManifest(pdfManifest.value, pdfFigures.value) : null')

    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).toContain("prefs.pdfViewMode === mode")
    expect(reader).toContain('isPdfDocument')
    expect(reader).toContain('pdfReflowAvailable')
  })
})
