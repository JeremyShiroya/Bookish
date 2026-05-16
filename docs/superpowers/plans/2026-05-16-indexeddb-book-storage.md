# IndexedDB Book Content Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace NeonDB `content` column storage with browser IndexedDB so book content is stored locally, eliminating slow server round-trips and reducing database size.

**Architecture:** A new `useBookStorage` composable wraps IndexedDB (database: `bookish-storage`, store: `book-content`, key: NeonDB book integer ID, value: `{ content: string, pages: number }`). At add time, extracted HTML is saved to IndexedDB after the NeonDB row is created (needs its ID). At read time, the reader pulls content from IndexedDB instead of the server. The `content` column is dropped from NeonDB entirely.

**Tech Stack:** Nuxt 4, Vue 3, Drizzle ORM, NeonDB (serverless Postgres), browser IndexedDB API, Vitest + @nuxt/test-utils

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `composables/useBookStorage.js` | **Create** | IndexedDB CRUD for book content |
| `composables/useBookStorage.test.js` | **Create** | Tests for above |
| `composables/useBooks.js` | **Modify** | `addBook` returns saved book; `deleteBook` cleans IndexedDB; `fetchBookById` drops content param |
| `components/AddBookComp.vue` | **Modify** | Capture extracted content locally; save to IndexedDB after book is created |
| `server/api/books/index.post.ts` | **Modify** | Remove `content` from DB insert |
| `server/api/books/[id].get.ts` | **Modify** | Remove `?content=true` query param logic |
| `server/database/schema.ts` | **Modify** | Drop `content` column from books table |
| `pages/reader/[id].vue` | **Modify** | Stage 2 reads from IndexedDB instead of server |

---

## Task 1: Create `useBookStorage` composable

**Files:**
- Create: `composables/useBookStorage.js`
- Create: `composables/useBookStorage.test.js`

- [ ] **Step 1: Write the failing tests**

Create `composables/useBookStorage.test.js` with this exact content:

```js
import { describe, it, expect } from 'vitest'
import { useBookStorage } from './useBookStorage.js'

describe('useBookStorage', () => {
  const { saveBookContent, getBookContent, deleteBookContent, hasBookContent } = useBookStorage()

  it('saves and retrieves content by bookId', async () => {
    await saveBookContent(1, { content: '<p>Hello</p>', pages: 10 })
    const result = await getBookContent(1)
    expect(result).toEqual({ content: '<p>Hello</p>', pages: 10 })
  })

  it('returns null for unknown bookId', async () => {
    const result = await getBookContent(9999)
    expect(result).toBeNull()
  })

  it('overwrites existing entry on second save', async () => {
    await saveBookContent(2, { content: '<p>Old</p>', pages: 5 })
    await saveBookContent(2, { content: '<p>New</p>', pages: 8 })
    const result = await getBookContent(2)
    expect(result).toEqual({ content: '<p>New</p>', pages: 8 })
  })

  it('deleteBookContent removes the entry', async () => {
    await saveBookContent(3, { content: '<p>Gone</p>', pages: 1 })
    await deleteBookContent(3)
    expect(await getBookContent(3)).toBeNull()
  })

  it('hasBookContent returns true when stored', async () => {
    await saveBookContent(4, { content: '<p>X</p>', pages: 2 })
    expect(await hasBookContent(4)).toBe(true)
  })

  it('hasBookContent returns false when not stored', async () => {
    expect(await hasBookContent(9998)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run composables/useBookStorage.test.js
```

Expected: FAIL — `Cannot find module './useBookStorage.js'`

- [ ] **Step 3: Create the composable**

Create `composables/useBookStorage.js` with this exact content:

```js
const DB_NAME = 'bookish-storage'
const STORE_NAME = 'book-content'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = (e) => resolve(e.target.result)
    request.onerror = (e) => reject(e.target.error)
  })
}

export const useBookStorage = () => {
  const saveBookContent = async (bookId, { content, pages }) => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ content, pages }, bookId)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
    })
  }

  const getBookContent = async (bookId) => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(bookId)
      req.onsuccess = (e) => resolve(e.target.result ?? null)
      req.onerror = (e) => reject(e.target.error)
    })
  }

  const deleteBookContent = async (bookId) => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(bookId)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
    })
  }

  const hasBookContent = async (bookId) => {
    const stored = await getBookContent(bookId)
    return stored !== null
  }

  return { saveBookContent, getBookContent, deleteBookContent, hasBookContent }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run composables/useBookStorage.test.js
```

Expected: All 6 tests PASS. If IndexedDB is unavailable in the test environment (error: `indexedDB is not defined`), add `// @vitest-environment happy-dom` as the first line of the test file and re-run.

- [ ] **Step 5: Commit**

```bash
git add composables/useBookStorage.js composables/useBookStorage.test.js
git commit -m "feat: add useBookStorage composable for IndexedDB book content"
```

---

## Task 2: Update `useBooks.js`

**Files:**
- Modify: `composables/useBooks.js`

Three changes: `addBook` must return the saved book so callers can get its ID; `deleteBook` must clean IndexedDB after deleting from NeonDB; `fetchBookById` drops the now-unused `includeContent` parameter.

- [ ] **Step 1: Add the import at the top of `useBooks.js`**

At the very top of `composables/useBooks.js`, after the existing imports, add:

```js
import { useBookStorage } from '~/composables/useBookStorage';
```

- [ ] **Step 2: Make `addBook` return the saved book**

Find the `addBook` function (currently around line 104). Replace it entirely with:

```js
  const addBook = async (book) => {
    try {
      const savedBook = await $fetch("/api/books", {
        method: "POST",
        body: book,
      });
      books.value.unshift(savedBook);
      await fetchAllData(true);
      return savedBook;
    } catch (error) {
      console.error("Failed to add book:", error);
      throw error;
    }
  };
```

- [ ] **Step 3: Update `deleteBook` to clean IndexedDB**

Find the `deleteBook` function (currently around line 148). Replace it entirely with:

```js
  const deleteBook = async (bookId) => {
    try {
      await $fetch(`/api/books/${bookId}`, {
        method: "DELETE",
      });
      books.value = books.value.filter((b) => b.id !== bookId);
      if (import.meta.client) {
        const { deleteBookContent } = useBookStorage();
        await deleteBookContent(bookId);
      }
      await fetchAllData(true);
    } catch (error) {
      console.error("Failed to delete book:", error);
    }
  };
```

- [ ] **Step 4: Simplify `fetchBookById` — drop the content parameter**

Find `fetchBookById` (currently around line 38). Replace it entirely with:

```js
  const fetchBookById = async (id) => {
    try {
      return await $fetch(`/api/books/${id}`);
    } catch (error) {
      console.error(`Failed to fetch book ${id}:`, error);
      return null;
    }
  };
```

- [ ] **Step 5: Run existing tests**

```bash
npx vitest run composables/useBooks.test.js
```

Expected: PASS (the existing test only checks `useBooks` is defined).

- [ ] **Step 6: Commit**

```bash
git add composables/useBooks.js
git commit -m "feat: addBook returns saved book, deleteBook cleans IndexedDB, fetchBookById simplified"
```

---

## Task 3: Update `AddBookComp.vue`

**Files:**
- Modify: `components/AddBookComp.vue`

Stop sending content to the server. Instead, capture it in a local ref and write to IndexedDB after the book is saved (using its NeonDB ID).

- [ ] **Step 1: Add imports and local state to the `<script setup>` block**

In `components/AddBookComp.vue`, find the existing imports block (around line 237):

```js
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBooks } from '~/composables/useBooks'
import { useToast } from '~/composables/useToast'
```

Replace with:

```js
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBooks } from '~/composables/useBooks'
import { useToast } from '~/composables/useToast'
import { useBookStorage } from '~/composables/useBookStorage'
```

Then, after the line `const { addToast } = useToast()`, add:

```js
const { saveBookContent } = useBookStorage()
const extractedContent = ref(null)
```

- [ ] **Step 2: Stop putting content on `newBook` in `handleDocumentChange`**

Find `handleDocumentChange` (around line 298). There are three places that set `newBook.value.content`. Replace each:

**For `.txt`/`.html`/`.htm` files** — find:
```js
    reader.onload = (e) => {
      newBook.value.content = e.target.result
      isProcessing.value = false
    }
```
Replace with:
```js
    reader.onload = (e) => {
      extractedContent.value = e.target.result
      isProcessing.value = false
    }
```

**For `.epub` files** — find:
```js
      const result = await extractEpub(file)
      newBook.value.content = result.content
      newBook.value.pages = result.pages || 0
```
Replace with:
```js
      const result = await extractEpub(file)
      extractedContent.value = result.content
      newBook.value.pages = result.pages || 0
```

**For `.pdf` files** — find:
```js
      const result = await extractPdf(file)
      newBook.value.content = result.content
      newBook.value.pages = result.pages || 0
```
Replace with:
```js
      const result = await extractPdf(file)
      extractedContent.value = result.content
      newBook.value.pages = result.pages || 0
```

- [ ] **Step 3: Update `saveBook` to write content to IndexedDB after creating the NeonDB row**

Find the `saveBook` function (around line 412). Replace the `try` block inside it:

```js
  try {
    await addBook(bookToSave);
    
    addToast('Book added to library successfully', 'success');
    router.push('/books');
  }
```

Replace with:

```js
  try {
    const savedBook = await addBook(bookToSave);

    if (extractedContent.value && savedBook?.id) {
      await saveBookContent(savedBook.id, {
        content: extractedContent.value,
        pages: savedBook.pages || 0,
      });
    }

    addToast('Book added to library successfully', 'success');
    router.push('/books');
  }
```

- [ ] **Step 4: Commit**

```bash
git add components/AddBookComp.vue
git commit -m "feat: store extracted book content in IndexedDB instead of NeonDB"
```

---

## Task 4: Update Server API Endpoints

**Files:**
- Modify: `server/api/books/index.post.ts`
- Modify: `server/api/books/[id].get.ts`

Remove all content-related logic from both endpoints.

- [ ] **Step 1: Remove `content` from the POST insert**

In `server/api/books/index.post.ts`, find the `db.insert(books).values({...})` call (around line 61). Remove the `content` line:

```ts
      content: body.content || null,   // DELETE THIS LINE
```

The values object should now end with `webReview: body.webReview || null,` and not include content.

- [ ] **Step 2: Simplify the GET endpoint**

Replace the entire contents of `server/api/books/[id].get.ts` with:

```ts
import { db } from '../../utils/db';
import { books } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id');

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Book ID is required',
      });
    }

    const result = await db.query.books.findFirst({
      where: eq(books.id, parseInt(id)),
      with: {
        author: true,
        genres: {
          with: {
            genre: true,
          },
        },
      },
    });

    if (!result) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Book not found',
      });
    }

    return {
      ...result,
      author: result.author?.name || 'Unknown Author',
      authorImage: result.author?.image || null,
      genres: result.genres.map((bg) => bg.genre.name),
    };
  } catch (error: any) {
    console.error('Fetch single book error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to fetch book',
    });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add server/api/books/index.post.ts server/api/books/[id].get.ts
git commit -m "feat: remove content field from book API endpoints"
```

---

## Task 5: Drop `content` Column from Schema and Run Migration

**Files:**
- Modify: `server/database/schema.ts`
- Creates: `server/database/migrations/<timestamp>_drop_content.sql` (auto-generated)

**Warning:** This permanently deletes all content stored in NeonDB. Confirm no content needs to be preserved before running the migration commands.

- [ ] **Step 1: Remove `content` from the books schema**

In `server/database/schema.ts`, find the books table definition. Remove this line from the `books` table:

```ts
  content: text('content'),
```

- [ ] **Step 2: Generate the migration file**

```bash
npx drizzle-kit generate
```

Expected output: Something like `Generated 1 migration file — server/database/migrations/0001_drop_content.sql`

Check the generated `.sql` file inside `server/database/migrations/` — it should contain an `ALTER TABLE books DROP COLUMN content;` statement.

- [ ] **Step 3: Apply the migration to NeonDB**

```bash
npx drizzle-kit migrate
```

Expected: `All migrations applied successfully`

- [ ] **Step 4: Commit**

```bash
git add server/database/schema.ts server/database/migrations/
git commit -m "feat: drop content column from books table"
```

---

## Task 6: Update the Reader to Load Content from IndexedDB

**Files:**
- Modify: `pages/reader/[id].vue`

Replace Stage 2 (server content fetch) with IndexedDB lookup.

- [ ] **Step 1: Add the import to the reader's `<script setup>`**

In `pages/reader/[id].vue`, find the existing import block (around line 77):

```js
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useBooks } from '~/composables/useBooks';
import { useTTS, stripHtml, splitToChunks } from '~/composables/useTTS';
```

Add one line after the existing imports:

```js
import { useBookStorage } from '~/composables/useBookStorage';
```

Then, after the line `const { books, fetchBookById, updateBook } = useBooks();`, add:

```js
const { getBookContent } = useBookStorage();
```

- [ ] **Step 2: Replace Stage 2 in `onMounted`**

Find the `onMounted` block (around line 262). The current Stage 2 section is:

```js
  // ── Stage 2: stream in the content ───────────────────────────────────────
  contentLoading.value = true;
  const full = await fetchBookById(id, true); // includes content
  if (full) book.value = full;
  contentLoading.value = false;
  await restoreScroll();
```

Replace with:

```js
  // ── Stage 2: load content from IndexedDB ─────────────────────────────────
  contentLoading.value = true;
  const stored = await getBookContent(id);
  if (stored) {
    book.value = { ...book.value, content: stored.content };
  }
  contentLoading.value = false;
  await restoreScroll();
```

- [ ] **Step 3: Clean up the Stage 1 call — remove the stale second argument**

In the same `onMounted` block, the Stage 1 call still passes a now-unused `false` argument. Find:

```js
    meta = await fetchBookById(id, false); // metadata only — fast
```

Replace with:

```js
    meta = await fetchBookById(id);
```

- [ ] **Step 4: Commit**

```bash
git add pages/reader/[id].vue
git commit -m "feat: reader loads book content from IndexedDB instead of server"
```

---

## Task 7: End-to-End Smoke Test

No automated test covers the full add→read flow. Verify manually:

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Add a new book**

Navigate to `/add`. Upload an EPUB or PDF, fill in title/author, click "Add Book to Library". The book should appear in the library.

- [ ] **Step 3: Open the book in the reader**

Click the book → reader opens. Confirm content loads (not the "Re-upload to read" message).

- [ ] **Step 4: Verify IndexedDB in DevTools**

Open Chrome DevTools → Application → IndexedDB → `bookish-storage` → `book-content`. Confirm an entry exists for the book's ID with `content` and `pages` fields.

- [ ] **Step 5: Verify NeonDB has no content**

Open DevTools → Network. Find the `GET /api/books/<id>` request. Confirm the response JSON has no `content` field.

- [ ] **Step 6: Test the deletion flow**

Delete the book from the library. Re-open DevTools → IndexedDB → `book-content`. Confirm the entry for that book ID is gone.

- [ ] **Step 7: Test the legacy fallback**

If any books existed before this change (added prior to Task 5 migration), navigate to their reader. Confirm they show "No readable content for this book. Re-upload the file to enable in-app reading." and not an error.

- [ ] **Step 8: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.
