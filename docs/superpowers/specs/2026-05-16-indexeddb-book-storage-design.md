# IndexedDB Book Content Storage

**Date:** 2026-05-16
**Status:** Approved

## Problem

Book content (extracted EPUB/PDF HTML) is stored as a `text` column in NeonDB. This causes:
- Slow book opens (round-trip to serverless Postgres, payload can be several MB)
- High NeonDB storage usage
- Large POST payloads when adding books

## Solution

Move extracted book content out of NeonDB into browser IndexedDB. NeonDB retains only metadata (title, author, progress, etc.). Content is stored locally per-device, per-browser — identical to how local-first music players manage audio files.

## Decision: Existing Books

Clean break. Existing books lose their stored content. The reader already shows a "Re-upload to read" fallback when `content` is null — that fallback activates for all previously-added books. Users re-upload any book they want to read.

## IndexedDB Schema

```
Database:    bookish-storage  (version 1)
Object store: book-content
  key:   bookId  (integer — matches NeonDB books.id)
  value: { content: string (HTML), pages: number }
```

Content is stored as extracted HTML (same format the reader already uses), not as a raw file Blob. This means:
- Extraction happens once at add time (already needed for page count)
- Reads are near-instant (no re-extraction on every open)
- The reader template, TTS, and sanitizer all work unchanged

## Data Flows

### Adding a Book

```
Before: Upload → Extract → newBook.content = html → POST → NeonDB stores content
After:  Upload → Extract → extractedContent (local ref)
                → POST metadata only → receive { id, title, ... }
                → IndexedDB.save(bookId, { content, pages })
```

`addBook()` in `useBooks.js` must return the saved book object so `AddBookComp` can get the NeonDB ID needed as the IndexedDB key.

### Reading a Book

The reader uses a 2-stage load. Stage 1 (metadata) is unchanged.

```
Before stage 2: fetchBookById(id, true) → NeonDB content column → slow
After  stage 2: useBookStorage.getBookContent(id) → IndexedDB → fast
```

If IndexedDB has no entry → `book.value.content` stays null → existing "Re-upload to read" message renders. No new fallback code needed.

### Deleting a Book

After NeonDB delete, call `deleteBookContent(bookId)` to remove IndexedDB entry.

## Files Changed

| File | Change |
|---|---|
| `composables/useBookStorage.js` | **New** — IndexedDB wrapper |
| `composables/useBooks.js` | `addBook` returns saved book; `deleteBook` cleans IndexedDB |
| `components/AddBookComp.vue` | Stop putting content on `newBook`; save to IndexedDB after save |
| `server/api/books/index.post.ts` | Remove `content` from DB insert |
| `server/api/books/[id].get.ts` | Remove `?content=true` query param logic |
| `server/database/schema.ts` | Drop `content` column |
| `pages/reader/[id].vue` | Stage 2 reads from IndexedDB instead of server |

A Drizzle migration drops the `content` column from NeonDB (irreversible — run after confirming no content needs to be preserved).

## Out of Scope

- Cover images (stored as base64/URLs in NeonDB — separate concern)
- Raw file preservation (only extracted HTML is stored; original EPUB/PDF is not retained)
- Cross-device sync (IndexedDB is local to the browser; no sync mechanism)
- Electron / desktop packaging
