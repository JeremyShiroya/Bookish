# PDF Manifest and Author Totals Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bookish's failed PDF narration navigation/highlighting and inaccurate author totals with deterministic, independently verified systems.

**Architecture:** Build one versioned PDF manifest directly from ordered PDF.js text items and make TTS, highlighting, progress, and navigation consume its chunk records by ID. Separately parse only explicitly classified full-length bibliography sections for author book and series totals, returning unknown rather than provider catalog counts.

**Tech Stack:** Nuxt 4, Vue 3, PDF.js 5, IndexedDB, Vitest, in-app Browser

---

### Task 1: Remove the failed reader and author-count pipelines

**Files:**
- Modify: `components/PdfViewer.vue`
- Modify: `pages/reader/[id].vue`
- Delete: `composables/usePdfHighlight.js`
- Delete: `composables/usePdfHighlight.test.js`
- Modify: `components/AuthorDetailComp.vue`
- Modify: `server/api/authors/bio.get.ts`
- Modify: `composables/useBooks.js`
- Modify: `composables/useLibraryStore.js`

- [ ] **Step 1:** Add source-contract tests asserting that the reader no longer imports `usePdfHighlight`, the viewer exposes no DOM-range highlighter, and author details do not consume `authorBooksCount` or `authorSeriesCount`.
- [ ] **Step 2:** Run the source-contract tests and confirm they fail against the current implementation.
- [ ] **Step 3:** Remove the old controls, modal, DOM text-layer highlight code, author total UI, author total persistence, and bibliography total fields while preserving PDF rendering, biography, personal details, and owned library grouping.
- [ ] **Step 4:** Run the source-contract tests and the existing author/reader helper tests; confirm the removal is green before introducing replacements.

### Task 2: Build a canonical PDF manifest

**Files:**
- Create: `composables/usePdfManifest.js`
- Create: `composables/usePdfManifest.test.js`
- Modify: `composables/usePdfExtractor.js`
- Modify: `composables/useBookStorage.js`
- Modify: `components/AddBookComp.vue`

- [ ] **Step 1:** Write failing tests for ordered items, inferred spaces, sentence chunks, repeated sentences, empty pages, chunk item spans, page-to-first-chunk lookup, and chunk-to-page lookup.
- [ ] **Step 2:** Run `npm exec vitest run composables/usePdfManifest.test.js` and verify failures occur because the manifest API is absent.
- [ ] **Step 3:** Implement `buildPdfManifest(pageRecords)`, `firstChunkForPage(manifest, page)`, and versioned manifest persistence. A chunk record must contain `{ id, page, text, spans }`, and each span must contain the source item index and character offsets.
- [ ] **Step 4:** Change PDF extraction to collect item text plus PDF-space geometry once and return the manifest with the source.
- [ ] **Step 5:** Re-run the focused tests and storage tests until green.

### Task 3: Make PDF TTS consume manifest chunks

**Files:**
- Modify: `composables/useTTS.js`
- Modify: `composables/useTTS.test.js`
- Modify: `pages/reader/[id].vue`

- [ ] **Step 1:** Write failing tests proving `play()` accepts explicit PDF manifest chunks and does not re-split stored PDF HTML.
- [ ] **Step 2:** Run the focused TTS tests and confirm the explicit chunk path is missing.
- [ ] **Step 3:** Add a `chunks` option to PDF playback, keep existing EPUB behavior unchanged, and expose the active numeric chunk ID.
- [ ] **Step 4:** Load or rebuild the PDF manifest in the reader and pass manifest chunk strings to TTS.
- [ ] **Step 5:** Re-run TTS and manifest tests until green.

### Task 4: Rebuild highlight and reader navigation from manifest IDs

**Files:**
- Modify: `components/PdfViewer.vue`
- Modify: `pages/reader/[id].vue`
- Create: `composables/usePdfGeometry.js`
- Create: `composables/usePdfGeometry.test.js`

- [ ] **Step 1:** Write failing geometry tests for viewport transforms, partial first/last item clipping, multiline chunks, and centering the first chunk rectangle.
- [ ] **Step 2:** Write failing reader-position tests for synchronous visible-page selection, empty-page forwarding, backward progress, and stable explicit jump targets.
- [ ] **Step 3:** Implement item-span geometry overlays directly from the manifest and current page viewport. Do not create a PDF text layer or use DOM text matching.
- [ ] **Step 4:** Restore “Read from this page” using `firstChunkForPage`, restore “Jump to narration” using the active manifest chunk, and restore the highlight overlay using that same chunk ID.
- [ ] **Step 5:** Ensure ordinary chunk changes never scroll the viewport; only the explicit jump action may scroll.
- [ ] **Step 6:** Run all focused reader tests until green.

### Task 5: Build validated full-length author totals

**Files:**
- Modify: `server/utils/authorEnrichment.ts`
- Modify: `server/utils/authorEnrichment.test.ts`
- Modify: `server/api/authors/bio.get.ts`
- Modify: `composables/useLibraryStore.js`
- Modify: `components/AuthorDetailComp.vue`

- [ ] **Step 1:** Write failing fixtures covering named novel series, standalone novels, novels, short stories, novellas, anthologies, adaptations, alternate regional titles, duplicates, and unclassified mixed lists.
- [ ] **Step 2:** Run the focused author tests and confirm the full-length classification API is absent.
- [ ] **Step 3:** Implement a parser returning `{ fullLengthBooks, series }` only from explicitly classified full-length sections. Deduplicate normalized titles and aliases; exclude non-full-length sections.
- [ ] **Step 4:** Persist versioned validated totals and display owned/validated-total values. Display `?` whenever validation cannot establish a total.
- [ ] **Step 5:** Verify Karin Slaughter against the live endpoint and ensure the result includes only classified full-length books.

### Task 6: Repeated browser and integration verification

**Files:**
- No committed production files expected

- [ ] **Step 1:** Generate an adversarial PDF outside the repository containing repeated sentences, split words, multiple lines, and an empty page.
- [ ] **Step 2:** Run the complete Vitest suite excluding `.claude/worktrees`, then run `npm run build`.
- [ ] **Step 3:** In the in-app browser, import the adversarial PDF and repeat each flow at least three times: scroll backward and read from page, jump to active narration, and observe full-sentence highlight movement.
- [ ] **Step 4:** Use the user's existing stored PDF in the open browser and repeat the same three flows. Record current page, selected chunk ID, saved progress, target page, and highlight rectangle count for every run.
- [ ] **Step 5:** Verify the Karin Slaughter profile and at least one other author profile, including personal details and conservative unknown behavior.
- [ ] **Step 6:** Check the browser console and screenshots. Any mismatch returns the relevant task to red; do not declare completion from unit tests alone.
