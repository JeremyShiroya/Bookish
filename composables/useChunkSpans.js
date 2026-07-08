// Shared sentence-chunk → DOM-span mapping.
//
// Wraps every readable chunk of a rendered section in a
// `<span data-tts-chunk="N">` so narration can highlight the exact sentence.
// Used by the desktop/scroll reader (pages/reader/[id].vue) and the mobile
// paged renderer (components/mobile/ReaderPagedEpub.vue).

export const normalizeForSearch = (value) => (value || '').replace(/\s+/g, ' ').trim()

export function decodeHtmlEntities(text) {
  if (!import.meta.client || !text) return text || ''
  if (!text.includes('&')) return text
  const el = document.createElement('textarea')
  // Protect raw "<" so the parser can't swallow following text as a tag
  el.innerHTML = text.replace(/</g, '&lt;')
  return el.value
}

export function unwrapTtsSpans(container) {
  container.querySelectorAll('span[data-tts-chunk]').forEach(span => {
    const parent = span.parentNode
    if (!parent) return
    while (span.firstChild) parent.insertBefore(span.firstChild, span)
    parent.removeChild(span)
    parent.normalize()
  })
}

export function buildTextIndex(container) {
  const map = []
  let text = ''

  const appendSpace = (node, offset) => {
    if (!text || text.endsWith(' ')) return
    text += ' '
    map.push({ node, offset: Math.min(offset, node.nodeValue.length), synthetic: true })
  }

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT
        if (node.parentElement?.closest('script, style')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    }
  )

  let node
  while ((node = walker.nextNode())) {
    const value = node.nodeValue
    for (let i = 0; i < value.length; i++) {
      const ch = value[i]
      const code = ch.charCodeAt(0)
      // Soft hyphens / zero-width chars are stripped from chunk targets too
      if (code === 0xAD || (code >= 0x200B && code <= 0x200D) || code === 0xFEFF) continue
      if (/\s/.test(ch)) {
        appendSpace(node, i)
      } else {
        text += ch
        map.push({ node, offset: i, synthetic: false })
      }
    }
    appendSpace(node, value.length)
  }

  return { text, map }
}

export function resolveRangePoint(map, index, direction) {
  let cursor = index
  while (cursor >= 0 && cursor < map.length && map[cursor]?.synthetic) {
    cursor += direction
  }
  return map[cursor] || null
}

// Wrap every chunk of ONE section in a <span data-tts-chunk> for highlighting.
// Matching is scoped to the section element and chunks are matched in order,
// so an identical sentence elsewhere can't steal the match. The whole sentence
// is matched when possible (exact start AND end); otherwise a prefix locates
// the start and a suffix pins the end, so length drift between the chunk text
// and the rendered DOM never clips the first or last letters.
// `registerSpan(chunkIdx, span)` receives each created span.
export function mapSectionChunks(sectionEl, chunks, baseIdx, registerSpan) {
  const { text, map } = buildTextIndex(sectionEl)
  if (!map.length) return
  const flatLower = text.toLowerCase()
  const ranges = []
  let searchFrom = 0

  for (let i = 0; i < chunks.length; i++) {
    const target = normalizeForSearch(decodeHtmlEntities(chunks[i])).toLowerCase()
    if (!target) continue

    let start = flatLower.indexOf(target, searchFrom)
    let end
    if (start !== -1) {
      // Exact whole-sentence match: both ends are real DOM positions.
      end = start + target.length - 1
    } else {
      const key = target.slice(0, Math.min(120, target.length))
      start = flatLower.indexOf(key, searchFrom)
      if (start === -1 && key.length > 48) start = flatLower.indexOf(key.slice(0, 48), searchFrom)
      if (start === -1) continue
      const suffix = target.slice(-Math.min(24, target.length))
      const suffixFrom = start + Math.max(0, target.length - suffix.length - 12)
      const suffixPos = flatLower.indexOf(suffix, suffixFrom)
      end = suffixPos !== -1 && suffixPos >= start
        ? suffixPos + suffix.length - 1
        : start + target.length - 1
    }
    end = Math.min(end, map.length - 1)
    ranges.push({ chunkIdx: baseIdx + i, start, end })
    searchFrom = end + 1
  }

  // Apply in reverse so wrapping earlier ranges doesn't invalidate later offsets.
  for (let i = ranges.length - 1; i >= 0; i--) {
    const info = ranges[i]
    const startPt = resolveRangePoint(map, info.start, 1)
    const endPt = resolveRangePoint(map, info.end, -1)
    if (!startPt || !endPt) continue

    const range = document.createRange()
    const endOffset = Math.min(endPt.node.nodeValue.length, endPt.offset + 1)
    try {
      range.setStart(startPt.node, startPt.offset)
      range.setEnd(endPt.node, endOffset)
      const span = document.createElement('span')
      span.dataset.ttsChunk = String(info.chunkIdx)
      span.appendChild(range.extractContents())
      range.insertNode(span)
      registerSpan?.(info.chunkIdx, span)
    } catch {
      // Overlapping or detached range — skip this chunk's highlight.
    }
  }
}
