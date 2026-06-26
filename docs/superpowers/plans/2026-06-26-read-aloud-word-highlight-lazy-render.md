# Read-Aloud Word Highlight, Instant Highlight & Lazy PDF Render — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the word currently being spoken (two-tier, EPUB + PDF), show the sentence highlight instantly on play/seek with warmer prefetch, and rasterize only visible PDF pages — all keeping the cloud Edge TTS engine.

**Architecture:** A precomputed PDF manifest already maps each sentence chunk to page text-item spans; we extend it with a per-chunk `textStart` so a word's character range (from the TTS `boundaries`) resolves to overlay rectangles via shared geometry. EPUB reuses the reader's existing char→node mapping with the CSS Custom Highlight API. Lazy rendering splits cheap layout (page sizes + viewport transforms for all pages) from on-demand rasterization driven by the existing IntersectionObserver.

**Tech Stack:** Nuxt 4 / Vue 3 (SPA, `ssr: false`), PDF.js (`pdfjs-dist`), Vitest (`environment: 'nuxt'`), Microsoft Edge TTS (`msedge-tts`) via `/api/tts`.

**Spec:** `docs/superpowers/specs/2026-06-26-read-aloud-word-highlight-lazy-render-design.md`

**Build order / commits:** Tasks 1–4 deliver word-level highlight (#1), Task 5 delivers instant highlight (#2), Task 6 delivers lazy render (#3). Each task is its own commit.

**Test command:** `npx vitest run <file>` (there is no `npm test` script). Full suite: `npx vitest run`.

---

## File Structure

- `composables/usePdfManifest.js` — add `textStart` per chunk; add `wordSpansWithinChunk()`. (Task 1)
- `composables/usePdfManifest.test.js` — tests for the above. (Task 1)
- `composables/usePdfGeometry.js` — extract `spansToRects()`; add `chunkSubRangeRects()` and `pagesToRender()`. (Tasks 2, 6)
- `composables/usePdfGeometry.test.js` — tests for the above. (Tasks 2, 6)
- `components/PdfViewer.vue` — word-highlight overlay layer; lazy rasterization. (Tasks 3, 6)
- `pages/reader/[id].vue` — pass `activeWord` to `PdfViewer`; EPUB CSS Custom Highlight; prewarm on "Read from here". (Tasks 3, 4, 5)
- `composables/useTTS.js` — `ttsPrewarmKey()`, prewarm cache, optimistic highlight, deeper prefetch, `prewarmText()`. (Task 5)
- `composables/useTTS.test.js` — `ttsPrewarmKey` tests. (Task 5)
- `assets/css/main.css` — `--color-reader-word-highlight` var (both theme blocks) + `::highlight(tts-word)` rule. (Tasks 3, 4)

---

## Task 1: Manifest `textStart` + `wordSpansWithinChunk`

**Files:**
- Modify: `composables/usePdfManifest.js`
- Test: `composables/usePdfManifest.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `composables/usePdfManifest.test.js`:

```js
import {
  PDF_MANIFEST_VERSION,
  buildPdfManifest,
  chunkForId,
  firstChunkForPage,
  pageForChunk,
  wordSpansWithinChunk,
} from './usePdfManifest.js'

describe('wordSpansWithinChunk', () => {
  const manifest = buildPdfManifest([{
    page: 1,
    width: 600,
    height: 800,
    items: [
      item('Prefix. Start', 10, 700),
      item('middle', 100, 700),
      item('end. Suffix.', 150, 700),
    ],
  }])
  const chunk = manifest.chunks.find(entry => entry.text === 'Start middle end.')

  it('records the chunk start offset within the page text', () => {
    expect(chunk.textStart).toBe(8)
  })

  it('maps a word fully inside the first item to that item span', () => {
    expect(wordSpansWithinChunk(manifest, chunk.id, 0, 5)).toEqual([
      { itemIndex: 0, start: 8, end: 13 },
    ])
  })

  it('maps a middle word to its own source item', () => {
    expect(wordSpansWithinChunk(manifest, chunk.id, 6, 12)).toEqual([
      { itemIndex: 1, start: 0, end: 6 },
    ])
  })

  it('clamps a word range that runs past the chunk text', () => {
    expect(wordSpansWithinChunk(manifest, chunk.id, 13, 999)).toEqual([
      { itemIndex: 2, start: 0, end: 4 },
    ])
  })

  it('maps a hyphenated word split across two PDF items to two spans', () => {
    const m = buildPdfManifest([{
      page: 1,
      width: 600,
      height: 800,
      items: [item('Full-', 10, 700), item('time. Yes.', 40, 700)],
    }])
    const c = m.chunks.find(entry => entry.text === 'Full-time.')
    expect(c.textStart).toBe(0)
    expect(wordSpansWithinChunk(m, c.id, 0, 9)).toEqual([
      { itemIndex: 0, start: 0, end: 5 },
      { itemIndex: 1, start: 0, end: 4 },
    ])
  })

  it('returns [] for an unknown chunk', () => {
    expect(wordSpansWithinChunk(manifest, 999, 0, 5)).toEqual([])
  })

  it('returns [] for an empty range', () => {
    expect(wordSpansWithinChunk(manifest, chunk.id, 3, 3)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run composables/usePdfManifest.test.js`
Expected: FAIL — `wordSpansWithinChunk is not a function` and `chunk.textStart` is `undefined`.

- [ ] **Step 3: Add `textStart` to each chunk**

In `composables/usePdfManifest.js`, inside `buildPdfManifest`, change the chunk push to record the range start:

```js
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
```

- [ ] **Step 4: Implement `wordSpansWithinChunk`**

In `composables/usePdfManifest.js`, add a cached page-points helper and the exported function (place after `buildPdfManifest`, before `chunkForId`):

```js
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run composables/usePdfManifest.test.js`
Expected: PASS (all existing + new tests).

- [ ] **Step 6: Commit**

```bash
git add composables/usePdfManifest.js composables/usePdfManifest.test.js
git commit -m "feat: record chunk textStart and map word ranges to PDF spans"
```

---

## Task 2: Geometry `spansToRects` + `chunkSubRangeRects`

**Files:**
- Modify: `composables/usePdfGeometry.js`
- Test: `composables/usePdfGeometry.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `composables/usePdfGeometry.test.js` (note the new imports `buildPdfManifest` and `chunkSubRangeRects`):

```js
import { buildPdfManifest } from './usePdfManifest.js'
import { chunkSubRangeRects } from './usePdfGeometry.js'

describe('PDF word sub-range geometry', () => {
  const builtManifest = buildPdfManifest([{
    page: 1,
    width: 600,
    height: 800,
    items: [
      { str: 'Prefix. Start', width: 130, height: 10, transform: [1, 0, 0, 10, 20, 700] },
      { str: 'middle', width: 60, height: 10, transform: [1, 0, 0, 10, 160, 700] },
      { str: 'end. Suffix.', width: 120, height: 10, transform: [1, 0, 0, 10, 20, 680] },
    ],
  }])
  const builtChunk = builtManifest.chunks.find(entry => entry.text === 'Start middle end.')
  const vp = [1, 0, 0, -1, 0, 800]

  it('draws the word rectangle clipped to the source item', () => {
    const rects = chunkSubRangeRects(builtManifest, builtChunk.id, 0, 5, vp)
    expect(rects).toHaveLength(1)
    expect(rects[0].left).toBeCloseTo(100)
    expect(rects[0].width).toBeCloseTo(50)
    expect(rects[0].top).toBe(90)
  })

  it('returns [] for an empty word range', () => {
    expect(chunkSubRangeRects(builtManifest, builtChunk.id, 3, 3, vp)).toEqual([])
  })

  it('returns [] for an unknown chunk', () => {
    expect(chunkSubRangeRects(builtManifest, 999, 0, 5, vp)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run composables/usePdfGeometry.test.js`
Expected: FAIL — `chunkSubRangeRects is not a function`.

- [ ] **Step 3: Refactor `chunkHighlightRects` to share `spansToRects`, add `chunkSubRangeRects`**

In `composables/usePdfGeometry.js`, update the import and replace `chunkHighlightRects` with the two functions below (keep `multiply`, `itemSpanRect`, and `scrollTargetForChunk` unchanged):

```js
import { chunkForId, wordSpansWithinChunk } from './usePdfManifest.js'
```

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run composables/usePdfGeometry.test.js`
Expected: PASS — new tests plus the existing `chunkHighlightRects` / `scrollTargetForChunk` tests still green.

- [ ] **Step 5: Commit**

```bash
git add composables/usePdfGeometry.js composables/usePdfGeometry.test.js
git commit -m "refactor: share spansToRects; add chunkSubRangeRects for word highlight"
```

---

## Task 3: PDF word-highlight overlay + reader wiring

**Files:**
- Modify: `components/PdfViewer.vue`
- Modify: `pages/reader/[id].vue`
- Modify: `assets/css/main.css`
- Verify: live preview (no unit test — DOM/canvas component)

- [ ] **Step 1: Add the word-highlight CSS variable**

In `assets/css/main.css`, add the variable in BOTH blocks that already define `--color-reader-highlight` (after line 107 and after line 277). Add this line in each block, immediately after the existing `--color-reader-highlight-border` line:

```css
  --color-reader-word-highlight: #9370DB7F;
```

- [ ] **Step 2: Add the word overlay layer to `PdfViewer.vue` template**

In `components/PdfViewer.vue`, inside the `.pdf-page-wrap` div, add a second layer directly after the existing `.pdf-highlight-layer` div:

```html
        <div class="pdf-word-highlight-layer" aria-hidden="true">
          <span
            v-for="(highlight, index) in wordHighlightsByPage[page.number] || []"
            :key="index"
            class="pdf-word-highlight"
            :style="{
              left: `${highlight.left}px`,
              top: `${highlight.top}px`,
              width: `${highlight.width}px`,
              height: `${highlight.height}px`,
            }"
          ></span>
        </div>
```

- [ ] **Step 3: Add the `activeWord` prop, state, and update logic to `PdfViewer.vue` script**

Update the import, props, and add `wordHighlightsByPage` + `updateWordHighlights` + a combined `refreshHighlights`:

```js
import { chunkHighlightRects, chunkSubRangeRects, scrollTargetForChunk } from '~/composables/usePdfGeometry'
```

```js
const props = defineProps({
  src: { required: true },
  zoom: { type: Number, default: 1 },
  manifest: { type: Object, default: null },
  activeChunkId: { type: Number, default: -1 },
  activeWord: { type: Object, default: null },
})
```

Add after the existing `updateHighlights` function:

```js
const wordHighlightsByPage = ref({})

const updateWordHighlights = () => {
  const chunk = props.manifest?.chunks?.find(entry => entry.id === props.activeChunkId)
  const range = props.activeWord
  const viewportTransform = chunk ? viewportTransforms.get(chunk.page) : null
  if (!chunk || !range || !viewportTransform || !(range.end > range.start)) {
    wordHighlightsByPage.value = {}
    return
  }

  wordHighlightsByPage.value = {
    [chunk.page]: chunkSubRangeRects(props.manifest, chunk.id, range.start, range.end, viewportTransform)
      .map(rect => ({
        left: Math.max(0, rect.left - 1),
        top: Math.max(0, rect.top - 1),
        width: rect.width + 2,
        height: rect.height + 2,
      })),
  }
}

const refreshHighlights = () => {
  updateHighlights()
  updateWordHighlights()
}
```

- [ ] **Step 4: Point watchers and `buildPages` at `refreshHighlights`**

In `components/PdfViewer.vue`, change the `updateHighlights()` call at the end of `buildPages` to `refreshHighlights()`, and update the watchers at the bottom of the script:

```js
  refreshHighlights()
  emit('loaded', { pages: pdfDocument.numPages })
}
```

```js
watch(() => props.src, renderPdf)
watch(() => props.zoom, renderPdf)
watch(() => props.manifest, refreshHighlights, { deep: true })
watch(() => props.activeChunkId, refreshHighlights)
watch(() => props.activeWord, updateWordHighlights)
```

- [ ] **Step 5: Add the word-overlay styles to `PdfViewer.vue`**

In the `<style scoped>` block of `components/PdfViewer.vue`, add after the `.pdf-highlight` rule:

```css
.pdf-word-highlight-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}

.pdf-word-highlight {
  position: absolute;
  background: var(--color-reader-word-highlight);
  border-radius: 2px;
  mix-blend-mode: multiply;
}
```

- [ ] **Step 6: Wire `activeWord` from the reader**

In `pages/reader/[id].vue`, add `ttsWordIdx` and `ttsBoundaries` to the `useTTS()` destructure:

```js
const {
  ttsBook,
  ttsChunkIdx,
  ttsPlayingChunkIdx,
  ttsStatus,
  ttsWordIdx,
  ttsBoundaries,
  play: playTTS,
  pause: pauseTTS,
  resume: resumeTTS,
} = useTTS()
```

Add a computed near `activeTtsChunkIndex`:

```js
const activeWordRange = computed(() => {
  if (activeTtsChunkIndex.value < 0) return null
  const boundary = ttsBoundaries.value?.[ttsWordIdx.value]
  if (!boundary || typeof boundary.charIndex !== 'number' || boundary.charIndex < 0) return null
  const end = boundary.charIndex + (boundary.word?.length || 0)
  if (end <= boundary.charIndex) return null
  return { start: boundary.charIndex, end }
})
```

Pass it to `PdfViewer` in the template:

```html
        <PdfViewer
          v-if="isPdfRenderable"
          ref="pdfViewerRef"
          :src="pdfSource"
          :zoom="zoomLevel"
          :manifest="pdfManifest"
          :active-chunk-id="activeTtsChunkIndex"
          :active-word="activeWordRange"
          @page-change="handlePdfPageChange"
          @loaded="handlePdfLoaded"
        />
```

- [ ] **Step 7: Verify in the live preview**

Start the dev server with the preview tools, open a text-based PDF, and start "Read aloud" from the reader. Confirm: the soft sentence band appears, and a brighter box tracks word-by-word within it; on pause the word box holds; on stop both clear. Capture a screenshot as proof.

- [ ] **Step 8: Commit**

```bash
git add components/PdfViewer.vue pages/reader/[id].vue assets/css/main.css
git commit -m "feat: word-level read-aloud highlight overlay for PDF"
```

---

## Task 4: EPUB word highlight via CSS Custom Highlight API

**Files:**
- Modify: `pages/reader/[id].vue`
- Modify: `assets/css/main.css`
- Verify: live preview (no unit test — DOM)

- [ ] **Step 1: Add the global `::highlight(tts-word)` rule**

In `assets/css/main.css`, add at the end of the file (CSS custom highlights are registered globally and cannot be Vue-scoped):

```css
::highlight(tts-word) {
  background-color: var(--color-reader-word-highlight);
  border-radius: 2px;
}
```

- [ ] **Step 2: Add the EPUB word-highlight machinery to `[id].vue`**

In `pages/reader/[id].vue`, near the other module-scoped highlight vars (`let _observer`, `let _chunkEls`, `let _activeEl`), add:

```js
let _ttsWordHighlight = null
let _activeWordMap = null
let _activeWordMapIdx = -1
```

Add these functions after `_highlightChunk`:

```js
function _ensureWordHighlight() {
  if (!import.meta.client || typeof Highlight === 'undefined' || !CSS?.highlights) return null
  if (!_ttsWordHighlight) {
    _ttsWordHighlight = new Highlight()
    CSS.highlights.set('tts-word', _ttsWordHighlight)
  }
  return _ttsWordHighlight
}

function _updateEpubWordHighlight() {
  const highlight = _ensureWordHighlight()
  if (!highlight) return
  highlight.clear()
  if (isPdfBook.value) return

  const chunkIdx = activeTtsChunkIndex.value
  const range = activeWordRange.value
  if (chunkIdx < 0 || !range) return

  const el = _chunkEls[chunkIdx]
  if (!el?.isConnected) return

  if (_activeWordMapIdx !== chunkIdx || !_activeWordMap) {
    _activeWordMap = buildTextIndex(el)
    _activeWordMapIdx = chunkIdx
  }

  const map = _activeWordMap.map
  const startPt = resolveRangePoint(map, range.start, 1)
  const endPt = resolveRangePoint(map, range.end - 1, -1)
  if (!startPt || !endPt) return

  try {
    const domRange = document.createRange()
    domRange.setStart(startPt.node, startPt.offset)
    domRange.setEnd(endPt.node, Math.min(endPt.node.nodeValue.length, endPt.offset + 1))
    highlight.add(domRange)
  } catch {
    // Detached or overlapping range — leave only the sentence band.
  }
}
```

- [ ] **Step 3: Invalidate the cached word map when the chunk map rebuilds**

In `pages/reader/[id].vue`, inside `_buildChunkMap`, add a reset right after `_chunkEls = []`:

```js
  _chunkEls = []
  _activeWordMapIdx = -1
```

- [ ] **Step 4: Drive the word highlight from a watcher**

In `pages/reader/[id].vue`, add after the existing `watch(activeTtsChunkIndex, ...)` watcher:

```js
watch([activeTtsChunkIndex, ttsWordIdx], () => {
  if (!isPdfBook.value) _updateEpubWordHighlight()
})
```

And clear it on unmount — in `onUnmounted`, before `if (!book.value) return`, add:

```js
  if (import.meta.client && CSS?.highlights) CSS.highlights.delete('tts-word')
  _ttsWordHighlight = null
```

- [ ] **Step 5: Verify in the live preview**

Open an EPUB, start "Read aloud". Confirm the sentence band still highlights and a brighter box tracks the current word within it; on stop both clear. Capture a screenshot.

- [ ] **Step 6: Commit**

```bash
git add pages/reader/[id].vue assets/css/main.css
git commit -m "feat: word-level read-aloud highlight for EPUB via CSS Custom Highlight"
```

---

## Task 5: Instant sentence highlight + warmer prefetch

**Files:**
- Modify: `composables/useTTS.js`
- Modify: `pages/reader/[id].vue`
- Test: `composables/useTTS.test.js` (pure key fn); wiring verified in preview

- [ ] **Step 1: Write the failing test**

Append to `composables/useTTS.test.js` (add `ttsPrewarmKey` to the existing import from `./useTTS.js`):

```js
describe('ttsPrewarmKey', () => {
  it('differs when voice or speed differ', () => {
    const base = ttsPrewarmKey('Hello there.', 'en-US-JennyNeural', 1)
    expect(base).not.toBe(ttsPrewarmKey('Hello there.', 'en-US-GuyNeural', 1))
    expect(base).not.toBe(ttsPrewarmKey('Hello there.', 'en-US-JennyNeural', 1.5))
  })

  it('matches for identical text, voice, and speed', () => {
    expect(ttsPrewarmKey('Hi.', 'v', 1)).toBe(ttsPrewarmKey('Hi.', 'v', 1))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run composables/useTTS.test.js`
Expected: FAIL — `ttsPrewarmKey is not a function`.

- [ ] **Step 3: Add the pure key function and prewarm cache**

In `composables/useTTS.js`, add the exported key near the other pure helpers (after `takeMatchingPrefetch`):

```js
export function ttsPrewarmKey(text, voice, speed) {
  return `${String(text || '')}::${String(voice || '')}::${String(speed || '')}`
}
```

Add a module-level prewarm cache near `let _audioCache = new Map()`:

```js
let _prewarmCache = new Map()
const PREWARM_CACHE_LIMIT = 4
```

- [ ] **Step 4: Check the prewarm cache before the network in `_fetchChunkAudio`**

In `composables/useTTS.js`, update `_fetchChunkAudio` to consult the prewarm cache first:

```js
  const _fetchChunkAudio = async (chunkIdx) => {
    const chunk = _chunks[chunkIdx]
    if (!chunk) return null
    const cached = _getCachedAudio(chunkIdx, chunk)
    if (cached) return cached

    const voice = normalizeAvailableVoice(ttsVoiceId.value)
    const prewarmKey = ttsPrewarmKey(chunk, voice, ttsSpeed.value)
    const prewarmed = _prewarmCache.get(prewarmKey)
    if (prewarmed) {
      _prewarmCache.delete(prewarmKey)
      const result = {
        chunkIdx,
        chunkText: chunk,
        audio: prewarmed.audio,
        boundaries: prewarmed.boundaries ?? [],
      }
      _cacheAudio(chunkIdx, result)
      return result
    }

    try {
      const data = await $fetch('/api/tts', {
        method: 'POST',
        body: { text: chunk, voice, speed: ttsSpeed.value },
      })
      const result = {
        chunkIdx,
        chunkText: chunk,
        audio: data.audio ?? null,
        boundaries: data.boundaries ?? [],
      }
      _cacheAudio(chunkIdx, result)
      return result
    } catch (err) {
      console.warn('[TTS] fetch error:', err)
      return null
    }
  }
```

- [ ] **Step 5: Set the highlight optimistically and deepen prefetch in `_speakNextEdge`**

In `composables/useTTS.js`, inside `_speakNextEdge`, immediately after `const requestedChunkText = _chunks[requestedChunkIdx] || ''`, add the optimistic highlight:

```js
    // Show the sentence highlight immediately, before the audio fetch returns.
    // Any non-success path below resets these to -1 / ''.
    ttsPlayingChunkIdx.value = requestedChunkIdx
    ttsPlayingChunkText.value = requestedChunkText
```

Then, in the same function, find the existing next-chunk prefetch block and add a second look-ahead right after it:

```js
    // Pre-fetch next chunk while this one plays
    const nextIdx = _chunkIdx + 1
    if (nextIdx < _chunks.length) {
      const gen = _prefetchGeneration
      _fetchChunkAudio(nextIdx).then(result => {
        if (_prefetchGeneration === gen && result) {
          _prefetchChunk = result
        }
      })
    }

    // Warm one more chunk ahead into the per-index audio cache.
    const nextIdx2 = _chunkIdx + 2
    if (nextIdx2 < _chunks.length) {
      _fetchChunkAudio(nextIdx2).catch(() => {})
    }
```

- [ ] **Step 6: Add `prewarmText`, clear prewarm cache on voice/speed change, and export it**

In `composables/useTTS.js`, add `prewarmText` near the other public methods (e.g. after `restart`):

```js
  const prewarmText = async (text) => {
    const value = String(text || '').trim()
    if (!value) return
    const voice = normalizeAvailableVoice(ttsVoiceId.value)
    const key = ttsPrewarmKey(value, voice, ttsSpeed.value)
    if (_prewarmCache.has(key)) return
    try {
      const data = await $fetch('/api/tts', {
        method: 'POST',
        body: { text: value, voice, speed: ttsSpeed.value },
      })
      if (!data?.audio) return
      _prewarmCache.set(key, { audio: data.audio, boundaries: data.boundaries ?? [] })
      while (_prewarmCache.size > PREWARM_CACHE_LIMIT) {
        _prewarmCache.delete(_prewarmCache.keys().next().value)
      }
    } catch {
      // Prewarm is best-effort; normal fetch will run at play time.
    }
  }
```

In `_clearAudioCache`, also clear the prewarm cache (so a voice/speed switch can't serve stale audio):

```js
  const _clearAudioCache = () => {
    for (const item of _audioCache.values()) {
      if (item?.objectUrl) URL.revokeObjectURL(item.audio)
    }
    _audioCache.clear()
    _prewarmCache.clear()
  }
```

Add `prewarmText` to the returned object:

```js
    setSpeed, setVolume, setVoice, seekToProgress, skipChunks, skipSeconds, seekToChunk,
    setChapterBoundaries, prewarmText,
```

- [ ] **Step 7: Prewarm the target chunk when the "Read from here" modal opens**

In `pages/reader/[id].vue`, add `prewarmText` to the `useTTS()` destructure:

```js
  play: playTTS,
  pause: pauseTTS,
  resume: resumeTTS,
  prewarmText,
} = useTTS()
```

In `requestReadCurrentPosition`, after `confirmReadFromHereOpen.value = true`, add:

```js
  const targetText = allReadableChunks.value[targetChunkId]
  if (targetText) prewarmText(targetText)
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run composables/useTTS.test.js`
Expected: PASS.

- [ ] **Step 9: Verify in the live preview**

Open a book, open "Read from here", and watch the network panel: a `/api/tts` request fires on modal open. Confirm the sentence highlight appears the instant playback starts (not after a delay), and audio follows. Capture the network panel as proof.

- [ ] **Step 10: Commit**

```bash
git add composables/useTTS.js composables/useTTS.test.js pages/reader/[id].vue
git commit -m "feat: instant sentence highlight, deeper prefetch, and prewarm-on-intent"
```

---

## Task 6: Lazy PDF rendering

**Files:**
- Modify: `composables/usePdfGeometry.js` (pure `pagesToRender`)
- Test: `composables/usePdfGeometry.test.js`
- Modify: `components/PdfViewer.vue` (lazy rasterization)
- Verify: live preview

- [ ] **Step 1: Write the failing test for `pagesToRender`**

Append to `composables/usePdfGeometry.test.js` (add `pagesToRender` to the `./usePdfGeometry.js` import):

```js
describe('pagesToRender', () => {
  it('expands visible pages by the margin and clamps to range', () => {
    expect(pagesToRender([1], 10, 2)).toEqual([1, 2, 3])
    expect(pagesToRender([5], 10, 2)).toEqual([3, 4, 5, 6, 7])
    expect(pagesToRender([10], 10, 2)).toEqual([8, 9, 10])
  })

  it('merges overlapping windows and dedupes', () => {
    expect(pagesToRender([3, 4], 10, 1)).toEqual([2, 3, 4, 5])
  })

  it('returns [] when there are no pages', () => {
    expect(pagesToRender([1], 0, 2)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run composables/usePdfGeometry.test.js`
Expected: FAIL — `pagesToRender is not a function`.

- [ ] **Step 3: Implement `pagesToRender`**

In `composables/usePdfGeometry.js`, add the exported function:

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run composables/usePdfGeometry.test.js`
Expected: PASS.

- [ ] **Step 5: Add lazy-render state and import to `PdfViewer.vue`**

In `components/PdfViewer.vue`, update the geometry import and add module-local state near the other `const ... = new Map()` declarations:

```js
import { chunkHighlightRects, chunkSubRangeRects, pagesToRender, scrollTargetForChunk } from '~/composables/usePdfGeometry'
```

```js
const renderedPages = new Set()
const _visiblePages = new Set()
let _baseScale = 1
```

Update `resetPageRefs` to also clear the new state:

```js
const resetPageRefs = () => {
  pageCanvases.clear()
  pageWraps.clear()
  viewportTransforms.clear()
  renderedPages.clear()
  _visiblePages.clear()
}
```

- [ ] **Step 6: Replace `buildPages` with split layout + windowed first render**

In `components/PdfViewer.vue`, replace the whole `buildPages` function with:

```js
const buildPages = async () => {
  if (!pdfDocument) return
  const firstPage = await pdfDocument.getPage(1)
  const firstViewport = firstPage.getViewport({ scale: 1 })
  const availableWidth = Math.max(320, (viewerRef.value?.clientWidth || 820) - 32)
  const baseScale = availableWidth / firstViewport.width
  _baseScale = baseScale

  // Cheap layout pass: size + viewport transform for EVERY page, no canvas.
  const pageRecords = []
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = pageNumber === 1 ? firstPage : await pdfDocument.getPage(pageNumber)
    const viewport = page.getViewport({ scale: baseScale * props.zoom })
    viewportTransforms.set(pageNumber, viewport.transform.slice())
    pageRecords.push({
      number: pageNumber,
      width: viewport.width,
      height: viewport.height,
    })
  }

  pages.value = pageRecords
  ready.value = true
  await nextTick()
  setupPageObserver()

  renderedPages.clear()
  await renderWindow([1])

  refreshHighlights()
  emit('loaded', { pages: pdfDocument.numPages })
}
```

- [ ] **Step 7: Add `renderPageIfNeeded` and `renderWindow`**

In `components/PdfViewer.vue`, add after `renderPage`:

```js
const renderPageIfNeeded = async (pageNumber, generation = renderGeneration) => {
  if (!pdfDocument || renderedPages.has(pageNumber)) return
  renderedPages.add(pageNumber)
  await renderPage(pageNumber, _baseScale, generation)
}

const renderWindow = async (visiblePages) => {
  const generation = renderGeneration
  const target = pagesToRender(visiblePages, pdfDocument?.numPages || 0, 2)

  // Evict canvases outside the window to cap memory on large documents.
  for (const pageNumber of [...renderedPages]) {
    if (!target.includes(pageNumber)) {
      const canvas = pageCanvases.get(pageNumber)
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
      renderedPages.delete(pageNumber)
    }
  }

  for (const pageNumber of target) {
    if (generation !== renderGeneration) return
    await renderPageIfNeeded(pageNumber, generation)
  }
}
```

- [ ] **Step 8: Make the IntersectionObserver drive lazy rendering**

In `components/PdfViewer.vue`, replace `setupPageObserver` with:

```js
const setupPageObserver = () => {
  pageObserver?.disconnect()
  pageObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const pageNumber = Number(entry.target?.dataset?.page)
      if (!pageNumber) continue
      if (entry.isIntersecting) _visiblePages.add(pageNumber)
      else _visiblePages.delete(pageNumber)
    }

    const best = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
    const bestPage = Number(best?.target?.dataset?.page)
    if (bestPage) emit('page-change', bestPage)

    const visible = _visiblePages.size ? [..._visiblePages] : (bestPage ? [bestPage] : [1])
    renderWindow(visible)
  }, {
    root: null,
    rootMargin: '200px 0px 200px 0px',
    threshold: [0, 0.1, 0.3, 0.5, 0.7],
  })
  for (const wrap of pageWraps.values()) pageObserver.observe(wrap)
}
```

- [ ] **Step 9: Ensure jump/scroll targets are rasterized first**

In `components/PdfViewer.vue`, update `scrollToPage` and `scrollToChunk` to render the target before scrolling:

```js
const scrollToPage = (pageNumber, behavior = 'smooth', block = 'start') => {
  renderPageIfNeeded(Number(pageNumber))
  pageWraps.get(Number(pageNumber))?.scrollIntoView({ behavior, block })
}

const scrollToChunk = (chunkId, behavior = 'smooth') => {
  const chunk = props.manifest?.chunks?.find(entry => entry.id === Number(chunkId))
  const viewportTransform = chunk ? viewportTransforms.get(chunk.page) : null
  if (!chunk || !viewportTransform) return

  renderPageIfNeeded(chunk.page)
  const target = scrollTargetForChunk(props.manifest, chunk.id, viewportTransform)
  const pageWrap = pageWraps.get(chunk.page)
  if (!target || !pageWrap) return
  const pageRect = pageWrap.getBoundingClientRect()
  const top = window.scrollY + pageRect.top + target.top - 72
  window.scrollTo({ top: Math.max(0, top), behavior })
}
```

- [ ] **Step 10: Re-layout on zoom instead of a full document reload**

In `components/PdfViewer.vue`, add a `relayout` function (after `buildPages`) and point the zoom watcher at it:

```js
const relayout = async () => {
  if (!pdfDocument) return
  const generation = ++renderGeneration

  const firstPage = await pdfDocument.getPage(1)
  const firstViewport = firstPage.getViewport({ scale: 1 })
  const availableWidth = Math.max(320, (viewerRef.value?.clientWidth || 820) - 32)
  const baseScale = availableWidth / firstViewport.width
  _baseScale = baseScale

  const pageRecords = []
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = pageNumber === 1 ? firstPage : await pdfDocument.getPage(pageNumber)
    const viewport = page.getViewport({ scale: baseScale * props.zoom })
    viewportTransforms.set(pageNumber, viewport.transform.slice())
    pageRecords.push({ number: pageNumber, width: viewport.width, height: viewport.height })
  }
  if (generation !== renderGeneration) return

  // Drop stale-size canvases; the visible window re-renders below.
  for (const pageNumber of [...renderedPages]) {
    const canvas = pageCanvases.get(pageNumber)
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
  renderedPages.clear()

  pages.value = pageRecords
  await nextTick()
  await renderWindow(_visiblePages.size ? [..._visiblePages] : [1])
  refreshHighlights()
}
```

Change the zoom watcher:

```js
watch(() => props.zoom, relayout)
```

- [ ] **Step 11: Verify in the live preview**

Open a multi-page (ideally 20+ page) PDF. Confirm: only near pages rasterize on load; scrolling progressively rasterizes pages (watch the canvases/network); "Read aloud" still shows the two-tier highlight; "Jump to narration" renders and centers the target with no blank flash; zoom in/out re-renders the visible pages quickly without freezing. Capture a screenshot mid-scroll.

- [ ] **Step 12: Run the full suite and commit**

Run: `npx vitest run`
Expected: PASS (all files).

```bash
git add composables/usePdfGeometry.js composables/usePdfGeometry.test.js components/PdfViewer.vue
git commit -m "perf: lazy PDF rasterization with decoupled highlight geometry"
```

---

## Final Verification

- [ ] Run the full unit suite: `npx vitest run` → all green.
- [ ] In the live preview, run one combined pass on a real PDF: scroll (lazy render), "Read from here" (instant sentence band + prewarm request), and listen through a few sentences (word box tracking, jump-to-narration). Then repeat the read-aloud check on an EPUB.
- [ ] Confirm an older PDF (manifest version < 3) opens and narrates — the reader's stale-version path rebuilds it to v3 on load.

---

## Self-Review

**Spec coverage:**
- Word highlight, PDF (manifest v3 `textStart`, `wordSpansWithinChunk`, `chunkSubRangeRects`, overlay) → Tasks 1, 2, 3. ✓
- Word highlight, EPUB (CSS Custom Highlight) → Task 4. ✓
- `charIndex === -1` / unresolvable / no-support fallback → `activeWordRange` returns null (Task 3 Step 6); `_updateEpubWordHighlight` guards (Task 4 Step 2); `updateWordHighlights` guards (Task 3 Step 3). ✓
- Instant sentence highlight, deeper prefetch, prewarm-on-intent → Task 5. ✓
- Lazy render: split layout/raster, on-demand window, eviction, jump renders target, zoom relayout → Task 6. ✓
- Manifest v3 self-heal → covered by the existing reader stale-version path; checked in Final Verification. ✓
- Tests: `wordSpansWithinChunk` (Task 1), `chunkSubRangeRects` (Task 2), `ttsPrewarmKey` (Task 5), `pagesToRender` (Task 6). The spec's "ttsPlayingChunkIdx set before fetch" and "prewarm skips $fetch" behaviors are verified in the preview (Task 5 Step 9) rather than by unit test, consistent with the repo's pure-function test style. ✓

**Placeholder scan:** No TBD/TODO; every code step shows the actual code and every test step shows assertions. ✓

**Type consistency:** `wordSpansWithinChunk(manifest, chunkId, charStart, charEnd)` and `chunkSubRangeRects(manifest, chunkId, charStart, charEnd, viewportTransform)` used consistently across Tasks 1–3. `activeWord` prop shape `{ start, end }` matches `activeWordRange` (Task 3) and `updateWordHighlights` (Task 3). `pagesToRender(visiblePages, total, margin)` consistent in Task 6. `refreshHighlights` defined in Task 3 and reused by `buildPages`/`relayout` in Task 6. ✓
