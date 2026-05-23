const escapeHtml = (str) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

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

async function extractPdfOutline(pdf) {
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

export async function extractPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const source = arrayBuffer.slice(0)

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString()

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise
    const numPages = pdf.numPages
    let tocItems = await extractPdfOutline(pdf)
    const pageLinesForToc = []
    let html = ''

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      const items = textContent.items.filter(item => item.str && item.str.trim())
      if (!items.length) continue

      // Group items into lines by Y coordinate (PDF coords are bottom-up)
      const lineMap = new Map()
      for (const item of items) {
        const y = Math.round(item.transform[5])
        let bucket = null
        for (const key of lineMap.keys()) {
          if (Math.abs(key - y) <= 3) {
            bucket = key
            break
          }
        }
        if (bucket === null) {
          lineMap.set(y, [item.str])
        } else {
          lineMap.get(bucket).push(item.str)
        }
      }

      const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
      const lines = sortedYs.map(y => ({ y, text: lineMap.get(y).join('') }))
      pageLinesForToc.push({ page: pageNum, lines: lines.map(line => line.text) })

      const paragraphs = []
      let para = []
      let lastY = null

      for (const line of lines) {
        const gap = lastY !== null ? lastY - line.y : 0
        if (lastY !== null && gap > 18) {
          if (para.length) paragraphs.push(para.join(' '))
          para = [line.text.trim()]
        } else {
          para.push(line.text.trim())
        }
        lastY = line.y
      }
      if (para.length) paragraphs.push(para.join(' '))

      const pageHtml = paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => `<p>${escapeHtml(p)}</p>`)
        .join('\n')

      if (pageHtml) {
        html += pageHtml
        if (pageNum < pdf.numPages) html += '\n<hr class="chapter-break" />\n'
      }
    }

    if (!tocItems.length) {
      tocItems = extractVisiblePdfToc(pageLinesForToc)
    }

    return { content: html || null, pages: numPages, source, tocItems }
  } catch (error) {
    console.warn('[PDF] Text extraction failed; preserving original PDF source for page rendering.', error)
    return { content: null, pages: 0, source, tocItems: [] }
  }
}
