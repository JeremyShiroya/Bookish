# Reader, Metadata, and Author Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Goodreads ratings, accurate PDF highlighting and read-position behavior, clear author totals, clean TOC labels, and consistent select styling.

**Architecture:** Add small pure helpers around provider fallback parsing, TOC normalization, PDF chunk/page mapping, DOM text ranges, and author statistics. Keep network orchestration in existing server routes and keep IndexedDB as the persistence layer.

**Tech Stack:** Nuxt 4, Vue 3, Vitest, PDF.js, Cheerio, IndexedDB

---

### Task 1: Goodreads blocked-response fallback

**Files:**
- Modify: `server/utils/goodreadsScraper.ts`
- Modify: `server/utils/goodreadsScraper.test.ts`

- [ ] Add failing tests proving a 202 title redirect preserves the final
  Goodreads URL, proxied search text is parsed into `webReview`, mismatched
  snippets are rejected, and concurrent identical searches share one lookup.
- [ ] Run `npm exec vitest run server/utils/goodreadsScraper.test.ts` and confirm
  the new tests fail for missing fallback behavior.
- [ ] Add a pure proxied-search parser, blocked-response fallback, bounded
  in-memory cache, and in-flight request coalescing.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: PDF TOC display titles

**Files:**
- Modify: `composables/usePdfExtractor.js`
- Modify: `composables/usePdfExtractor.test.js`
- Modify: `pages/reader/[id].vue`

- [ ] Add failing tests for dot leaders, trailing page numbers, and titles that
  legitimately contain numbers.
- [ ] Run `npm exec vitest run composables/usePdfExtractor.test.js` and confirm
  the new tests fail.
- [ ] Export `formatPdfTocTitle(title, page)` and apply it only when constructing
  reader display items, leaving `item.page` unchanged.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Exact PDF page-to-chunk mapping

**Files:**
- Create: `composables/useReaderPosition.js`
- Create: `composables/useReaderPosition.test.js`
- Modify: `pages/reader/[id].vue`

- [ ] Add failing tests for mapping page 74 to the first chunk of section 74,
  clamping missing/empty sections, and calculating backward PDF progress.
- [ ] Run `npm exec vitest run composables/useReaderPosition.test.js` and confirm
  it fails because the helper does not exist.
- [ ] Implement `chunkIndexForSection`, `sectionForChunkIndex`, and
  `pdfProgressForPage`.
- [ ] Replace proportional PDF chunk estimation in `requestReadCurrentPosition`
  with the helper.
- [ ] On confirmation, restore the captured page top after `playTTS` starts and
  await an immediate progress save based on that page.
- [ ] Re-run the focused test and confirm it passes.

### Task 4: PDF.js text-layer highlighting

**Files:**
- Modify: `components/PdfViewer.vue`
- Modify: `composables/usePdfHighlight.js`
- Modify: `composables/usePdfHighlight.test.js`

- [ ] Add failing tests for normalized text-to-DOM offsets and rectangle clipping
  where the first or last word occupies only part of a text node.
- [ ] Run `npm exec vitest run composables/usePdfHighlight.test.js` and confirm
  the tests fail against geometric estimation.
- [ ] Render a PDF.js `TextLayer` for each page and retain its text-node mapping.
- [ ] Build a normalized searchable index over real text-layer nodes.
- [ ] Resolve the active sentence to a DOM `Range`, measure
  `getClientRects()`, and convert them to page-relative overlay rectangles.
- [ ] Re-run the focused test and confirm it passes.

### Task 5: Reliable author enrichment and totals

**Files:**
- Modify: `server/api/authors/bio.get.ts`
- Create: `server/api/authors/bio.get.test.ts`
- Modify: `server/api/authors/search-images.get.ts`
- Modify: `composables/useBooks.js`
- Modify: `composables/useLibraryStore.js`
- Modify: `composables/useAuthorDetails.js`
- Modify: `composables/useAuthorDetails.test.js`
- Modify: `components/AuthorDetailComp.vue`

- [ ] Add failing tests for exact author-name/book-title candidate selection,
  partial-provider success, distinct total-series counting, and owned/total
  display data.
- [ ] Run the two focused author tests and confirm the new cases fail.
- [ ] Pass up to five owned book titles to the bio endpoint and use them to score
  Open Library/Wikidata candidates.
- [ ] Return and persist `seriesCount` alongside `booksCount`.
- [ ] Remove the second Wikipedia candidate-search pass from image search and
  add per-author cache/in-flight coalescing.
- [ ] Render Books and Series as explicit owned/total values, using `?` when a
  provider cannot establish a total.
- [ ] Re-run the focused author tests and confirm they pass.

### Task 6: Shared select styling

**Files:**
- Modify: `assets/css/main.css`
- Modify: `components/AddBookComp.vue`
- Modify: `components/EditBookComp.vue`
- Modify: `components/SettingsComp.vue`
- Modify: `components/PlayingBar.vue`

- [ ] Add shared `bookish-select-wrap` and `bookish-select` styles to the global
  stylesheet, including focus, hover, disabled, arrow, and option states.
- [ ] Apply the shared classes to status and narrator controls while preserving
  their existing models and change handlers.
- [ ] Build the app to catch template/style errors.

### Task 7: Integrated verification

**Files:**
- No production changes expected

- [ ] Run all focused regression tests.
- [ ] Run the workspace suite with nested `.claude/worktrees` excluded.
- [ ] Run `npm run build`.
- [ ] Start the Nuxt app and use the in-app browser to verify add/edit status
  selects, narrator selects, author statistics/details, and TOC labels.
- [ ] Exercise a stored PDF when available: scroll backward, choose "Read from
  here", confirm the same page is restored at its top, and verify progress moves
  backward.
- [ ] Check browser console errors and capture screenshots of the verified UI.
