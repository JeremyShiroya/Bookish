# Read-Aloud Word Highlight, Instant Highlight & Lazy PDF Render

**Date:** 2026-06-26
**Status:** Approved

## Goal

Make Bookish's read-aloud highlighting faster and more accurate, and make PDF
rendering faster, **while keeping the cloud Microsoft Edge TTS engine**. Three
independent changes, built and committed in this order:

1. **Word-level highlight** — render the word currently being spoken, on top of
   the existing sentence highlight (two-tier), for both EPUB and PDF.
2. **Instant sentence highlight** — show the sentence band the moment playback is
   requested, instead of after the network round-trip, plus warmer prefetching.
3. **Lazy PDF render** — rasterize only visible pages instead of the whole
   document, and decouple highlight geometry from rasterization.

Non-goal: an offline / on-device TTS engine. All three changes are
engine-agnostic — they read from `ttsWordIdx` / `boundaries` / the PDF manifest /
the renderer — so a future offline engine drops in without rework.

## Background

The data needed for word highlighting already flows end to end:

- `server/api/tts/index.post.ts` returns `boundaries: [{ word, offset, duration,
  charIndex }]`, where `offset`/`duration` are seconds and `charIndex` is the
  word's offset **within the chunk text that was sent to TTS**.
- `composables/useTTS.js` already exposes `ttsBoundaries` and drives `ttsWordIdx`
  via a requestAnimationFrame binary-search loop (`_startWordLoop`) that maps
  `audio.currentTime` to the active boundary index.

Nothing renders `ttsWordIdx` today (`grep` confirms it is referenced only inside
`useTTS.js`). Highlighting stops at the sentence:

- EPUB: the active chunk is wrapped in `<span data-tts-chunk>` and given
  `.tts-active` (the soft band) in `pages/reader/[id].vue`.
- PDF: the active chunk's manifest spans are converted to overlay rectangles in
  `components/PdfViewer.vue` via `composables/usePdfGeometry.js`.

For PDF, `charIndex` aligns with the manifest chunk text because the manifest
chunk string is exactly what is sent to TTS. For EPUB, `charIndex` aligns with
the chunk element's normalized text because the same whitespace-collapsing /
entity-decoding normalization is shared by `stripHtml` (chunk building) and
`buildTextIndex` (DOM mapping).

---

## 1. Word-level highlight (two-tier)

The current word is drawn as a **brighter box layered over the existing sentence
band**. The sentence band is unchanged. Same visual treatment in both formats.

### PDF

**Manifest change (version 2 → 3).** Each chunk gains `textStart`: the offset of
the chunk's first character within its page's normalized text. This lets a
sub-range (the word) be located by arithmetic on the page's character points
rather than by searching text, preserving the redesign principle that no
subsystem re-searches the document. Existing PDFs with a stored source are
rebuilt once on load by the existing stale-version path in
`pages/reader/[id].vue` (`stored.pdfManifest?.version !== PDF_MANIFEST_VERSION`).

**Geometry.**

- `composables/usePdfManifest.js` adds `wordSpansWithinChunk(manifest, chunkId,
  charStart, charEnd)`. It recomputes the chunk's page character points
  (`appendPageText(page.items)`, cached per page) and returns the participating
  text-item spans for `[textStart + charStart, textStart + charEnd)` using the
  same span-grouping logic as `spansForRange`.
- `composables/usePdfGeometry.js` extracts the per-line merge logic of
  `chunkHighlightRects` into a shared `spansToRects(page, spans, viewportTransform)`,
  then adds `chunkSubRangeRects(manifest, chunkId, charStart, charEnd,
  viewportTransform)` built on it. `chunkHighlightRects` is refactored to call
  `spansToRects` so sentence and word rects merge identically.

**Render.** `components/PdfViewer.vue` gains an `activeWord` prop
(`{ start, end } | null`) and a `wordHighlightsByPage` computed mirroring
`highlightsByPage`, drawn as `.pdf-word-highlight` spans (brighter fill) above
the sentence layer. It recomputes on `activeWord`, `activeChunkId`, `manifest`,
and `zoom` changes.

**Wiring.** `pages/reader/[id].vue` reads `ttsWordIdx` + `ttsBoundaries` from
`useTTS` and passes a computed `activeWord` to `PdfViewer`:
`{ start: charIndex, end: charIndex + word.length }` from
`ttsBoundaries[ttsWordIdx]`, or `null`.

### EPUB

Uses the CSS Custom Highlight API — no per-word DOM mutation, no reflow.

- On active-chunk change, build a char→node map for the active
  `[data-tts-chunk]` element by reusing `buildTextIndex` (already in
  `pages/reader/[id].vue`); cache it for the active chunk.
- On word change, resolve `[charIndex, charIndex + word.length)` to a `Range`
  with the existing `resolveRangePoint`, and set it as the sole range of a
  registered highlight `CSS.highlights.get('tts-word')`.
- `::highlight(tts-word)` is styled as the brighter box (background-color) to
  match the PDF word fill.

### Errors / fallback

`charIndex === -1`, an unresolvable range, empty rects, or no `CSS.highlights`
support → draw no word box; the sentence band remains. The word box clears on
chunk change and when TTS goes idle. PDF word rects recompute on zoom because the
viewport transform changes.

---

## 2. Instant sentence highlight & warmer prefetch

The sentence highlight is gated on `ttsPlayingChunkIdx`, which `_speakNextEdge`
sets only **after** the audio fetch resolves — so the band waits on the network.

**Changes in `composables/useTTS.js`:**

- **Optimistic highlight.** In `_speakNextEdge`, set
  `ttsPlayingChunkIdx` / `ttsPlayingChunkText` to the requested chunk immediately
  after `_updateProgress()`, before awaiting the fetch. Reset to `-1` / `''` on
  the existing null-audio, error, and cancel paths so a failed fetch never leaves
  a highlighted-but-silent sentence. (Primarily improves first-play and
  post-seek; steady state is already prefetched.)
- **Deeper prefetch.** Extend the existing next-chunk prefetch to two chunks
  ahead.
- **Prewarm on intent.** Add `prewarmText(text)` that fetches and stores audio in
  a text-keyed cache (key = text + voice + speed); `_fetchChunkAudio` checks it
  before the network. `pages/reader/[id].vue` calls `prewarmText` for the target
  chunk when the "Read from here" modal opens, so confirm → audio is usually
  instant.

**Errors.** Prewarm failures are non-fatal (fall through to normal fetch). The
optimistic highlight is always paired with a reset on any non-success path.

---

## 3. Lazy PDF render

`components/PdfViewer.vue` currently computes all page sizes, then rasterizes
**every** page, and re-runs the whole pipeline on zoom. `viewportTransforms` are
only populated during rasterization, so highlights depend on a page being
painted.

**Changes:**

- **Split layout from raster.** Compute every page's size **and** viewport
  transform up front via `getViewport()` (cheap, no canvas). Scroll height stays
  correct and highlight geometry resolves for any page even before it is painted.
- **Render on demand.** Reuse the existing `IntersectionObserver` to rasterize
  intersecting pages plus a ±2-page margin; clear canvases outside a window to
  cap memory on large documents. `scrollToChunk` (jump to narration) explicitly
  rasterizes its target page first to avoid a blank flash.
- **Zoom.** Recompute sizes/transforms and re-rasterize only currently visible
  pages; off-screen pages re-render when scrolled into view. Replaces the
  full-document `renderPdf()` on zoom. The `renderGeneration` guard still
  invalidates in-flight renders on src/zoom change.

**Isolation.** Extract a pure `pagesToRender(visiblePages, total, margin)`
windowing function so the windowing decision is unit-testable independent of
canvas rendering.

**Edge cases.** Fast scrolling may briefly show an unpainted page (its sized
placeholder background); the ±2 margin keeps this rare. A highlight on a not-yet-
painted page still draws over the placeholder and resolves as soon as the raster
lands.

---

## Persistence

The only data-shape change is the PDF manifest bump to version 3 (adds
`textStart` per chunk). It self-heals: existing PDFs with a stored source rebuild
once on first reader load via the current stale-version path; PDFs without a
source keep the existing disabled-narration unavailable state.

## Testing & verification

**Unit (pure functions):**

- `usePdfManifest.test.js` — `textStart` correctness; `wordSpansWithinChunk` for
  a word inside one item, a word spanning two items, words at sentence start and
  end, and `charStart`/`charEnd` clamped beyond the text.
- `usePdfGeometry.test.js` — `chunkSubRangeRects` merges a multi-item word into
  the expected rectangles and returns `[]` for an empty range; refactored
  `chunkHighlightRects` keeps its existing results.
- `useTTS.test.js` — `ttsPlayingChunkIdx` is set before a deferred fetch
  resolves; a prewarm hit skips `$fetch`; the prewarm key includes voice and
  speed.
- New `pagesToRender` windowing function — visible set expands by the margin and
  clamps to `[1, total]`.

**Manual (in-app preview), after #1 lands so all three run together:** load a
multi-page PDF, start read-aloud, and confirm: the sentence band and the brighter
word box both appear and track the narration; scrolling rasterizes pages lazily;
jump-to-narration renders and centers the target; zoom re-renders visibly without
freezing. Repeat for an EPUB to confirm the two-tier highlight via the CSS
Custom Highlight API.

## Sequencing

Three commits on `feature/read-aloud-word-highlight-lazy-render`, in order
#1 word highlight, #2 instant highlight, #3 lazy render, each with its tests
green before the next.
