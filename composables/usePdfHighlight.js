export function normalizePdfHighlightText(value) {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function buildSearchIndex(value) {
  const text = []
  const map = []
  let pendingSpaceIndex = -1

  for (let i = 0; i < value.length; i++) {
    const char = value[i]

    if (/\s/.test(char)) {
      if (text.length > 0) pendingSpaceIndex = i
      continue
    }

    if (pendingSpaceIndex !== -1 && text.length > 0) {
      text.push(' ')
      map.push(pendingSpaceIndex)
    }

    text.push(char.toLowerCase())
    map.push(i)
    pendingSpaceIndex = -1
  }

  return { text: text.join(''), map }
}

function candidateNeedles(activeText) {
  const normalized = normalizePdfHighlightText(activeText)
  if (!normalized) return []

  const candidates = [normalized]
  for (const length of [120, 96, 72, 48]) {
    if (normalized.length > length) {
      candidates.push(normalized.slice(0, length))
    }
  }

  return [...new Set(candidates)]
}

export function findPdfHighlightRange(flatText, activeText) {
  if (!flatText || !activeText) return null

  const index = buildSearchIndex(flatText)
  if (!index.text) return null

  for (const needle of candidateNeedles(activeText)) {
    const position = index.text.indexOf(needle)
    if (position === -1) continue

    const last = position + needle.length - 1
    return {
      start: index.map[position],
      end: index.map[last],
    }
  }

  return null
}

export function findPdfChunkRange(flatText, chunks, chunkIndex) {
  if (!flatText || !Array.isArray(chunks) || chunkIndex < 0 || chunkIndex >= chunks.length) {
    return null
  }

  const index = buildSearchIndex(flatText)
  let searchFrom = 0

  for (let currentIndex = 0; currentIndex <= chunkIndex; currentIndex += 1) {
    let position = -1
    let matchedLength = 0

    for (const needle of candidateNeedles(chunks[currentIndex])) {
      position = index.text.indexOf(needle, searchFrom)
      if (position !== -1) {
        matchedLength = needle.length
        break
      }
    }

    if (position === -1) return null
    if (currentIndex === chunkIndex) {
      return {
        start: index.map[position],
        end: index.map[position + matchedLength - 1],
      }
    }
    searchFrom = position + Math.max(1, matchedLength)
  }

  return null
}

export function mergePdfHighlightRects(rects) {
  const merged = []

  for (const rect of rects) {
    const previous = merged[merged.length - 1]
    if (!previous) {
      merged.push({ ...rect })
      continue
    }

    const sameLineTolerance = Math.max(2, Math.min(previous.height, rect.height) * 0.35)
    const gap = rect.left - (previous.left + previous.width)
    const maxGap = Math.max(previous.height, rect.height) * 1.5
    const sameLine = Math.abs(rect.top - previous.top) <= sameLineTolerance

    if (sameLine && gap >= -1 && gap <= maxGap) {
      const right = Math.max(previous.left + previous.width, rect.left + rect.width)
      previous.top = Math.min(previous.top, rect.top)
      previous.height = Math.max(previous.height, rect.height)
      previous.width = right - previous.left
      continue
    }

    merged.push({ ...rect })
  }

  return merged
}

export function highlightsForPdfRange(textItemRefs, range) {
  if (!range) return {}

  const highlights = {}

  for (const item of textItemRefs) {
    const overlapStart = Math.max(item.start, range.start)
    const overlapEnd = Math.min(item.end, range.end)
    if (overlapStart > overlapEnd) continue

    const textLength = item.end - item.start + 1
    if (textLength <= 0) continue

    const startOffset = overlapStart - item.start
    const endOffset = overlapEnd - item.start + 1
    const advances = item.advances
    const measuredWidth = Array.isArray(advances) && advances.length === textLength + 1
      ? advances[textLength]
      : 0
    const leftRatio = measuredWidth > 0
      ? advances[startOffset] / measuredWidth
      : startOffset / textLength
    const rightRatio = measuredWidth > 0
      ? advances[endOffset] / measuredWidth
      : endOffset / textLength
    const edgePadding = 2

    if (!highlights[item.pageNumber]) highlights[item.pageNumber] = []

    highlights[item.pageNumber].push({
      left: Math.max(0, item.rect.left + (item.rect.width * leftRatio) - edgePadding),
      top: Math.max(0, item.rect.top - 1),
      width: (item.rect.width * (rightRatio - leftRatio)) + (edgePadding * 2),
      height: item.rect.height + 2,
    })
  }

  for (const pageNumber of Object.keys(highlights)) {
    highlights[pageNumber] = mergePdfHighlightRects(highlights[pageNumber])
  }

  return highlights
}
