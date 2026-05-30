# Local-First Library Migration Design

**Date:** 2026-05-30  
**Status:** Approved  

## Problem

Bookish is deployed on Vercel with a shared NeonDB (PostgreSQL) database. All users read from and write to the same database with no user separation. When any user adds a book, every other visitor sees that book listed — but the actual file only exists in the uploader's browser IndexedDB, so it cannot be opened by anyone else. This is architecturally wrong for a local-first app.

## Goal

Make Bookish behave like Nora Music Player: every user's library lives entirely in their own browser. No data leaves the device. No database is required to use the app.

## What Changes

### Deleted: NeonDB + Drizzle infrastructure

| File | Reason |
|---|---|
| `server/api/books/index.get.ts` | replaced by IndexedDB |
| `server/api/books/index.post.ts` | replaced by IndexedDB |
| `server/api/books/[id].get.ts` | replaced by IndexedDB |
| `server/api/books/[id].patch.ts` | replaced by IndexedDB |
| `server/api/books/[id].delete.ts` | replaced by IndexedDB |
| `server/api/authors/index.get.ts` | authors derived from books |
| `server/api/authors/[id].get.ts` | authors derived from books |
| `server/api/authors/[id].patch.ts` | authors derived from books |
| `server/api/collections/index.get.ts` | replaced by IndexedDB |
| `server/api/collections/index.post.ts` | replaced by IndexedDB |
| `server/api/collections/[id]/books.post.ts` | replaced by IndexedDB |
| `server/api/genres/index.get.ts` | genres derived from books |
| `server/api/books/backfill-pages.post.ts` | DB migration utility, no longer needed |
| `server/api/debug/` (3 files) | DB debug tools, no longer needed |
| `server/database/schema.ts` | no DB |
| `server/utils/db.ts` | no DB |
| `drizzle.config.ts` | no DB |

npm packages to remove: `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit`, `postgres` (if present).

### Kept: Utility server routes (no user data)

- `server/api/books/metadata.get.ts` — Google Books / Goodreads metadata lookup
- `server/api/books/search-covers.get.ts` — online cover image search
- `server/api/books/cache-cover.post.ts` — downloads a remote image URL and returns a data URL
- `server/api/authors/search-images.get.ts` — author photo search
- `server/api/authors/scrape-image.get.ts` — author image scraper
- `server/api/tts/index.post.ts` — text-to-speech

### New: `composables/useLibraryStore.js`

The single source of truth for library metadata in the browser. Owns all IndexedDB reads and writes for books and collections. No component or other composable touches IndexedDB metadata directly — they go through this.

**IndexedDB database:** `bookish-library`, version 1  
**Object stores:**
- `books` — keyPath: `id`
- `collections` — keyPath: `id`

**API:**
```js
getBooks()                              → Book[]
addBook(bookData)                       → Book   // assigns UUID + timestamps
updateBook(book)                        → Book   // updates updatedAt
deleteBook(id)                          → void
getCollections()                        → Collection[]
addCollection(collectionData)           → Collection
updateCollection(collection)            → Collection
addBookToCollection(collectionId, bookId) → void
```

IDs are generated with `crypto.randomUUID()`.

### Modified: `composables/useBooks.js`

All `$fetch('/api/books')`, `$fetch('/api/authors')`, `$fetch('/api/collections')`, and `$fetch('/api/genres')` calls are replaced with calls to `useLibraryStore`.

`authors` state becomes a computed unique list derived from `books.value` (group by `author` name, collect `authorImage` and `authorBio` per name).

`genres` state becomes a computed unique list of strings derived from `books.value` (flatten all `genres` arrays, deduplicate). Previously it was an array of `{ id, name }` objects from the DB — components that consume it must use the string directly, not `.name`. A quick grep confirms genres are only used as display strings, so this is safe.

Collections returned by `useBooks` must resolve `bookIds` into full book objects for components that iterate over `collection.books`. The `useBooks` composable handles this join in memory: when returning collections, map each `bookId` to the matching book in `books.value`.

The timeout/fetch infrastructure (`fetchWithTimeout`, `libraryFetchPromise`) is removed — local reads are synchronous enough not to need it.

## Data Model

### Book object (stored in IndexedDB `books` store)

```js
{
  id: string,              // crypto.randomUUID()
  title: string,
  author: string,          // denormalized name (no FK)
  authorImage: string|null,
  authorBio: string|null,
  genres: string[],        // ['Fantasy', 'Adventure']
  cover: string|null,      // data URL or null
  series: string|null,
  seriesInstallment: string|null,
  blurb: string|null,
  publishYear: number|null,
  genre: string|null,      // kept for backward compat (comma-separated string)
  webReview: string|null,
  progress: number,
  rating: number,
  format: string,
  pages: number,
  status: 'Unread'|'Reading'|'Read',
  isFavourite: boolean,
  createdAt: string,       // ISO 8601
  updatedAt: string        // ISO 8601
}
```

The shape is identical to what the current server GET /api/books returns (already flattened). No component changes needed for book display.

### Collection object (stored in IndexedDB `collections` store)

```js
{
  id: string,              // crypto.randomUUID()
  name: string,
  description: string|null,
  cover: string|null,
  bookIds: string[],       // replaces junction table
  createdAt: string,
  updatedAt: string
}
```

## Author Detail Routing

Currently `/author/[id]` uses NeonDB integer IDs. Since authors are now derived from books with no integer ID, the route param switches to the **URL-encoded author name**: `/author/J.R.R.%20Tolkien`.

Changes required:
- `pages/author/[id].vue` — read `route.params.id` as a decoded name, look up books by `book.author === name`
- Any component that generates author links (e.g., `AuthorsComp.vue`, book card links) — use `encodeURIComponent(book.author)` as the route param

## What Stays the Same

- `composables/useBookStorage.js` — unchanged. Still stores binary file content and parsed text in `bookish-storage` IndexedDB.
- All Vue pages and components — no template or style changes required. The shape of `books`, `authors`, `collections`, `genres` exposed by `useBooks` is preserved.
- Cover image caching via `useCoverImageCache.js` and `/api/books/cache-cover` — unchanged.
- Metadata fetch, cover search, TTS — unchanged.
- `EditBookComp.vue`, `AddBookComp.vue` — the `saveBook` / `updateBook` calls go through `useBooks`, which is the only file being rewritten. No direct component changes needed.
- `pages/reader/[id].vue` and all book-link navigation — book IDs change from integers to UUID strings. The URL shape (`/reader/abc-123-...`) changes, but since the app is client-side and there are no external links to preserve, this is acceptable. `useBookStorage.js` uses the ID as a plain key so UUID strings work without modification.

## Out of Scope

- Cross-device sync
- Export/import of the local library
- Migration of existing NeonDB data into the user's browser (the deployed app has the developer's books — they'll be wiped when NeonDB is disconnected, which is the desired outcome)
