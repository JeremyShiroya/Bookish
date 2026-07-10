import { describe, expect, it } from 'vitest'
import {
  firstChunkOnPage,
  globalPageFor,
  locateGlobalPage,
  pageMapCacheKey,
  readPageMapCache,
  totalPagesInMap,
  writePageMapCache,
} from '~/composables/useEpubPageMap'
import {
  DEFAULT_MOBILE_READER_PREFS,
  normalizeMobileReaderPrefs,
  readerPrefsLayoutHash,
} from '~/composables/useMobileReaderPrefs'

describe('useEpubPageMap numbering', () => {
  const counts = [3, 5, 2] // pages per section → 10 pages total

  it('sums total pages', () => {
    expect(totalPagesInMap(counts)).toBe(10)
    expect(totalPagesInMap([])).toBe(0)
  })

  it('maps section + page to a global page', () => {
    expect(globalPageFor(counts, 0, 0)).toBe(0)
    expect(globalPageFor(counts, 1, 0)).toBe(3)
    expect(globalPageFor(counts, 2, 1)).toBe(9)
  })

  it('returns null while earlier sections are unmeasured', () => {
    expect(globalPageFor([3, undefined, 2], 2, 0)).toBe(null)
  })

  it('locates a global page back to section + page', () => {
    expect(locateGlobalPage(counts, 0)).toEqual({ section: 0, pageInSection: 0 })
    expect(locateGlobalPage(counts, 3)).toEqual({ section: 1, pageInSection: 0 })
    expect(locateGlobalPage(counts, 9)).toEqual({ section: 2, pageInSection: 1 })
    // Past the end clamps to the last page.
    expect(locateGlobalPage(counts, 99)).toEqual({ section: 2, pageInSection: 1 })
  })

  it('finds the first chunk on a page, falling back to the next chunk', () => {
    const chunkPages = [0, 0, 1, 3, 3, 4]
    expect(firstChunkOnPage(chunkPages, 0)).toBe(0)
    expect(firstChunkOnPage(chunkPages, 1)).toBe(2)
    // Page 2 has no chunk start (image-only page) → nearest following chunk.
    expect(firstChunkOnPage(chunkPages, 2)).toBe(3)
    expect(firstChunkOnPage(chunkPages, 9)).toBe(-1)
  })

  it('round-trips the cache and rejects foreign shapes', () => {
    const backing = new Map()
    const storage = {
      get length() { return backing.size },
      key: (index) => [...backing.keys()][index] ?? null,
      getItem: (key) => (backing.has(key) ? backing.get(key) : null),
      setItem: (key, value) => backing.set(key, String(value)),
      removeItem: (key) => backing.delete(key),
    }
    const key = pageMapCacheKey('book-1', { width: 320, height: 480, layoutHash: 'a', sectionCount: 3 })
    // v2 carries per-section scroll heights alongside the page counts.
    const map = { counts, chunkPages: [0, 1, 2], heights: [900, 1500, 600] }
    writePageMapCache(key, map, storage)
    expect(readPageMapCache(key, storage)).toEqual(map)
    storage.setItem(key, '{"version":99}')
    expect(readPageMapCache(key, storage)).toBe(null)
    // An older v1 entry (no heights) is rejected, forcing a fresh measure.
    storage.setItem(key, '{"version":1,"counts":[1],"chunkPages":[0]}')
    expect(readPageMapCache(key, storage)).toBe(null)
  })
})

describe('useMobileReaderPrefs', () => {
  it('falls back to defaults for unknown values', () => {
    expect(normalizeMobileReaderPrefs(null)).toEqual(DEFAULT_MOBILE_READER_PREFS)
    expect(normalizeMobileReaderPrefs({ readingMode: 'diagonal', fontSize: 900, fontWeight: 123 }))
      .toEqual({ ...DEFAULT_MOBILE_READER_PREFS, fontSize: 24 })
  })

  it('keeps valid preferences', () => {
    const prefs = normalizeMobileReaderPrefs({
      readingMode: 'scroll',
      background: 'sepia',
      fontSize: 19,
      fontFamily: 'sans',
      fontWeight: 500,
      lineSpacing: 1.8,
      textAlign: 'left',
    })
    expect(prefs).toEqual({
      readingMode: 'scroll',
      background: 'sepia',
      fontSize: 19,
      fontFamily: 'sans',
      fontWeight: 500,
      lineSpacing: 1.8,
      textAlign: 'left',
    })
  })

  it('changes the layout hash only for layout-affecting prefs', () => {
    const base = readerPrefsLayoutHash(DEFAULT_MOBILE_READER_PREFS)
    expect(readerPrefsLayoutHash({ ...DEFAULT_MOBILE_READER_PREFS, background: 'sepia' })).toBe(base)
    expect(readerPrefsLayoutHash({ ...DEFAULT_MOBILE_READER_PREFS, readingMode: 'scroll' })).toBe(base)
    expect(readerPrefsLayoutHash({ ...DEFAULT_MOBILE_READER_PREFS, fontSize: 20 })).not.toBe(base)
    expect(readerPrefsLayoutHash({ ...DEFAULT_MOBILE_READER_PREFS, lineSpacing: 2 })).not.toBe(base)
  })
})
