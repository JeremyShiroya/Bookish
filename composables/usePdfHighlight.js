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
    const leftRatio = startOffset / textLength
    const widthRatio = (endOffset - startOffset) / textLength
    const leftPadding = startOffset === 0 ? 2 : 0
    const rightPadding = endOffset === textLength ? 2 : 0

    if (!highlights[item.pageNumber]) highlights[item.pageNumber] = []

    highlights[item.pageNumber].push({
      left: Math.max(0, item.rect.left + (item.rect.width * leftRatio) - leftPadding),
      top: Math.max(0, item.rect.top - 1),
      width: (item.rect.width * widthRatio) + leftPadding + rightPadding,
      height: item.rect.height + 2,
    })
  }

  return highlights
}
