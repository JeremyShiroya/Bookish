# Author Enrichment — Design Spec

**Date:** 2026-06-06  
**Status:** Approved

## Problem

The current author image and details search has two core failures:

1. **Name disambiguation** — searching for "John Green" or "James Patterson" can land on the wrong Wikipedia/Wikidata entity (a politician, a different artist, etc.), producing a wrong bio and wrong images.
2. **Image quality and quantity** — results are often 1–2 images, frequently incorrect or low resolution, because most sources are scraped via fragile Google/DuckDuckGo HTML parsing that breaks silently.

Both failures share the same root: we never confirm we have the right entity before pulling data from it.

## Solution Overview

Use Wikidata SPARQL to **disambiguate by book title** — query for a human entity whose authored works include a title that matches one of the author's known books in the library. This pins down the correct Wikidata QID with near-certainty. Everything else (image, bio, birth, nationality, genres) flows from that confirmed QID, eliminating the need for fragile HTML scraping.

---

## Architecture

### New Endpoint: `/api/authors/enrich.get.ts`

Replaces both `search-images.get.ts` and `scrape-image.get.ts`.

**Query params:**
- `name` (required) — author name
- `books` (optional) — comma-separated list of known book titles from the library
- `wikidataId` (optional) — if already stored, skips SPARQL and goes straight to enrichment

**Response:**
```ts
{
  wikidataId: string | null,        // QID — store this for instant future lookups
  wikipediaTitle: string | null,    // exact Wikipedia article title used
  image: string | null,             // best single portrait (Wikimedia Commons preferred)
  images: string[],                 // up to 12 candidates for the image picker
  bio: string | null,               // Wikipedia plain-text extract
  born: string | null,              // "1977" or "1977-06-26"
  nationality: string | null,       // e.g. "American"
  genres: string[],                 // e.g. ["dystopian fiction", "young adult"]
  confidence: 'high' | 'low' | null, // 'high' = SPARQL match, 'low' = fallback only
}
```

### Removal

`server/api/authors/search-images.get.ts` and `server/api/authors/scrape-image.get.ts` are deleted. The composable `useAuthorImageSearch.js` is replaced by a simpler `useAuthorEnrich.js`.

---

## Enrichment Flow

### Step 1 — SPARQL Disambiguation (primary)

Query `https://query.wikidata.org/sparql` with the author name and up to 5 known book titles as `VALUES`:

```sparql
SELECT DISTINCT ?author ?authorLabel ?image ?article WHERE {
  VALUES ?bookTitle { "The Hunger Games" "Catching Fire" }
  ?work wdt:P50 ?author ;
        wdt:P1476 ?bookTitle .
  ?author wdt:P31 wd:Q5 .
  OPTIONAL { ?author wdt:P18 ?image . }
  OPTIONAL {
    ?article schema:about ?author ;
             schema:isPartOf <https://en.wikipedia.org/> .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 5
```

If multiple results return, pick the one whose `?authorLabel` most closely matches `name` (exact match preferred, then Levenshtein distance). In practice a book title + `wdt:P31 wd:Q5` (human) constraint almost always returns a single result.

### Step 2 — Fallback (if SPARQL returns nothing)

1. Wikidata text search (`wbsearchentities`) by name — same as current code
2. Wikipedia search API + validate each candidate by checking if the article text mentions any known book title
3. If still no match: return `{ wikidataId: null, image: null, bio: null, ... }` so the UI can show a "not found" state with a manual override option

### Step 3 — Entity Enrichment (from confirmed QID)

Single `wbgetentities` call fetching claims + sitelinks:
- **P18** → Wikimedia Commons file name → resolve to full URL via `imageinfo` API
- **P569** (born) → extract year or full date
- **P27** (citizenship) → resolve to English label
- **P136** (genre) → resolve labels for up to 4 genres
- **sitelinks.enwiki** → Wikipedia article title

### Step 4 — Wikipedia Bio

Fetch `https://en.wikipedia.org/api/rest_v1/page/summary/{title}`:
- `extract` → bio text (plain text, no HTML)
- `originalimage.source` → additional high-res image
- `thumbnail.source` → thumbnail fallback

### Step 5 — Image Collection

Collect up to 12 images ranked by quality, from these sources in priority order:

1. **Wikidata P18** → Wikimedia Commons at 1000px width (highest quality, confirmed correct person)
2. **Wikipedia article image** → `originalimage` from summary endpoint
3. **Wikimedia Commons QID search** → `haswbstatement:P180=Q{QID}` finds images that explicitly depict the entity
4. **Wikipedia page images API** → `prop=images` on the article, filtered to exclude covers/logos/maps/signatures
5. **Open Library** → author photo IDs from `/search/authors.json?q={name}`, validated by checking that at least one book title matches
6. **Goodreads** (existing scraper) — supplement only, not primary

Google Images and DuckDuckGo scraping are removed entirely.

---

## Data Storage Changes

Add four new fields to the book record schema in IndexedDB (alongside the existing `authorImage` and `authorBio`):

| Field | Type | Description |
|---|---|---|
| `authorWikidataId` | `string \| null` | Wikidata QID — enables instant re-enrichment |
| `authorBorn` | `string \| null` | Birth year or full date |
| `authorNationality` | `string \| null` | Nationality label |
| `authorGenres` | `string[]` | Author's genres from Wikidata |

These are stored per book (same pattern as `authorImage`/`authorBio`) and written across all books by the same author when enrichment completes.

### New store method: `updateAuthorDetails`

Extends the existing `updateAuthorImage` pattern — writes all author fields atomically across all books with a matching `author` name:

```ts
updateAuthorDetails(authorName: string, details: {
  image?: string,
  bio?: string,
  wikidataId?: string,
  born?: string,
  nationality?: string,
  genres?: string[],
})
```

---

## Frontend Changes

### `AuthorDetailComp.vue`

- On mount, if `author.wikidataId` is already stored: call `/api/authors/enrich?name=X&wikidataId=Y` (skips SPARQL, instant)
- If not stored: call `/api/authors/enrich?name=X&books=Title1,Title2` (up to 5 titles from the author's books in the library)
- On success, call `updateAuthorDetails` to persist all fields
- Display new fields: born, nationality, genres as chips/tags below the author name

### `useAuthorEnrich.js` (replaces `useAuthorImageSearch.js`)

Simple composable that wraps the enrich endpoint call and exposes `{ enrich, images, loading, error }`. The image picker modal uses `images` from the enrich response instead of a separate search-images call.

### Image picker behaviour

The "Scrape Web" button on AuthorDetailComp triggers `enrich()`. The returned `images[]` are shown in the existing picker modal. No separate search-images endpoint needed.

---

## Error Handling

- SPARQL timeout (>10s): fall through to text search fallback
- Wikidata/Wikipedia rate limits: respect `Retry-After` headers; surface error to UI if all sources fail
- QID stored but entity deleted on Wikidata: detect 404/missing entity, clear `authorWikidataId`, re-run SPARQL
- No books provided + ambiguous name: return best-effort result with a `confidence: "low"` flag so the UI can optionally warn the user

---

## What Is Removed

- `server/api/authors/search-images.get.ts`
- `server/api/authors/scrape-image.get.ts`
- `composables/useAuthorImageSearch.js`
- All Google Images and DuckDuckGo scraping for authors
- The sequential `findWikipediaCandidates` bottleneck
