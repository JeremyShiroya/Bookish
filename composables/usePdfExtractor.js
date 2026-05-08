const escapeHtml = (str) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function extractPdf(file) {
  const arrayBuffer = await file.arrayBuffer()

  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString()

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const numPages = pdf.numPages
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
      // Find a close-enough Y bucket (within 3 pts = same line)
      let bucket = null
      for (const key of lineMap.keys()) {
        if (Math.abs(key - y) <= 3) { bucket = key; break }
      }
      if (bucket === null) {
        lineMap.set(y, [item.str])
      } else {
        lineMap.get(bucket).push(item.str)
      }
    }

    // Sort lines top → bottom (descending Y in PDF space)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
    const lines = sortedYs.map(y => ({ y, text: lineMap.get(y).join('') }))

    // Merge lines into paragraphs; large vertical gaps = paragraph break
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

  return { content: html || null, pages: numPages }
}
