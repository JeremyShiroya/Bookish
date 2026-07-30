// WPS-style PDF reflow.
//
// WPS Office's reflow mode reorganises a fixed PDF page into a continuous flow
// for phone screens, preserving font style and multi-level heading hierarchy and
// letting the reader control font size, line spacing and background — the point
// being that pinch-zooming a fixed page on a phone is unusable. This is the same
// idea, built entirely on data the app already stores.
//
// The input is the PDF manifest (see usePdfManifest), whose per-page `items`
// carry `str` plus the full text transform. That gives x, y and font size for
// every text run, which is everything a reflow pass needs — no re-parsing, and
// it works offline.
//
// The output is HTML sections shaped exactly like EPUB chapters, so reflowed
// PDFs render through the existing EPUB surfaces and inherit paged/scroll mode,
// the typography controls, highlights, notes and narration highlighting for
// free. Each block keeps the manifest chunk ids it came from, which is what lets
// the reading position stay in sync with Original View.
//
// Deliberately text-only: figures and table grids are not reproduced. A reader
// who needs them switches back to Original View.

export const PDF_REFLOW_VERSION = 1

// ── Geometry from the text transform ────────────────────────────────────────
// A PDF text matrix is [a, b, c, d, e, f]: e/f are the position, and the font
// size falls out of the scale. `d` alone is wrong for rotated or skewed text,
// so the vertical scale is taken as the length of the second basis vector.

export function itemGeometry(item) {
  const t = Array.isArray(item?.transform) ? item.transform : [1, 0, 0, 1, 0, 0]
  const fontSize = Math.hypot(Number(t[2]) || 0, Number(t[3]) || 0) || Math.abs(Number(t[3])) || 0
  return {
    x: Number(t[4]) || 0,
    y: Number(t[5]) || 0,
    width: Number(item?.width) || 0,
    fontSize: Math.round(fontSize * 100) / 100,
  }
}

// ── 1. Line assembly ────────────────────────────────────────────────────────
// Runs sharing a baseline are one line. The tolerance scales with font size so
// large headings do not get split and dense footnotes do not get merged.

export function assembleLines(items = []) {
  const placed = items
    .map((item, index) => ({ item, index, ...itemGeometry(item) }))
    .filter((entry) => String(entry.item.str || '').trim().length > 0)

  if (!placed.length) return []

  // PDF y grows upward, so a page reads from high y to low y.
  placed.sort((a, b) => (b.y - a.y) || (a.x - b.x))

  const lines = []
  let current = null

  for (const entry of placed) {
    const tolerance = Math.max(2, entry.fontSize * 0.4)
    if (current && Math.abs(current.y - entry.y) <= tolerance) {
      current.entries.push(entry)
      current.y = (current.y * (current.entries.length - 1) + entry.y) / current.entries.length
    } else {
      current = { y: entry.y, entries: [entry] }
      lines.push(current)
    }
  }

  return lines.map((line) => {
    const entries = [...line.entries].sort((a, b) => a.x - b.x)
    const fontSizes = entries.map((entry) => entry.fontSize).filter(Boolean)
    const left = Math.min(...entries.map((entry) => entry.x))
    const right = Math.max(...entries.map((entry) => entry.x + entry.width))
    return {
      y: line.y,
      left,
      right,
      centre: (left + right) / 2,
      fontSize: fontSizes.length ? Math.max(...fontSizes) : 0,
      bold: entries.some((entry) => /bold|black|heavy|semibold/i.test(String(entry.item.fontName || ''))),
      text: joinRuns(entries),
      itemIndexes: entries.map((entry) => entry.index),
    }
  })
}

// PDF text runs carry no spaces of their own when the producer positions each
// word, so a gap wider than a fraction of the font size means a space.
function joinRuns(entries) {
  let text = ''
  let previousRight = null
  let previousSize = 0

  for (const entry of entries) {
    const chunk = String(entry.item.str || '')
    if (!chunk) continue
    if (previousRight !== null) {
      const gap = entry.x - previousRight
      const needsSpace = gap > Math.max(0.8, previousSize * 0.18)
      if (needsSpace && !/\s$/.test(text) && !/^\s/.test(chunk)) text += ' '
    }
    text += chunk
    previousRight = entry.x + entry.width
    previousSize = entry.fontSize || previousSize
  }

  return text.replace(/\s+/g, ' ').trim()
}

// ── 2. Column detection ─────────────────────────────────────────────────────
// Two-column pages are found by clustering line centres: if the centres fall
// into two groups separated by a real gutter, and both groups run down the page,
// the page is two columns and reads column-major.

export function detectColumns(lines, pageWidth) {
  if (lines.length < 6 || !pageWidth) return [lines]

  const middle = pageWidth / 2
  const left = lines.filter((line) => line.right < middle + pageWidth * 0.04)
  const right = lines.filter((line) => line.left > middle - pageWidth * 0.04)

  // Both sides must carry real content, and together account for the page —
  // otherwise this is a single column with a stray indent.
  const covered = left.length + right.length
  if (left.length < 3 || right.length < 3 || covered < lines.length * 0.85) return [lines]

  return [left, right]
}

// ── 3. Header / footer removal ──────────────────────────────────────────────
// Running heads and page numbers are noise once the page boundary is gone. A
// line is dropped when it sits in a margin band AND is either a bare number or
// text that repeats across many pages.

const isBareNumber = (text) => /^[ivxlcdm\d]+$/i.test(String(text || '').trim())

export function collectRepeatedMarginText(pages, marginRatio = 0.08) {
  const counts = new Map()

  for (const page of pages) {
    const height = Number(page?.height) || 0
    if (!height) continue
    const band = height * marginRatio
    for (const line of page.lines || []) {
      if (line.y < band || line.y > height - band) {
        const key = String(line.text || '').trim().toLowerCase()
        if (key && !isBareNumber(key)) counts.set(key, (counts.get(key) || 0) + 1)
      }
    }
  }

  // "Appears on at least a third of the pages, and on more than two" — a phrase
  // that recurs that reliably in a margin is furniture, not prose.
  const threshold = Math.max(3, Math.ceil(pages.length / 3))
  return new Set([...counts.entries()].filter(([, count]) => count >= threshold).map(([key]) => key))
}

export function stripRunningHeads(lines, pageHeight, repeated, marginRatio = 0.08) {
  const band = (Number(pageHeight) || 0) * marginRatio
  if (!band) return lines
  return lines.filter((line) => {
    const inMargin = line.y < band || line.y > pageHeight - band
    if (!inMargin) return true
    const key = String(line.text || '').trim().toLowerCase()
    return !(isBareNumber(key) || repeated.has(key))
  })
}

// ── 4. Heading detection ────────────────────────────────────────────────────
// The body font size is the page set's most common size. Anything meaningfully
// larger (or bold and short) is a heading, ranked into h1–h3 by size so the
// multi-level hierarchy survives.

export function modalFontSize(lines) {
  const counts = new Map()
  for (const line of lines) {
    const size = Math.round((line.fontSize || 0) * 2) / 2
    if (size > 0) counts.set(size, (counts.get(size) || 0) + String(line.text || '').length)
  }
  let best = 0
  let bestWeight = -1
  for (const [size, weight] of counts) {
    if (weight > bestWeight) { best = size; bestWeight = weight }
  }
  return best
}

export function headingLevelFor(line, bodySize, headingSizes) {
  if (!bodySize) return 0
  const size = line.fontSize || 0
  const short = String(line.text || '').trim().length <= 90

  if (size >= bodySize * 1.15 && short) {
    const rank = headingSizes.indexOf(Math.round(size * 2) / 2)
    return Math.min(3, (rank === -1 ? headingSizes.length : rank) + 1)
  }
  // Bold, short and standing alone: a run-in heading at body size.
  if (line.bold && short && size >= bodySize * 0.98) return 3
  return 0
}

// ── 5. Paragraph merging ────────────────────────────────────────────────────

const BULLET = /^\s*([•·▪◦‣–-]|\*)\s+/
const NUMBERED = /^\s*(\d{1,3}|[a-z]|[ivxlcdm]{1,5})[.)]\s+/i

// A line ends a paragraph if it stops well short of the column's right edge, or
// the next line is indented, or the vertical gap exceeds normal leading.
function endsParagraph(line, next, columnRight, bodySize) {
  if (!next) return true
  const gap = line.y - next.y
  if (bodySize && gap > bodySize * 1.8) return true
  if (columnRight && line.right < columnRight - bodySize * 1.5) return true
  if (next.left > line.left + bodySize * 0.8) return true
  return false
}

// Words broken across a line break are rejoined; every other break becomes a
// space, which is what makes the text reflow to any width.
function appendLine(paragraph, text) {
  if (!paragraph) return text
  if (/[‐-―-]$/.test(paragraph)) return `${paragraph.replace(/[‐-―-]$/, '')}${text}`
  return `${paragraph} ${text}`
}

// ── Block building ──────────────────────────────────────────────────────────

export function blocksForLines(lines, { bodySize, headingSizes, columnRight }) {
  const blocks = []
  let paragraph = null

  const flush = () => {
    if (paragraph && paragraph.text.trim()) blocks.push(paragraph)
    paragraph = null
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const next = lines[index + 1]
    const text = String(line.text || '').trim()
    if (!text) continue

    const level = headingLevelFor(line, bodySize, headingSizes)
    if (level) {
      flush()
      blocks.push({ type: 'heading', level, text, itemIndexes: [...line.itemIndexes] })
      continue
    }

    const bullet = BULLET.test(text)
    const numbered = !bullet && NUMBERED.test(text)
    if (bullet || numbered) {
      flush()
      blocks.push({
        type: 'list-item',
        ordered: numbered,
        text: text.replace(bullet ? BULLET : NUMBERED, ''),
        itemIndexes: [...line.itemIndexes],
      })
      continue
    }

    if (!paragraph) paragraph = { type: 'paragraph', text: '', itemIndexes: [] }
    paragraph.text = appendLine(paragraph.text, text)
    paragraph.itemIndexes.push(...line.itemIndexes)

    if (endsParagraph(line, next, columnRight, bodySize)) flush()
  }

  flush()
  return blocks
}

// ── HTML ────────────────────────────────────────────────────────────────────

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

// Consecutive list items collapse into one list, so the reflowed markup is the
// same shape an EPUB chapter would have.
export function blocksToHtml(blocks) {
  const out = []
  let list = null

  const closeList = () => {
    if (!list) return
    out.push(`<${list.tag}>${list.items.join('')}</${list.tag}>`)
    list = null
  }

  for (const block of blocks) {
    if (block.type === 'list-item') {
      const tag = block.ordered ? 'ol' : 'ul'
      if (list && list.tag !== tag) closeList()
      if (!list) list = { tag, items: [] }
      list.items.push(`<li>${escapeHtml(block.text)}</li>`)
      continue
    }

    closeList()
    if (block.type === 'heading') {
      out.push(`<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`)
    } else {
      out.push(`<p>${escapeHtml(block.text)}</p>`)
    }
  }

  closeList()
  return out.join('\n')
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Reflow a whole PDF manifest into EPUB-shaped sections.
 *
 * @returns {{version:number, sections:{title:string,html:string,page:number}[], empty:boolean}}
 *   `empty` is true for a PDF with no text layer (a scan) — the caller offers
 *   Reflow disabled rather than rendering a blank reader.
 */
export function reflowPdfManifest(manifest) {
  const pageRecords = manifest?.pages || []
  if (!pageRecords.length) return { version: PDF_REFLOW_VERSION, sections: [], empty: true }

  const pages = pageRecords.map((page) => ({
    page: page.page,
    width: Number(page.width) || 0,
    height: Number(page.height) || 0,
    lines: assembleLines(page.items || []),
  }))

  const repeated = collectRepeatedMarginText(pages)

  // Heading ranks are decided across the WHOLE document: a size that is a
  // chapter title on one page must not become a subheading on the next.
  const allLines = pages.flatMap((page) => stripRunningHeads(page.lines, page.height, repeated))
  const bodySize = modalFontSize(allLines)
  const headingSizes = [...new Set(
    allLines
      .map((line) => Math.round((line.fontSize || 0) * 2) / 2)
      .filter((size) => bodySize && size >= bodySize * 1.15),
  )].sort((a, b) => b - a)

  const sections = []
  for (const page of pages) {
    const kept = stripRunningHeads(page.lines, page.height, repeated)
    if (!kept.length) continue

    const blocks = detectColumns(kept, page.width).flatMap((column) => {
      const columnRight = column.length ? Math.max(...column.map((line) => line.right)) : 0
      return blocksForLines(column, { bodySize, headingSizes, columnRight })
    })
    if (!blocks.length) continue

    const html = blocksToHtml(blocks)
    if (!html) continue

    const firstHeading = blocks.find((block) => block.type === 'heading')
    sections.push({
      page: page.page,
      title: firstHeading?.text || `Page ${page.page}`,
      html,
    })
  }

  return {
    version: PDF_REFLOW_VERSION,
    sections,
    empty: sections.length === 0,
  }
}
