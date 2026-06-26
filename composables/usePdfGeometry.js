import { chunkForId, wordSpansWithinChunk } from './usePdfManifest.js'

function multiply(first, second) {
  return [
    first[0] * second[0] + first[2] * second[1],
    first[1] * second[0] + first[3] * second[1],
    first[0] * second[2] + first[2] * second[3],
    first[1] * second[2] + first[3] * second[3],
    first[0] * second[4] + first[2] * second[5] + first[4],
    first[1] * second[4] + first[3] * second[5] + first[5],
  ]
}

export function itemSpanRect(item, span, viewportTransform) {
  const value = String(item?.str || '')
  if (!value || !Array.isArray(viewportTransform)) return null

  const start = Math.max(0, Math.min(value.length, Number(span?.start) || 0))
  const end = Math.max(start, Math.min(value.length, Number(span?.end) || 0))
  if (end <= start) return null

  const transform = multiply(viewportTransform, item.transform || [1, 0, 0, 1, 0, 0])
  const viewportScale = Math.hypot(viewportTransform[0], viewportTransform[1]) || 1
  const fullWidth = Math.abs((Number(item.width) || 0) * viewportScale)
  const height = Math.max(
    1,
    Math.hypot(transform[2], transform[3]),
    Math.abs((Number(item.height) || 0) * viewportScale),
  )
  const leftRatio = start / value.length
  const rightRatio = end / value.length

  return {
    left: transform[4] + fullWidth * leftRatio,
    top: transform[5] - height,
    width: Math.max(1, fullWidth * (rightRatio - leftRatio)),
    height,
  }
}

export function spansToRects(page, spans, viewportTransform) {
  if (!page || !Array.isArray(spans) || !spans.length) return []

  const rects = spans
    .map(span => itemSpanRect(page.items?.[span.itemIndex], span, viewportTransform))
    .filter(Boolean)

  const merged = []
  for (const rect of rects) {
    const previous = merged[merged.length - 1]
    const sameLine = previous && Math.abs(previous.top - rect.top) <= Math.max(
      2,
      Math.min(previous.height, rect.height) * 0.35,
    )
    const gap = previous ? rect.left - (previous.left + previous.width) : Infinity
    const closeEnough = gap >= -1 && gap <= Math.max(previous?.height || 0, rect.height) * 1.5

    if (sameLine && closeEnough) {
      const right = Math.max(previous.left + previous.width, rect.left + rect.width)
      previous.top = Math.min(previous.top, rect.top)
      previous.height = Math.max(previous.height, rect.height)
      previous.width = right - previous.left
    } else {
      merged.push({ ...rect })
    }
  }

  return merged
}

export function chunkHighlightRects(manifest, chunkId, viewportTransform) {
  const chunk = chunkForId(manifest, chunkId)
  if (!chunk) return []
  const page = manifest?.pages?.find(entry => entry.page === chunk.page)
  if (!page) return []
  return spansToRects(page, chunk.spans, viewportTransform)
}

export function chunkSubRangeRects(manifest, chunkId, charStart, charEnd, viewportTransform) {
  const chunk = chunkForId(manifest, chunkId)
  if (!chunk) return []
  const page = manifest?.pages?.find(entry => entry.page === chunk.page)
  if (!page) return []
  const spans = wordSpansWithinChunk(manifest, chunkId, charStart, charEnd)
  return spansToRects(page, spans, viewportTransform)
}

export function pagesToRender(visiblePages, total, margin = 2) {
  const safeTotal = Math.max(0, Number(total) || 0)
  if (!safeTotal) return []
  const safeMargin = Math.max(0, Number(margin) || 0)

  const set = new Set()
  for (const value of (visiblePages || [])) {
    const page = Number(value)
    if (!Number.isFinite(page)) continue
    for (let i = page - safeMargin; i <= page + safeMargin; i += 1) {
      if (i >= 1 && i <= safeTotal) set.add(i)
    }
  }

  return [...set].sort((a, b) => a - b)
}

export function scrollTargetForChunk(manifest, chunkId, viewportTransform) {
  const chunk = chunkForId(manifest, chunkId)
  if (!chunk) return null
  const first = chunkHighlightRects(manifest, chunkId, viewportTransform)[0]
  return {
    page: chunk.page,
    top: first?.top ?? 0,
    left: first?.left ?? 0,
  }
}
