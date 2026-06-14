import { buildPdfManifest } from './usePdfManifest.js'

const escapeHtml = (str) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function buildPdfPagesHtml(pageParagraphs = []) {
  return pageParagraphs
    .map((paragraphs, index) => {
      const content = (paragraphs || [])
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .map(value => `<p>${escapeHtml(value)}</p>`)
        .join('\n')
      return `<div data-pdf-page="${index + 1}">${content}</div>`
    })
    .join('\n<hr class="chapter-break" />\n')
}

export function formatPdfTocTitle(title, page) {
  const value = String(title || '').trim()
  const pageNumber = Number(page)
  if (!value || !Number.isFinite(pageNumber)) return value.replace(/\s+/g, ' ')

  const escapedPage = String(pageNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return value
    .replace(new RegExp(`(?:\\.{2,}|\\s{2,})\\s*${escapedPage}\\s*$`), '')
    .replace(/\.{2,}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function resolveOutlinePage(pdf, dest) {
  try {
    const resolvedDest = typeof dest === 'string'
      ? await pdf.getDestination(dest)
      : dest

    const pageRef = Array.isArray(resolvedDest) ? resolvedDest[0] : null
    if (!pageRef) return null

    if (typeof pageRef === 'number') return pageRef
    return (await pdf.getPageIndex(pageRef)) + 1
  } catch {
    return null
  }
}

export async function extractPdfOutline(pdf) {
  const outline = await pdf.getOutline()
  if (!outline?.length) return []

  const tocItems = []

  async function walk(items, level = 0) {
    for (const item of items) {
      const title = item.title?.replace(/\s+/g, ' ').trim()
      const page = await resolveOutlinePage(pdf, item.dest)

      if (title && page) {
        tocItems.push({ title, page, level })
      }

      if (item.items?.length) {
        await walk(item.items, level + 1)
      }
    }
  }

  await walk(outline)
  return tocItems
}

export const pdfSourceToBytes = async (source) => {
  if (!source) return null
  if (source instanceof Uint8Array) return source
  if (source instanceof ArrayBuffer) return new Uint8Array(source.slice(0))
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer())
  }
  if (typeof source === 'string') {
    const base64 = source.includes(',') ? source.split(',')[1] : source
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  return null
}

function bucketTextLines(items, tolerance = 3) {
  const buckets = []

  for (const item of items) {
    const text = item.str?.replace(/\s+/g, ' ').trim()
    if (!text) continue

    const x = item.transform?.[4] ?? 0
    const y = item.transform?.[5] ?? 0
    let bucket = buckets.find(line => Math.abs(line.y - y) <= tolerance)

    if (!bucket) {
      bucket = { y, items: [] }
      buckets.push(bucket)
    }

    bucket.items.push({ text, x })
  }

  return buckets
    .sort((a, b) => b.y - a.y)
    .map(line => ({
      y: line.y,
      text: line.items
        .sort((a, b) => a.x - b.x)
        .map(item => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }))
    .filter(line => line.text)
}

async function loadPdfDocument(source) {
  const bytes = await pdfSourceToBytes(source)
  if (!bytes?.byteLength) return null

  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString()

  return await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
}

async function collectPdfPageLines(pdf) {
  const pageLines = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const lines = bucketTextLines(textContent.items)

    if (lines.length) {
      pageLines.push({ page: pageNum, lines: lines.map(line => line.text) })
    }
  }

  return pageLines
}

async function collectPdfPageParagraphs(pdf) {
  const pageParagraphs = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const lines = bucketTextLines(textContent.items)
    const paragraphs = []
    let paragraph = []
    let lastY = null

    for (const line of lines) {
      const gap = lastY !== null ? lastY - line.y : 0
      if (lastY !== null && gap > 18) {
        if (paragraph.length) paragraphs.push(paragraph.join(' '))
        paragraph = [line.text.trim()]
      } else {
        paragraph.push(line.text.trim())
      }
      lastY = line.y
    }
    if (paragraph.length) paragraphs.push(paragraph.join(' '))
    pageParagraphs.push(paragraphs)
  }

  return pageParagraphs
}

async function collectPdfPageRecords(pdf) {
  const records = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent()
    records.push({
      page: pageNum,
      width: viewport.width,
      height: viewport.height,
      items: textContent.items
        .filter(item => typeof item?.str === 'string')
        .map(item => ({
          str: item.str,
          width: item.width,
          height: item.height,
          transform: item.transform,
          hasEOL: item.hasEOL,
        })),
    })
  }

  return records
}

function pageParagraphsFromRecords(records) {
  return records.map(record => {
    const lines = bucketTextLines(record.items)
    const paragraphs = []
    let paragraph = []
    let lastY = null

    for (const line of lines) {
      const gap = lastY !== null ? lastY - line.y : 0
      if (lastY !== null && gap > 18) {
        if (paragraph.length) paragraphs.push(paragraph.join(' '))
        paragraph = [line.text.trim()]
      } else {
        paragraph.push(line.text.trim())
      }
      lastY = line.y
    }
    if (paragraph.length) paragraphs.push(paragraph.join(' '))
    return paragraphs
  })
}

export function extractVisiblePdfToc(pageLines) {
  const tocItems = []
  const tocHeadingRe = /^(?:table\s+of\s+contents|contents)$/i
  const dotLeaderRe = /^(.{2,140}?)\s*\.{2,}\s*(\d{1,4})$/i
  const spacedPageRe = /^(.{2,110}?)\s{2,}(\d{1,4})$/i
  const noiseRe = /^(?:page|contents|table\s+of\s+contents)$/i
  let inToc = false
  let pagesScanned = 0

  for (const { lines } of pageLines) {
    const candidateLines = lines
      .map(line => line.trim())
      .filter(Boolean)
    const normalizedLines = candidateLines.map(line => line.replace(/\s+/g, ' ').trim())

    if (!inToc) {
      const headingIndex = normalizedLines.findIndex(line => tocHeadingRe.test(line))
      if (headingIndex === -1) continue
      inToc = true
      pagesScanned = 0
      candidateLines.splice(0, headingIndex + 1)
      normalizedLines.splice(0, headingIndex + 1)
    }

    pagesScanned++
    let entriesOnPage = 0

    for (let i = 0; i < candidateLines.length; i++) {
      const rawLine = candidateLines[i]
      const normalizedLine = normalizedLines[i] || rawLine.replace(/\s+/g, ' ').trim()
      if (noiseRe.test(normalizedLine)) continue

      const matches = [...normalizedLine.matchAll(/(.{2,140}?)\s*\.{2,}\s*(\d{1,4})(?=\s+[A-Z0-9]|\s*$)/g)]
      if (!matches.length) {
        const singleMatch = normalizedLine.match(dotLeaderRe) || rawLine.match(spacedPageRe)
        if (singleMatch) matches.push(singleMatch)
      }

      for (const match of matches) {
        const title = match[1]
          .replace(/\s+/g, ' ')
          .replace(/[.:;-]+$/, '')
          .trim()
        const page = Number(match[2])

        if (!title || Number.isNaN(page)) continue

        tocItems.push({
          title,
          page: Math.max(1, page),
          level: 0,
        })
        entriesOnPage++
      }
    }

    if (tocItems.length && entriesOnPage === 0) break
    if (pagesScanned >= 6) break
  }

  return tocItems
}

export async function extractPdfTocFromDocument(pdf, pageLines = null) {
  const outlineItems = await extractPdfOutline(pdf)
  if (outlineItems.length) return outlineItems

  const lines = pageLines ?? await collectPdfPageLines(pdf)
  return extractVisiblePdfToc(lines)
}

export async function extractPdfTocFromSource(source) {
  let pdf = null

  try {
    pdf = await loadPdfDocument(source)
    if (!pdf) return []
    return await extractPdfTocFromDocument(pdf)
  } catch (error) {
    console.warn('[PDF] Table of contents extraction failed.', error)
    return []
  } finally {
    try {
      await pdf?.destroy?.()
    } catch {}
  }
}

export async function extractPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const source = arrayBuffer.slice(0)

  try {
    const pdf = await loadPdfDocument(arrayBuffer)
    const numPages = pdf.numPages
    let tocItems = await extractPdfOutline(pdf)
    const pageRecords = await collectPdfPageRecords(pdf)
    const pageLinesForToc = pageRecords.map(record => ({
      page: record.page,
      lines: bucketTextLines(record.items).map(line => line.text),
    }))

    if (!tocItems.length) tocItems = extractVisiblePdfToc(pageLinesForToc)

    const html = buildPdfPagesHtml(pageParagraphsFromRecords(pageRecords))
    const pdfManifest = buildPdfManifest(pageRecords)
    return { content: html || null, pages: numPages, source, tocItems, pdfManifest }
  } catch (error) {
    console.warn('[PDF] Text extraction failed; preserving original PDF source for page rendering.', error)
    return { content: null, pages: 0, source, tocItems: [] }
  }
}

export async function extractPdfContentFromSource(source) {
  let pdf = null
  try {
    pdf = await loadPdfDocument(source)
    if (!pdf) return { content: null, pages: 0 }
    const pageRecords = await collectPdfPageRecords(pdf)
    return {
      content: buildPdfPagesHtml(pageParagraphsFromRecords(pageRecords)),
      pages: pdf.numPages,
      pdfManifest: buildPdfManifest(pageRecords),
    }
  } finally {
    try {
      await pdf?.destroy?.()
    } catch {}
  }
}

export async function extractPdfManifestFromSource(source) {
  let pdf = null
  try {
    pdf = await loadPdfDocument(source)
    if (!pdf) return null
    return buildPdfManifest(await collectPdfPageRecords(pdf))
  } finally {
    try {
      await pdf?.destroy?.()
    } catch {}
  }
}

export async function extractPdfTextFromSource(source) {
  const pdf = await loadPdfDocument(source)
  if (!pdf) return ''

  const pages = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const lines = bucketTextLines(textContent.items).map(line => line.text)

    if (lines.length) {
      pages.push(lines.join('\n'))
    }
  }

  return pages
    .join('\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
