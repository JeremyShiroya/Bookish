# PDF Manifest and Author Totals Redesign

**Date:** 2026-06-14
**Status:** Approved

## Goal

Replace the failed PDF narration controls and author total counters rather than
continuing to patch their existing text-search and bibliography heuristics.

## Removed Implementations

The redesign removes:

- DOM text-layer search and `Range`-based PDF highlighting.
- Page-to-chunk inference from extracted HTML section counts.
- Reader navigation that depends on asynchronously observed page state.
- Author totals derived from Open Library `work_count` or generic Wikipedia
  bibliography item counts.

The status/narrator listbox, Goodreads fallback, TOC cleanup, author biography,
personal details, and author candidate matching remain outside this removal.

## Canonical PDF Manifest

PDF.js `getTextContent()` becomes the only source for PDF narration structure.
For every PDF page, Bookish builds a manifest containing:

- the page number;
- ordered text items and their PDF-space geometry;
- normalized page text;
- sentence-sized TTS chunks;
- each chunk's exact page number;
- each chunk's participating text-item spans.

The TTS engine receives the manifest's chunk strings directly for PDFs. The
reader, progress saving, highlighting, and navigation consume the same chunk
records. No subsystem independently re-splits or searches the document.

## Reader Behavior

### Highlight

The active TTS chunk ID selects one manifest record. Its text-item spans are
converted through the current PDF.js viewport transform and drawn as overlay
rectangles. Highlighting never searches DOM text and never scrolls the reader.

### Read From This Page

At click time, the viewer synchronously measures rendered page rectangles and
chooses the page intersecting a fixed anchor below the toolbar. The reader
starts the first manifest chunk assigned to that page. Empty pages advance to
the next page with a readable chunk. The selected page and progress are saved
immediately, including backward movement.

### Jump To Narration

The active manifest chunk already contains its page number and geometry.
Clicking Jump scrolls to that page and centers the first chunk rectangle.
Ordinary chunk changes do not move the viewport.

## Author Totals

Author profiles display:

- books owned in Bookish;
- total full-length books when a validated bibliography supplies one;
- series owned in Bookish;
- total named full-length-book series when validated.

Full-length totals exclude short stories, novellas, anthology contributions,
translations, alternate editions, adaptations, and duplicate regional titles.
The parser recognizes explicit full-length sections such as novels, standalone
novels, and named series. It does not treat a generic mixed “Published Works”
list as authoritative unless entries can be classified. Unknown totals display
as `?`; Bookish never substitutes provider record counts.

## Persistence

The PDF manifest is stored with the book content under a new manifest version.
Existing PDFs with an original source are rebuilt once on first reader load.
If rebuilding fails, the PDF remains viewable but narration controls are
disabled with a clear unavailable state.

## Verification

Automated tests cover:

- repeated sentences on one and multiple pages;
- words split across PDF text items;
- punctuation and quoted sentence endings;
- empty and image-only pages;
- exact page-to-first-chunk and chunk-to-page mapping;
- geometry spanning several text items and lines;
- backward progress updates;
- full-length bibliography inclusion/exclusion and title deduplication.

Generated adversarial PDF fixtures exercise rendering in the browser. Final QA
also uses the user's stored PDF in the in-app browser and repeats each reader
interaction several times before completion is claimed.
