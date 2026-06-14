export function chunkIndexForSection(sectionCounts = [], oneBasedSection = 1) {
  if (!sectionCounts.length) return 0

  const sectionIndex = Math.max(0, Math.min(
    sectionCounts.length - 1,
    Math.floor(Number(oneBasedSection) || 1) - 1,
  ))
  let offset = 0

  for (let index = 0; index < sectionCounts.length; index += 1) {
    const count = Math.max(0, Number(sectionCounts[index]) || 0)
    if (index >= sectionIndex && count > 0) return offset
    offset += count
  }

  return Math.max(0, offset - 1)
}

export function sectionForChunkIndex(sectionCounts = [], chunkIndex = 0) {
  if (!sectionCounts.length) return 1

  const target = Math.max(0, Math.floor(Number(chunkIndex) || 0))
  let offset = 0
  let lastReadableSection = 1

  for (let index = 0; index < sectionCounts.length; index += 1) {
    const count = Math.max(0, Number(sectionCounts[index]) || 0)
    if (count > 0) {
      lastReadableSection = index + 1
      if (target < offset + count) return index + 1
    }
    offset += count
  }

  return lastReadableSection
}

export function pdfProgressForPage(page, totalPages) {
  const total = Math.max(1, Math.floor(Number(totalPages) || 1))
  const current = Math.max(1, Math.min(total, Math.floor(Number(page) || 1)))
  const progress = total > 1
    ? Math.round(((current - 1) / (total - 1)) * 100)
    : 100

  return {
    progress: Math.max(0, Math.min(100, progress)),
    status: progress > 95 ? 'Read' : current > 1 ? 'Reading' : 'Unread',
  }
}

export function visiblePageFromRects(rects = [], anchorY = 56) {
  if (!rects.length) return 1

  const visibleAtAnchor = rects.find(rect => (
    Number(rect.top) <= anchorY && Number(rect.bottom) > anchorY
  ))
  if (visibleAtAnchor) return Math.max(1, Number(visibleAtAnchor.page) || 1)

  const nearest = [...rects].sort((a, b) => (
    Math.abs(Number(a.top) - anchorY) - Math.abs(Number(b.top) - anchorY)
  ))[0]
  return Math.max(1, Number(nearest?.page) || 1)
}
