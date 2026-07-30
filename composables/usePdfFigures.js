// Figures for PDF Reflow — the images and tables WPS keeps when it reflows.
//
// WPS's reflow does not drop the non-text parts of a page: images stay inline
// and open full-screen on tap (swipe moves between them), and COMPLEX TABLES
// ARE CONVERTED TO IMAGES rather than rebuilt as markup. That last detail is
// the one worth copying — reconstructing an arbitrary PDF table as HTML is
// unreliable, and a picture of the table is always right.
//
// So a "figure" here is a rectangle of the page that is not prose, and it is
// produced by CROPPING THE RENDERED PAGE rather than by pulling out the
// embedded image stream. That handles all three cases with one mechanism:
// raster images, vector diagrams, and table grids.
//
// The image boxes come from the operator list, which is also what fixes the
// reported bug: text painted inside a figure (axis labels, table cells) used to
// be extracted and dumped into the reflowed prose as paragraphs. Any text line
// inside a figure box is now absorbed by the figure instead.

export const PDF_FIGURES_VERSION = 1

// Bounds, because this runs on a phone and the result is stored with the book.
// A figure narrower or shorter than this is a rule, a bullet or a logo.
const MIN_FIGURE_PT = 48
// Crops are capped rather than rendered at device resolution: a full-page
// figure at 3x on a large PDF is megabytes, and these are stored per book.
const MAX_FIGURE_PX = 1100
const JPEG_QUALITY = 0.72
// A page of a text book has a handful of figures. A page with hundreds is a
// vector drawing being reported operator by operator, and cropping each one
// would be both useless and ruinous.
const MAX_FIGURES_PER_PAGE = 6
const MAX_FIGURES_TOTAL = 300

// pdf.js reports image paints with the CURRENT transform on the stack, which
// already maps the unit square to the image's place on the page. Walking the
// operator list means tracking that stack ourselves.
const multiply = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
]

// The unit square through `m`, as an axis-aligned box in PDF user space.
const unitSquareBox = (m) => {
  const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]]
  const ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]]
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

export const boxesOverlap = (a, b) => (
  a.x < b.x + b.width && b.x < a.x + a.width
  && a.y < b.y + b.height && b.y < a.y + a.height
)

// Figures that touch are one figure — a chart and its legend are drawn as
// several images but read as a single picture.
export function mergeFigureBoxes(boxes, padding = 6) {
  const merged = []

  for (const box of boxes) {
    const grown = {
      x: box.x - padding,
      y: box.y - padding,
      width: box.width + padding * 2,
      height: box.height + padding * 2,
    }
    const hit = merged.find((existing) => boxesOverlap(existing, grown))
    if (!hit) {
      merged.push({ ...box })
      continue
    }
    const right = Math.max(hit.x + hit.width, box.x + box.width)
    const bottom = Math.max(hit.y + hit.height, box.y + box.height)
    hit.x = Math.min(hit.x, box.x)
    hit.y = Math.min(hit.y, box.y)
    hit.width = right - hit.x
    hit.height = bottom - hit.y
  }

  return merged
}

// Image boxes on one page, in PDF user space. Exported for testing without a
// real document.
export function figureBoxesFromOperators(operatorList, OPS) {
  const imageOps = new Set([
    OPS.paintImageXObject,
    OPS.paintImageXObjectRepeat,
    OPS.paintJpegXObject,
    OPS.paintInlineImageXObject,
  ])

  let ctm = [1, 0, 0, 1, 0, 0]
  const stack = []
  const boxes = []

  for (let i = 0; i < operatorList.fnArray.length; i += 1) {
    const fn = operatorList.fnArray[i]
    const args = operatorList.argsArray[i]

    if (fn === OPS.save) stack.push(ctm.slice())
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0]
    else if (fn === OPS.transform) ctm = multiply(ctm, args)
    else if (imageOps.has(fn)) {
      const box = unitSquareBox(ctm)
      if (box.width >= MIN_FIGURE_PT && box.height >= MIN_FIGURE_PT) boxes.push(box)
    }
  }

  return mergeFigureBoxes(boxes)
}

// A text line belongs to a figure when its baseline sits inside the figure's
// box. Those lines are the axis labels and table cells that used to be
// extracted and rendered as stray paragraphs in the reflowed text.
export function lineIsInsideFigure(line, figures) {
  return (figures || []).some((figure) => (
    line.y >= figure.y && line.y <= figure.y + figure.height
    && line.left >= figure.x - 4 && line.right <= figure.x + figure.width + 4
  ))
}

// Render one page once, then crop each figure out of it. Cropping the RENDER
// (rather than decoding the image stream) is what makes vector diagrams and
// table grids work as well as photographs.
async function cropFiguresFromPage(page, boxes, { signal } = {}) {
  if (!boxes.length) return []

  const unscaled = page.getViewport({ scale: 1 })
  // Scale so the widest figure lands near the cap, never above it.
  const widest = Math.max(...boxes.map((box) => box.width))
  const scale = Math.min(3, Math.max(1, MAX_FIGURE_PX / Math.max(1, widest)))
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d', { alpha: false })
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: context, viewport }).promise
  if (signal?.aborted) return []

  const crop = document.createElement('canvas')
  const cropContext = crop.getContext('2d', { alpha: false })
  const figures = []

  for (const box of boxes) {
    // PDF y grows upward; canvas y grows downward.
    const left = Math.max(0, Math.round(box.x * scale))
    const top = Math.max(0, Math.round((unscaled.height - box.y - box.height) * scale))
    const width = Math.min(canvas.width - left, Math.round(box.width * scale))
    const height = Math.min(canvas.height - top, Math.round(box.height * scale))
    if (width < 8 || height < 8) continue

    crop.width = width
    crop.height = height
    cropContext.drawImage(canvas, left, top, width, height, 0, 0, width, height)

    figures.push({
      ...box,
      src: crop.toDataURL('image/jpeg', JPEG_QUALITY),
    })
  }

  // Release the page canvas immediately — on a phone these are the largest
  // allocations the reflow makes.
  canvas.width = 0
  canvas.height = 0
  crop.width = 0
  crop.height = 0

  return figures
}

/**
 * Extract every figure in a PDF, page by page.
 *
 * @param {object} pdf  an already-open pdf.js document
 * @param {object} options  { onProgress(done, total), signal }
 * @returns {Promise<{version:number, pages:Record<number, object[]>}>}
 */
export async function extractPdfFigures(pdf, { onProgress, signal } = {}) {
  const pagesOut = {}
  if (!pdf?.numPages) return { version: PDF_FIGURES_VERSION, pages: pagesOut }

  const { OPS } = await import('pdfjs-dist')
  let total = 0

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (signal?.aborted || total >= MAX_FIGURES_TOTAL) break

    try {
      const page = await pdf.getPage(pageNumber)
      const operatorList = await page.getOperatorList()
      const boxes = figureBoxesFromOperators(operatorList, OPS).slice(0, MAX_FIGURES_PER_PAGE)

      if (boxes.length) {
        const figures = await cropFiguresFromPage(page, boxes, { signal })
        if (figures.length) {
          pagesOut[pageNumber] = figures
          total += figures.length
        }
      }
      page.cleanup?.()
    } catch (error) {
      // One unreadable page must not cost the whole document its figures.
      console.warn('[PdfFigures] Could not read figures on page', pageNumber, error)
    }

    onProgress?.(pageNumber, pdf.numPages)
    // Yield between pages so the reader stays responsive while this runs.
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  return { version: PDF_FIGURES_VERSION, pages: pagesOut }
}
