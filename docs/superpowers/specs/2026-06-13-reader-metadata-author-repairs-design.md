# Reader, Metadata, and Author Repairs Design

**Date:** 2026-06-13
**Status:** Approved

## Goal

Repair metadata enrichment, PDF reading position, PDF narration highlighting,
author statistics/details, and inconsistent select controls without changing the
local-first storage model.

## Goodreads Metadata

Goodreads currently returns HTTP 202 anti-bot responses for both title redirects
and search pages. DuckDuckGo also returns an anti-bot response, so the current
fallback chain produces no Goodreads source and `webReview` remains empty.

The scraper will:

1. Keep the Goodreads title redirect because its final URL identifies the book
   even when the response status is 202.
2. Parse normal Goodreads HTML when a 200 response is available.
3. When direct HTML is blocked, request one proxied Google text-search result
   targeted at the resolved Goodreads URL, title, and author.
4. Parse only snippets that contain a matching title/author and an explicit
   Goodreads rating with ratings/reviews counts.
5. Cache successful and empty lookups briefly in memory and coalesce concurrent
   requests for the same title/author.

The Goodreads value remains Goodreads-only; ratings from other providers must
never populate `webReview`.

## Table of Contents

PDF TOC entries retain their original target page for navigation, but their
display titles are normalized. Dot leaders and trailing page numbers are
removed, for example:

`Chapter One ........ 14` becomes `Chapter One`.

## PDF Highlighting

The existing PDF highlighter estimates character positions by dividing a PDF.js
text item's rectangle by character count. Proportional fonts and PDF text runs
make that estimate inaccurate, causing missing first/last letters and shifted
highlights.

Each rendered page will include PDF.js's real `TextLayer`. The application will
map the normalized narration text to the text layer's actual DOM text nodes,
create a DOM `Range`, and use `Range.getClientRects()` relative to the page
container. The visible text layer remains transparent and non-interactive; the
existing colored overlay renders the measured rectangles.

This repair is scoped to PDFs because that is the reported and reproducible
format. EPUB behavior remains unchanged.

## Read From Here

PDF extraction already inserts one chapter break per page in stored text.
Reader chunk data will expose per-section chunk counts so PDF page N maps to the
first readable chunk in section N, rather than estimating by percentage.

When the user confirms "Read from here":

1. Capture the visible PDF page before opening the modal.
2. Resolve that page to its first readable chunk.
3. Start TTS with `ignoreSavedSession: true`.
4. Scroll back to the captured page with its top aligned.
5. Persist reading progress immediately from the captured page, allowing
   progress to move backward.

## Author Details

Author enrichment will use known library book titles to select the correct
Open Library and Wikidata/Wikipedia candidate. Provider failures remain
independent so one failed source does not suppress details from another.

The author profile will show two explicit collection statistics:

- **Books:** owned books / total known books
- **Series:** owned series / total known series

Total series is derived from the enriched bibliography by counting distinct
series when the provider exposes them. Unknown totals display as `owned / ?`.

The image search endpoint will remove the second uncached Wikipedia search pass,
use cached/coalesced provider calls, and treat HTTP 429 as an unavailable source
rather than a route-level error.

## Select Controls

Reading-status selects on add/edit forms and narrator selects in settings/player
will share a consistent styled wrapper: themed background, border, focus state,
padding, arrow icon, disabled state, and option colors.

## Testing

Focused Vitest coverage will verify:

- Goodreads blocked-response fallback and concurrent request coalescing
- TOC display-title cleanup without changing target pages
- PDF page-to-chunk mapping and backward progress calculation
- DOM text-range rectangle clipping at sentence boundaries
- author candidate matching and owned/total statistics

The final verification includes the focused tests, the main workspace test suite
excluding nested `.claude/worktrees`, a production build, and browser checks of
the affected rendered controls and available reader flows.
