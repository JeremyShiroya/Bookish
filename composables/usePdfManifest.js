export const PDF_MANIFEST_VERSION = 2

const SENTENCE_MAX_CHARS = 480
const SENTENCE_PATTERN = /[^.!?]+(?:[.!?]+["'’”»)\]]*)?|[.!?]+/g

function normalizeItem(item = {}) {
  return {
    str: String(item.str || ''),
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    transform: Array.isArray(item.transform)
      ? item.transform.slice(0, 6).map(value => Number(value) || 0)
      : [1, 0, 0, 1, 0, 0],
    hasEOL: !!item.hasEOL,
  }
}

function shouldInsertSpace(previous, current) {
  if (!previous || !current) return false
  if (/[\s([{/$-]$/.test(previous)) return false
  if (/^[\s,.;:!?%)}\]]/.test(current)) return false
  return true
}

function appendPageText(items) {
  const characters = []
  const points = []
  let pendingSpace = null

  const appendSpace = (point = null) => {
    if (!characters.length || characters[characters.length - 1] === ' ') return
    characters.push(' ')
    points.push(point)
  }

  items.forEach((item, itemIndex) => {
    const value = item.str
    const firstVisible = value.match(/\S/)?.[0] || ''
    const previousVisible = [...characters].reverse().find(char => char !== ' ') || ''

    if (
      characters.length
      && (pendingSpace || item.hasEOL || shouldInsertSpace(previousVisible, firstVisible))
    ) {
      appendSpace(pendingSpace)
    }

    pendingSpace = null
    for (let offset = 0; offset < value.length; offset += 1) {
      const char = value[offset]
      if (/\s/.test(char)) {
        pendingSpace ||= { itemIndex, offset }
        continue
      }
      if (pendingSpace) appendSpace(pendingSpace)
      characters.push(char)
      points.push({ itemIndex, offset })
      pendingSpace = null
    }

    if (item.hasEOL) pendingSpace = null
  })

  return { text: characters.join('').trim(), points }
}

function splitRangeByWords(text, start, end, maxChars) {
  if (end - start <= maxChars) return [{ start, end }]

  const ranges = []
  let cursor = start
  while (cursor < end) {
    let next = Math.min(end, cursor + maxChars)
    if (next < end) {
      const breakAt = text.lastIndexOf(' ', next)
      if (breakAt > cursor) next = breakAt
    }
    ranges.push({ start: cursor, end: next })
    cursor = next
    while (cursor < end && /\s/.test(text[cursor])) cursor += 1
  }
  return ranges
}

function sentenceRanges(text, maxChars = SENTENCE_MAX_CHARS) {
  const ranges = []
  for (const match of text.matchAll(SENTENCE_PATTERN)) {
    let start = match.index
    let end = start + match[0].length
    while (start < end && /\s/.test(text[start])) start += 1
    while (end > start && /\s/.test(text[end - 1])) end -= 1
    if (start < end) ranges.push(...splitRangeByWords(text, start, end, maxChars))
  }

  if (!ranges.length && text.trim()) {
    const start = text.search(/\S/)
    ranges.push(...splitRangeByWords(text, start, text.trimEnd().length, maxChars))
  }
  return ranges
}

function spansForRange(points, start, end) {
  const spans = []
  let active = null

  for (let index = start; index < end; index += 1) {
    const point = points[index]
    if (!point) continue

    if (
      !active
      || active.itemIndex !== point.itemIndex
      || active.end !== point.offset
    ) {
      active = {
        itemIndex: point.itemIndex,
        start: point.offset,
        end: point.offset + 1,
      }
      spans.push(active)
    } else {
      active.end = point.offset + 1
    }
  }

  return spans
}

export function buildPdfManifest(pageRecords = []) {
  const pages = []
  const chunks = []

  pageRecords.forEach((record, pageIndex) => {
    const pageNumber = Math.max(1, Number(record?.page) || pageIndex + 1)
    const items = (record?.items || []).map(normalizeItem)
    const { text, points } = appendPageText(items)
    const chunkIds = []

    for (const range of sentenceRanges(text)) {
      const spans = spansForRange(points, range.start, range.end)
      if (!spans.length) continue
      const id = chunks.length
      chunks.push({
        id,
        page: pageNumber,
        text: text.slice(range.start, range.end),
        textStart: range.start,
        spans,
      })
      chunkIds.push(id)
    }

    pages.push({
      page: pageNumber,
      width: Number(record?.width) || 0,
      height: Number(record?.height) || 0,
      items,
      chunkIds,
    })
  })

  return {
    version: PDF_MANIFEST_VERSION,
    pages,
    chunks,
  }
}

const _pagePointsCache = new WeakMap()

function pagePointsFor(page) {
  const items = page?.items || []
  let cached = _pagePointsCache.get(items)
  if (!cached) {
    cached = appendPageText(items)
    _pagePointsCache.set(items, cached)
  }
  return cached
}

// Resolves a character range WITHIN a chunk's text (e.g. a TTS word boundary)
// to the participating PDF text-item spans, using the chunk's recorded
// page-text offset. No text search — pure arithmetic on the page's points.
export function wordSpansWithinChunk(manifest, chunkId, charStart, charEnd) {
  const chunk = chunkForId(manifest, chunkId)
  if (!chunk) return []
  const page = manifest?.pages?.find(entry => entry.page === chunk.page)
  if (!page) return []

  const { points } = pagePointsFor(page)
  const base = Number(chunk.textStart) || 0
  const textLen = chunk.text.length
  const start = base + Math.max(0, Math.min(textLen, Number(charStart) || 0))
  const end = base + Math.max(0, Math.min(textLen, Number(charEnd) || 0))
  if (end <= start) return []

  return spansForRange(points, start, end)
}

export function chunkForId(manifest, chunkId) {
  const id = Number(chunkId)
  if (!Number.isInteger(id) || id < 0) return null
  return manifest?.chunks?.find(chunk => chunk.id === id) || null
}

export function firstChunkForPage(manifest, pageNumber) {
  const target = Math.max(1, Number(pageNumber) || 1)
  const pages = manifest?.pages || []

  for (const page of pages) {
    if (page.page < target || !page.chunkIds?.length) continue
    return chunkForId(manifest, page.chunkIds[0])
  }
  return null
}

export function pageForChunk(manifest, chunkId) {
  return chunkForId(manifest, chunkId)?.page ?? null
}
