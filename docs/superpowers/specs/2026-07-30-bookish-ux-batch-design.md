# Bookish UX batch — voices, position sync, filters, format removal, PDF reflow

**Date:** 2026-07-30
**Status:** approved

Eight independent defects and features reported together. They share no code, but
two ordering constraints exist: the reading-position rework (§2) is the mechanism
that makes "Currently Reading" correct (§3), and the app-level format setting (§6)
removes the global setting that per-page filters (§4) currently fight over.

---

## 1. Offline voice list: duplicates and no gender label

### Problem

The offline (device) narrator picker lists several entries that are the same voice,
labelled `Voice 1`, `Voice 2`, `Voice 3` with no gender.

### Cause

`composables/tts/nativeSpeech.js` tests gender with `/\b(?:female|woman)\b/i`.
Android's Google TTS names voices `en-us-x-sfg#female_1-local`. `_` is a word
character, so there is no word boundary after `female` and the test never matches —
every voice falls through to the `Voice N` fallback. Separately,
`offeredDeviceVoices` pushes every entry the OS returns with no identity dedupe, so
a voice reported twice appears twice.

### Design

Rewrite `describeDeviceVoice` and `offeredDeviceVoices`:

- Parse Android's `#<gender>_<n>` variant token first (`#female_2` → `Female 2`),
  then fall back to name-word hints, then to unlabelled.
- Dedupe on OS voice identity (`voiceURI ?? name`, plus normalised `lang`), not on
  the display label — genuinely distinct variants survive, true repeats collapse.
- Label `English (US) · Female 2`; when gender is unknowable, `English (US) · Voice 2`.
- Order female before male within a locale, unlabelled last, so the list reads
  sensibly.

Each option keeps its original index into the OS list, because that index is what
the native plugin selects by.

---

## 2. Reading position across page and scroll mode

### Problem

Scroll mode always opens at the start of the book. Switching from page 22 in page
mode to scroll mode lands at the beginning. The two modes do not share a position.

### Cause

Two disconnected stores:

- Paged mode persists `{section, page}` to `localStorage['bookish:paged-pos:<id>']`
  (`ReaderPagedEpub.vue`).
- Scroll mode restores from `book.progress`, derived from the **chapter index alone**
  (`pages/reader/[id].vue`), so it can only ever land at a chapter boundary.

`saveReadingProgress` additionally early-returns when the computed percentage is
unchanged, so turning twenty pages inside one chapter writes nothing — not even
`lastReadAt`.

### Design

Make the **chunk index** the single unit of reading position. Chunks are the
reader's existing sentence-level unit, shared by both surfaces, by PDF pages and by
narration.

- Book records gain `readingChunk` alongside `progress`. `progress` becomes
  `readingChunk / totalChunks`, so the percentage is sentence-accurate and actually
  moves while reading.
- New `composables/useReadingPosition.js` owns save and restore.
- Paged mode reports `firstChunkOnCurrentPage()` (already implemented). Scroll mode
  resolves the chunk nearest the reading anchor line.
- On open **and on mode switch**, both surfaces jump to `book.readingChunk`. Paged
  mode already has `goToChunk`; scroll mode gains an equivalent that mounts the
  owning section and scrolls the chunk span into view.
- The per-book `localStorage` paged key stays as a fast-path cache, reconciled
  against `readingChunk`; the book record wins on disagreement.
- The "percentage unchanged → skip write" guard is replaced by a chunk-change guard.

PDFs keep the page-based path, mapped through the existing `firstChunkForPage`.

---

## 3. "Currently Reading" shows the last narrated book

### Cause

`HomeMobile.vue`: `currentReadingBook = ttsBook.value || recentlyReadBooks.value[0]`.
Narration unconditionally wins.

### Design

Drop the `ttsBook` precedence and use `recentlyReadBooks[0]`, which already orders
by `lastReadAt`. Correct only once §2 lands: today `lastReadAt` is stamped inside
the early-returning save, so silent reading never touches it. With the chunk-based
save, every page turn and scroll settle stamps it, so scrolling or swiping updates
the card. Narration still stamps it, so a listened book takes the slot when it
genuinely is the most recent activity.

---

## 4. Per-page filter independence and persistence

### Problem

Filters are shared between pages, and reset to default when navigating into a book
and back.

### Cause

Two separate bugs. Format is a library-wide setting every panel writes
(`LibraryControlsRow` → `updateSettings({ formatFilter })`), so changing it on
Favourites changes it on Series. Status is a bare `ref('all')` inside each
component, destroyed on unmount.

### Design

New `composables/useLibraryFilters.js`, keyed by a scope string (`books`,
`favourites`, `hidden`, `series`, `series:<id>`, `playlists`, `playlist:<id>`).

- Each scope owns `{ status, format, ...extras }`, persisted under
  `bookish:filters:<scope>` and restored on mount.
- A module-level reactive cache makes back-navigation within a session instant.
- `LibraryControlsRow` stops importing `useBookishSettings` and becomes a pure
  controlled component over its scope's values.
- The Preferences "Book format" row stops being a filter and becomes the app-level
  format setting (§6), which is what removes the pressure to keep filters global.

---

## 5. Playlist icon does not indicate membership

`BookDetailMobile.vue` renders a static `ri-play-list-2-line` with no state class.

### Design

Compute membership from `collections` in `useBooks`, then mirror the favourite
button: `:class="{ active: inPlaylist }"` and swap to `ri-play-list-fill`. The
title becomes "In N playlists" when set.

---

## 6. Format removal and first-boot chooser

### Design

A new concept, distinct from filtering: `enabledFormats` in `useBookishSettings` is
the set of formats the app handles **at all**.

- **Detection chokepoint.** `useDeviceLibrarySync` currently tests
  `/\.(pdf|epub)$/i`. That test is built from `enabledFormats`, so a disabled
  format is never scanned, never imported and never re-detected after the fact. The
  manual Add-book picker gets the same restriction on its `accept` list and on its
  post-pick validation.
- **Purge on disable.** Disabling a format deletes those books' records, cached
  content, page maps and covers from app storage. Files on the device are never
  touched, so re-enabling lets the device scan re-import them.
- **Confirmation.** Disabling shows a count — "Remove 47 PDFs from your library?
  Your files stay on your device." — because it destroys app data.
- **First-boot modal.** `FormatChoiceModal`, shown once behind a `formatChoiceMade`
  flag, offering EPUB reader / PDF reader / Both. It runs before the first device
  scan, so a PDF-only choice means EPUBs are never imported in the first place.
- Preferences' existing "Book format" row is repurposed to this three-way control,
  with hint text making clear that it removes rather than hides.

---

## 7. Text visible below the chapter pill in scroll mode

`.reader-chapter-dock` is `position: fixed; bottom: var(--bottom-nav-space)` with an
opaque background, but the strip between its bottom edge and the screen bottom is
unpainted, so scrolling text shows through under the pill.

### Design

Anchor the dock at `bottom: 0` and move `--bottom-nav-space` into its
`padding-bottom`, plus `env(safe-area-inset-bottom)`. The dock paints continuously
to the bottom of the viewport; the pill keeps its current visual height, so nothing
else moves. Paged mode is unaffected — it is `inset: 0` and already opaque.

---

## 8. WPS-style Original View / Reflow mode for PDFs (mobile only)

### Research

WPS Office's reflow mode reorganises text, headings, images and tables from the
fixed page into a continuous flow, preserving font style, multi-level heading
hierarchy, relative positioning and hyperlink navigation, and exposing font size,
line spacing, background colour and page-turn controls. It exists because
pinch-zooming a fixed page on a phone is unusable. "Original View" is the
conventional fixed-page render.

Sources: [PDF Association](https://pdfa.org/wps-office-pdf-reflow-mode-optimizing-pdf-reading-experience-on-mobile-devices/),
[WPS Academy](https://www.wps.com/academy/how-to-use-the-read-mode-of-pdf-files/1861891/).

### Design

Everything reflow needs is already stored. `usePdfManifest` persists per-page
`items` with `str`, `width`, `height` and the full `transform` matrix, which yields
x, y and font size per text run. No re-parsing, and it works offline.

New `composables/usePdfReflow.js` turns manifest pages into reflowed blocks:

1. **Line assembly** — group items by baseline y within a tolerance derived from
   font size.
2. **Column detection** — cluster line x-centres; two well-separated clusters
   spanning the page height mean two columns, read column-major.
3. **Header/footer removal** — lines in the top and bottom margin bands whose text
   repeats across pages, or is a bare page number, are dropped.
4. **Heading detection** — font size meaningfully above the page's modal body size,
   and/or bold, and short. Mapped to h1–h3 by size rank, giving the multi-level
   hierarchy WPS preserves.
5. **Paragraph merging** — consecutive body lines join into one paragraph; a break
   is signalled by an indent, a short terminal line, or a vertical gap beyond normal
   leading. Hyphens are joined across line breaks.
6. **List detection** — bullet and number prefixes become `<ul>` / `<ol>`.
7. Output is HTML sections per page, cached to storage keyed by manifest version so
   it is computed once per book.

**Rendering.** Reflow output feeds the existing EPUB reading surfaces. That is the
main structural win: it inherits paged and scroll mode, the `--mr-*` typography
controls, sepia background, highlights, notes and TTS chunk highlighting with no new
code, because reflow blocks carry the manifest chunk ids they came from. Progress
stays in sync with Original View because both speak chunk indices (§2).

**UI.** The reader's display-settings sheet gains an Original View / Reflow
segmented control, PDF-only and mobile-only, persisted per book in
`useMobileReaderPrefs`. Original View renders today's canvas viewer unchanged.

**Stated limits.** Text-only by decision: figures and table grids do not appear in
reflow, and a "Switch to Original View" affordance covers that. Scanned PDFs with no
text layer have an empty manifest, so reflow is offered disabled with an explanation
rather than rendering a blank page.

---

## Sequencing

§7 and §5 are self-contained. §2 precedes §3. §6 precedes §4. §1 and §8 are
independent of everything else.
