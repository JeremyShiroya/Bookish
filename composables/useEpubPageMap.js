// Whole-book page map for the mobile paged EPUB reader.
//
// ReadEra-style: pages are real, measured layout columns — not estimates.
// Each section is laid out once (offscreen, in idle time) with the exact
// reader geometry and typography; the result is the page count per section
// plus the page every sentence chunk starts on. The map is cached per
// book + viewport + typography, so reopening a book shows correct global
// page numbers instantly.

export const EPUB_PAGE_MAP_PREFIX = 'bookish:page-map:'
// v2 adds per-section scroll heights (used by the scroll reader to reserve
// exact placeholder space, so a fast fling never lands on an un-sized gap).
const PAGE_MAP_VERSION = 2
const MAX_CACHED_MAPS = 12

export function pageMapCacheKey(bookId, { width, height, layoutHash, sectionCount }) {
  return `${EPUB_PAGE_MAP_PREFIX}${bookId}:${width}x${height}:${layoutHash}:${sectionCount}`
}

export function readPageMapCache(key, storage = globalThis.localStorage) {
  if (!storage) return null
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null')
    if (parsed?.version !== PAGE_MAP_VERSION) return null
    if (!Array.isArray(parsed.counts) || !Array.isArray(parsed.chunkPages)) return null
    return {
      counts: parsed.counts,
      chunkPages: parsed.chunkPages,
      heights: Array.isArray(parsed.heights) ? parsed.heights : null,
    }
  } catch {
    return null
  }
}

export function writePageMapCache(key, map, storage = globalThis.localStorage) {
  if (!storage) return
  try {
    prunePageMapCache(storage)
    storage.setItem(key, JSON.stringify({
      version: PAGE_MAP_VERSION,
      savedAt: Date.now(),
      counts: map.counts,
      chunkPages: map.chunkPages,
      heights: map.heights || null,
    }))
  } catch {
    // Quota exceeded just means the map is recomputed next open.
  }
}

// Keep only the most recent page maps so old viewports/typography don't pile up.
export function prunePageMapCache(storage = globalThis.localStorage) {
  if (!storage) return
  try {
    const entries = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (!key?.startsWith(EPUB_PAGE_MAP_PREFIX)) continue
      let savedAt = 0
      try { savedAt = JSON.parse(storage.getItem(key) || '{}').savedAt || 0 } catch {}
      entries.push({ key, savedAt })
    }
    if (entries.length < MAX_CACHED_MAPS) return
    entries.sort((a, b) => a.savedAt - b.savedAt)
    for (const entry of entries.slice(0, entries.length - MAX_CACHED_MAPS + 1)) {
      storage.removeItem(entry.key)
    }
  } catch {}
}

// ── Pure numbering helpers ──────────────────────────────────────────────────

export function totalPagesInMap(counts) {
  return (counts || []).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0)
}

// 0-based global page for (section, pageInSection). Returns null while the
// sections before `section` haven't been measured yet.
export function globalPageFor(counts, section, pageInSection) {
  const list = counts || []
  let offset = 0
  for (let i = 0; i < section; i += 1) {
    const count = Number(list[i])
    if (!Number.isFinite(count) || count <= 0) return null
    offset += count
  }
  return offset + Math.max(0, Number(pageInSection) || 0)
}

// Inverse of globalPageFor: which section/page a 0-based global page lands in.
export function locateGlobalPage(counts, globalPage) {
  const list = counts || []
  const target = Math.max(0, Number(globalPage) || 0)
  let offset = 0
  for (let section = 0; section < list.length; section += 1) {
    const count = Math.max(0, Number(list[section]) || 0)
    if (target < offset + count) return { section, pageInSection: target - offset }
    offset += count
  }
  const lastSection = Math.max(0, list.length - 1)
  return { section: lastSection, pageInSection: Math.max(0, (list[lastSection] || 1) - 1) }
}

// First chunk that starts on `globalPage` (0-based); -1 when none is known.
export function firstChunkOnPage(chunkPages, globalPage) {
  const list = chunkPages || []
  const target = Math.max(0, Number(globalPage) || 0)
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] === target) return i
  }
  // No chunk starts exactly there (image-only page) — nearest following chunk.
  for (let i = 0; i < list.length; i += 1) {
    if (Number.isFinite(list[i]) && list[i] > target) return i
  }
  return -1
}
