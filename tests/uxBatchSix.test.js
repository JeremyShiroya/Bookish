import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { normalizeMobileReaderPrefs, PDF_ZOOM_MAX, PDF_ZOOM_MIN } from '../composables/useMobileReaderPrefs.js'
import {
  boxesOverlap,
  figureBoxesFromOperators,
  lineIsInsideFigure,
  mergeFigureBoxes,
} from '../composables/usePdfFigures.js'
import { blocksToHtml, mergeFiguresIntoBlocks, reflowPdfManifest } from '../composables/usePdfReflow.js'

const root = resolve(process.cwd())
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const run = (str, x, y, size = 10) => ({
  str,
  width: str.length * size * 0.5,
  height: size,
  transform: [size, 0, 0, size, x, y],
})

describe('PDF figures in reflow', () => {
  // A tiny stand-in for pdf.js's OPS enum, so the operator walk can be tested
  // without opening a real document.
  const OPS = {
    save: 1,
    restore: 2,
    transform: 3,
    paintImageXObject: 4,
    paintImageXObjectRepeat: 5,
    paintJpegXObject: 6,
    paintInlineImageXObject: 7,
  }

  test('an image paint yields its box on the page', () => {
    // The unit square through the current transform IS the image's placement.
    const operatorList = {
      fnArray: [OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore],
      argsArray: [null, [200, 0, 0, 150, 60, 400], ['img_1'], null],
    }
    const boxes = figureBoxesFromOperators(operatorList, OPS)
    expect(boxes).toHaveLength(1)
    expect(boxes[0]).toMatchObject({ x: 60, y: 400, width: 200, height: 150 })
  })

  test('the transform stack is restored, so later images are not skewed', () => {
    const operatorList = {
      fnArray: [OPS.save, OPS.transform, OPS.restore, OPS.transform, OPS.paintImageXObject],
      argsArray: [null, [999, 0, 0, 999, 999, 999], null, [100, 0, 0, 100, 10, 20], ['img_1']],
    }
    const boxes = figureBoxesFromOperators(operatorList, OPS)
    expect(boxes[0]).toMatchObject({ x: 10, y: 20, width: 100, height: 100 })
  })

  test('rules, bullets and logos are not figures', () => {
    const operatorList = {
      fnArray: [OPS.transform, OPS.paintImageXObject],
      argsArray: [[300, 0, 0, 2, 50, 500], ['hairline']],
    }
    expect(figureBoxesFromOperators(operatorList, OPS)).toHaveLength(0)
  })

  test('touching images merge into one figure', () => {
    // A chart drawn as several images reads as one picture.
    const merged = mergeFigureBoxes([
      { x: 50, y: 400, width: 100, height: 100 },
      { x: 148, y: 400, width: 100, height: 100 },
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].width).toBeGreaterThanOrEqual(198)

    expect(boxesOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 20, width: 10, height: 10 },
    )).toBe(false)
  })

  test('text inside a figure is absorbed, not turned into a paragraph', () => {
    // The reported bug: axis labels and table cells were extracted out of the
    // image and dumped into the reflowed prose.
    const figures = [{ x: 50, y: 300, width: 300, height: 200 }]
    expect(lineIsInsideFigure({ y: 400, left: 60, right: 200 }, figures)).toBe(true)
    // Body text below the figure is still prose.
    expect(lineIsInsideFigure({ y: 200, left: 60, right: 500 }, figures)).toBe(false)
    // A line that starts inside but runs past the figure is not part of it.
    expect(lineIsInsideFigure({ y: 400, left: 60, right: 520 }, figures)).toBe(false)
  })

  test('figures are placed between the blocks they sit between', () => {
    // PDF y grows upward, so a figure at y=500 comes before a block at y=300.
    const blocks = [
      { type: 'heading', level: 1, text: 'Results', top: 700 },
      { type: 'paragraph', text: 'Below the chart.', top: 300 },
    ]
    const merged = mergeFiguresIntoBlocks(blocks, [
      { x: 50, y: 400, width: 300, height: 200, src: 'data:image/jpeg;base64,AAA' },
    ])
    expect(merged.map((block) => block.type)).toEqual(['heading', 'figure', 'paragraph'])
  })

  test('a figure renders as a tappable image', () => {
    const html = blocksToHtml([
      { type: 'figure', src: 'data:image/jpeg;base64,AAA', width: 300, height: 200 },
    ])
    expect(html).toContain('data-pdf-figure')
    expect(html).toContain('class="reflow-figure"')
    expect(html).toContain('src="data:image/jpeg;base64,AAA"')
  })

  test('reflow places figures into the page it belongs to', () => {
    const manifest = {
      pages: [{
        page: 1,
        width: 600,
        height: 800,
        items: [
          run('Chapter One', 72, 700, 24),
          run('Figure 1: sales', 90, 420, 8),      // inside the figure box
          run('The chart above shows the trend.', 72, 200, 10),
        ],
      }],
    }
    const figures = {
      pages: { 1: [{ x: 72, y: 380, width: 400, height: 200, src: 'data:image/jpeg;base64,AAA' }] },
    }

    const reflow = reflowPdfManifest(manifest, figures)
    const html = reflow.sections[0].html
    expect(html).toContain('data-pdf-figure')
    expect(html).toContain('The chart above shows the trend.')
    // The label painted inside the figure stays part of the picture.
    expect(html).not.toContain('Figure 1: sales')
  })

  test('reflow without figures still works', () => {
    const manifest = {
      pages: [{ page: 1, width: 600, height: 800, items: [run('Just some prose here.', 72, 400)] }],
    }
    expect(reflowPdfManifest(manifest).sections[0].html).toContain('Just some prose here.')
  })

  test('figures are extracted once, cached, and only when Reflow is used', () => {
    const page = read('pages/reader/[id].vue')
    // Extracting means rendering every page, so a reader who stays in Original
    // View must never pay for it.
    expect(page).toContain('watch(usePdfReflowView, (reflowing) => {')
    expect(page).toContain('ensurePdfFigures()')
    expect(page).toContain('pdfFigures: figures')
    expect(page).toContain('stored.pdfFigures')

    const figures = read('composables/usePdfFigures.js')
    // Crops are capped and yield between pages: this runs on a phone and the
    // result is stored with the book.
    expect(figures).toContain('MAX_FIGURE_PX')
    expect(figures).toContain('MAX_FIGURES_TOTAL')
    expect(figures).toContain("toDataURL('image/jpeg'")
  })

  test('tapping a figure opens the full-screen viewer, in both surfaces', () => {
    expect(read('components/mobile/ReaderPagedEpub.vue')).toContain('img[data-pdf-figure]')
    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).toContain('openFigureViewer')
    expect(reader).toContain('ReaderFigureViewer')
    // Swiping moves between every figure in the book, as WPS's preview does.
    expect(reader).toContain('allFigureSources')
  })
})

describe('PDF Original View controls', () => {
  test('zoom and page mode are real preferences', () => {
    const prefs = normalizeMobileReaderPrefs({ pdfZoom: 2, pdfPageMode: 'scroll' })
    expect(prefs.pdfZoom).toBe(2)
    expect(prefs.pdfPageMode).toBe('scroll')

    // Out-of-range values are clamped, not accepted.
    expect(normalizeMobileReaderPrefs({ pdfZoom: 99 }).pdfZoom).toBe(PDF_ZOOM_MAX)
    expect(normalizeMobileReaderPrefs({ pdfZoom: 0.1 }).pdfZoom).toBe(PDF_ZOOM_MIN)
    expect(normalizeMobileReaderPrefs({ pdfPageMode: 'nope' }).pdfPageMode).toBe('page')
  })

  test('fit-to-width really fits the width on mobile', () => {
    // The viewer trimmed a hardcoded 32px on top of the container's own padding,
    // so a mobile PDF page rendered at roughly 86% of the screen.
    const viewer = read('components/shared/PdfViewer.vue')
    expect(viewer).toContain('props.widthInset')
    expect(viewer).not.toMatch(/clientWidth \|\| 820\) - 32/)

    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).toContain(':width-inset="0"')
    expect(reader).toContain('prefs.pdfZoom')
    // And the PDF container no longer adds side padding of its own.
    expect(reader).toMatch(/\.reader-mobile-content\.is-pdf-reader\s*\{[^}]*\+ 10px\) 0/s)
  })

  test('page mode snaps one PDF page to the screen', () => {
    const viewer = read('components/shared/PdfViewer.vue')
    expect(viewer).toContain('is-paged')
    expect(viewer).toContain('scroll-snap-type: y mandatory')
    expect(viewer).toContain('scroll-snap-stop: always')
  })
})

describe('reading a PDF from a chosen page', () => {
  test('long-pressing a page offers to read from it', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    expect(reader).toContain('onPdfTouchStart')
    expect(reader).toContain('pdfPageAtPoint')
    expect(reader).toContain('readFromPressedPage')
    expect(reader).toContain('Read from page')
  })

  test('the resume choice knows where a PDF reader is looking', () => {
    const reader = read('components/mobile/ReaderMobile.vue')
    // Without a PDF branch, chunkAtVisiblePage fell through to the EPUB scroll
    // probe, which knows nothing about pages — so "start from this page" and
    // the resume prompt both had nothing to work with.
    expect(reader).toContain('if (props.isPdfRenderable) {')
    expect(reader).toContain('firstChunkForPage(props.pdfManifest, page)')
    expect(reader).toContain('shouldAskWhereToResume')
  })
})

describe('update prompt on every app open', () => {
  test('"Later" lasts exactly one app session', () => {
    const composable = read('composables/useAppUpdate.js')
    // sessionStorage is the lifetime asked for: it survives backgrounding and
    // dies when the app is closed.
    expect(composable).toContain('DEFERRED_VERSION_KEY')
    expect(composable).toContain('sessionStorage')
    expect(composable).toContain('writeDeferredCode(available.value.versionCode)')
    // A mandatory update ignores it, as it already ignores a skip.
    expect(composable).toContain('!manifest.mandatory')
  })

  test('resuming the app re-checks, not just a cold start', () => {
    const plugin = read('plugins/app-update.client.js')
    expect(plugin).toContain("App.addListener('resume'")
    expect(plugin).toContain('visibilitychange')
    // Resumes arrive in bursts; the manifest does not change that fast.
    expect(plugin).toContain('RESUME_RECHECK_INTERVAL_MS')
  })

  test('the modal offers update or later', () => {
    const modal = read('components/shared/AppUpdateModal.vue')
    expect(modal).toMatch(/>\s*Later\s*</)
    expect(modal).toMatch(/>\s*Update\s*</)
    // Skipping a version permanently is a bigger decision, so it is demoted.
    expect(modal).toContain('update-skip-link')
  })
})
