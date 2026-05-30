# Local-First Library Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared NeonDB backend with browser IndexedDB so every user has a fully private, isolated library that never leaves their device.

**Architecture:** A new `useLibraryStore.js` composable owns all IndexedDB reads/writes for book metadata and collections. `useBooks.js` is rewritten to call the store instead of `$fetch`. Authors and genres are derived as computed values from the books array. All DB-backed server routes and Drizzle/Neon infrastructure are deleted.

**Tech Stack:** Vue 3 Composition API, Nuxt 4 (`useState`), IndexedDB (native browser API), `fake-indexeddb` (tests), Vitest.

---

## File Map

| Action | File |
|---|---|
| **Create** | `composables/useLibraryStore.js` |
| **Create** | `composables/useLibraryStore.test.js` |
| **Rewrite** | `composables/useBooks.js` |
| **Update** | `composables/useBooks.test.js` |
| **Update** | `components/CollectionsComp.vue` |
| **Update** | `components/AuthorsComp.vue` |
| **Rewrite script** | `components/AuthorDetailComp.vue` |
| **Delete** | `server/api/books/index.get.ts` |
| **Delete** | `server/api/books/index.post.ts` |
| **Delete** | `server/api/books/[id].get.ts` |
| **Delete** | `server/api/books/[id].patch.ts` |
| **Delete** | `server/api/books/[id].delete.ts` |
| **Delete** | `server/api/authors/index.get.ts` |
| **Delete** | `server/api/authors/[id].get.ts` |
| **Delete** | `server/api/authors/[id].patch.ts` |
| **Delete** | `server/api/collections/index.get.ts` |
| **Delete** | `server/api/collections/index.post.ts` |
| **Delete** | `server/api/collections/[id]/books.post.ts` |
| **Delete** | `server/api/genres/index.get.ts` |
| **Delete** | `server/api/books/backfill-pages.post.ts` |
| **Delete** | `server/api/debug/data-sizes.get.ts` |
| **Delete** | `server/api/debug/enrich-authors.get.ts` |
| **Delete** | `server/api/debug/fix-karin.get.ts` |
| **Delete** | `server/api/debug/manual-enrich.get.ts` |
| **Delete** | `server/database/schema.ts` |
| **Delete** | `server/utils/db.ts` |
| **Delete** | `drizzle.config.ts` |
| **Update** | `package.json` (remove neon/drizzle packages) |

---

## Task 1: Create `useLibraryStore.js` with tests

**Files:**
- Create: `composables/useLibraryStore.test.js`
- Create: `composables/useLibraryStore.js`

- [ ] **Step 1: Write the failing tests**

Create `composables/useLibraryStore.test.js`:

```js
import { IDBFactory } from 'fake-indexeddb'
import { describe, it, expect, beforeEach } from 'vitest'
import { useLibraryStore } from './useLibraryStore.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('useLibraryStore — books', () => {
  it('returns an empty array when no books exist', async () => {
    const { getBooks } = useLibraryStore()
    expect(await getBooks()).toEqual([])
  })

  it('adds a book and retrieves it', async () => {
    const { addBook, getBooks } = useLibraryStore()
    const book = await addBook({ title: 'Dune', author: 'Frank Herbert' })
    expect(book.id).toBeTruthy()
    expect(book.title).toBe('Dune')
    expect(book.createdAt).toBeTruthy()
    expect(book.updatedAt).toBeTruthy()
    const books = await getBooks()
    expect(books).toHaveLength(1)
    expect(books[0].title).toBe('Dune')
  })

  it('updates a book', async () => {
    const { addBook, updateBook, getBooks } = useLibraryStore()
    const book = await addBook({ title: 'Old Title', author: 'Author' })
    const updated = await updateBook({ ...book, title: 'New Title' })
    expect(updated.title).toBe('New Title')
    expect(updated.updatedAt).not.toBe(book.updatedAt)
    const books = await getBooks()
    expect(books[0].title).toBe('New Title')
  })

  it('deletes a book', async () => {
    const { addBook, deleteBook, getBooks } = useLibraryStore()
    const book = await addBook({ title: 'Delete Me', author: 'Author' })
    await deleteBook(book.id)
    expect(await getBooks()).toHaveLength(0)
  })

  it('updateAuthorImage sets authorImage on all books by that author', async () => {
    const { addBook, updateAuthorImage, getBooks } = useLibraryStore()
    await addBook({ title: 'Book A', author: 'J.K. Rowling', authorImage: null })
    await addBook({ title: 'Book B', author: 'J.K. Rowling', authorImage: null })
    await addBook({ title: 'Other', author: 'Stephen King', authorImage: null })
    await updateAuthorImage('J.K. Rowling', 'https://example.com/jkr.jpg')
    const books = await getBooks()
    const jkrBooks = books.filter(b => b.author === 'J.K. Rowling')
    const otherBooks = books.filter(b => b.author === 'Stephen King')
    expect(jkrBooks.every(b => b.authorImage === 'https://example.com/jkr.jpg')).toBe(true)
    expect(otherBooks[0].authorImage).toBeNull()
  })
})

describe('useLibraryStore — collections', () => {
  it('returns an empty array when no collections exist', async () => {
    const { getCollections } = useLibraryStore()
    expect(await getCollections()).toEqual([])
  })

  it('adds a collection with empty bookIds by default', async () => {
    const { addCollection, getCollections } = useLibraryStore()
    const col = await addCollection({ name: 'My Favs', description: 'Top picks' })
    expect(col.id).toBeTruthy()
    expect(col.name).toBe('My Favs')
    expect(col.bookIds).toEqual([])
    expect(await getCollections()).toHaveLength(1)
  })

  it('addBookToCollection appends a bookId', async () => {
    const { addCollection, addBookToCollection, getCollections } = useLibraryStore()
    const col = await addCollection({ name: 'Shelf' })
    await addBookToCollection(col.id, 'book-uuid-1')
    await addBookToCollection(col.id, 'book-uuid-2')
    const collections = await getCollections()
    expect(collections[0].bookIds).toEqual(['book-uuid-1', 'book-uuid-2'])
  })

  it('addBookToCollection does not duplicate bookIds', async () => {
    const { addCollection, addBookToCollection, getCollections } = useLibraryStore()
    const col = await addCollection({ name: 'No Dupes' })
    await addBookToCollection(col.id, 'book-uuid-1')
    await addBookToCollection(col.id, 'book-uuid-1')
    const collections = await getCollections()
    expect(collections[0].bookIds).toHaveLength(1)
  })

  it('updateCollection saves changes', async () => {
    const { addCollection, updateCollection, getCollections } = useLibraryStore()
    const col = await addCollection({ name: 'Original' })
    await updateCollection({ ...col, name: 'Updated' })
    const collections = await getCollections()
    expect(collections[0].name).toBe('Updated')
  })
})
```

- [ ] **Step 2: Run tests — expect all to fail**

```
npx vitest run composables/useLibraryStore.test.js
```

Expected: all tests fail with `Cannot find module './useLibraryStore.js'`

- [ ] **Step 3: Create `composables/useLibraryStore.js`**

```js
const DB_NAME = 'bookish-library'
const DB_VERSION = 1

function openLibraryDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('collections')) {
        db.createObjectStore('collections', { keyPath: 'id' })
      }
    }
    request.onsuccess = (e) => resolve(e.target.result)
    request.onerror = (e) => reject(e.target.error)
  })
}

export const useLibraryStore = () => {
  const getBooks = async () => {
    const db = await openLibraryDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readonly')
      const req = tx.objectStore('books').getAll()
      req.onsuccess = (e) => resolve(e.target.result)
      req.onerror = (e) => reject(e.target.error)
    })
  }

  const addBook = async (bookData) => {
    const now = new Date().toISOString()
    const book = { ...bookData, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite')
      tx.objectStore('books').put(book)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
    return book
  }

  const updateBook = async (book) => {
    const updated = { ...book, updatedAt: new Date().toISOString() }
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite')
      tx.objectStore('books').put(updated)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
    return updated
  }

  const deleteBook = async (id) => {
    const db = await openLibraryDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite')
      tx.objectStore('books').delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const getCollections = async () => {
    const db = await openLibraryDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readonly')
      const req = tx.objectStore('collections').getAll()
      req.onsuccess = (e) => resolve(e.target.result)
      req.onerror = (e) => reject(e.target.error)
    })
  }

  const addCollection = async (collectionData) => {
    const now = new Date().toISOString()
    const collection = {
      ...collectionData,
      id: crypto.randomUUID(),
      bookIds: collectionData.bookIds || [],
      createdAt: now,
      updatedAt: now,
    }
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readwrite')
      tx.objectStore('collections').put(collection)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
    return collection
  }

  const updateCollection = async (collection) => {
    const updated = { ...collection, updatedAt: new Date().toISOString() }
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readwrite')
      tx.objectStore('collections').put(updated)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
    return updated
  }

  const addBookToCollection = async (collectionId, bookId) => {
    const db = await openLibraryDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readwrite')
      const store = tx.objectStore('collections')
      const req = store.get(collectionId)
      req.onsuccess = (e) => {
        const collection = e.target.result
        if (!collection) {
          reject(new Error(`Collection ${collectionId} not found`))
          return
        }
        if (!collection.bookIds.includes(bookId)) {
          collection.bookIds = [...collection.bookIds, bookId]
          collection.updatedAt = new Date().toISOString()
          store.put(collection)
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  const updateAuthorImage = async (authorName, imageUrl) => {
    const books = await getBooks()
    const authorBooks = books.filter(b => b.author === authorName)
    if (!authorBooks.length) return
    const db = await openLibraryDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite')
      const store = tx.objectStore('books')
      const now = new Date().toISOString()
      for (const book of authorBooks) {
        store.put({ ...book, authorImage: imageUrl, updatedAt: now })
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject(e.target.error)
      tx.onabort = (e) => reject(e.target.error ?? new DOMException('Transaction aborted'))
    })
  }

  return {
    getBooks,
    addBook,
    updateBook,
    deleteBook,
    getCollections,
    addCollection,
    updateCollection,
    addBookToCollection,
    updateAuthorImage,
  }
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```
npx vitest run composables/useLibraryStore.test.js
```

Expected: all 10 tests pass

- [ ] **Step 5: Commit**

```
git add composables/useLibraryStore.js composables/useLibraryStore.test.js
git commit -m "feat: add useLibraryStore composable (IndexedDB metadata layer)"
```

---

## Task 2: Rewrite `composables/useBooks.js`

**Files:**
- Modify: `composables/useBooks.js`

Key changes from old to new:
- `fetchAllData` → calls `store.getBooks()` + `store.getCollections()` instead of 4 `$fetch` calls
- `addBook` → calls `store.addBook()`
- `updateBook` → calls `store.updateBook()`
- `deleteBook` → calls `store.deleteBook()`
- `createPlaylist` → calls `store.addCollection()`
- `addBookToPlaylist` → calls `store.addBookToCollection()`
- `cacheRemoteLibraryCovers` → calls local `updateBook()` instead of `$fetch`
- `authors` → computed from `books.value` (no longer a server-fetched `useState`)
- `genres` → computed from `books.value` (no longer a server-fetched `useState`)
- `fetchBookById` → synchronous lookup in `books.value` (was async `$fetch`)
- Removed: `resolveLibraryDataResult`, `fetchWithTimeout`, `libraryFetchPromise`

- [ ] **Step 1: Replace `composables/useBooks.js` entirely**

```js
import { ref, computed } from "vue";
import { useState } from "#app";
import { useBookStorage } from '~/composables/useBookStorage';
import { isRemoteCoverUrl, useCoverImageCache } from '~/composables/useCoverImageCache';
import { getGoodreadsRating } from '~/composables/useGoodreadsRating';
import { useLibraryStore } from '~/composables/useLibraryStore';

const coverCacheInFlight = new Set();

export const useBooks = () => {
  const books = useState('library:books', () => []);
  const collections = useState('library:collections', () => []);
  const loading = useState('library:loading', () => false);
  const initialized = useState('library:initialized', () => false);
  const error = useState('library:error', () => null);

  const authors = computed(() => {
    const authorMap = new Map();
    for (const book of books.value) {
      const name = book.author;
      if (!name) continue;
      if (!authorMap.has(name)) {
        authorMap.set(name, { id: encodeURIComponent(name), name, image: null, bio: null, bookCount: 0 });
      }
      const entry = authorMap.get(name);
      entry.bookCount++;
      if (book.authorImage && !entry.image) entry.image = book.authorImage;
      if (book.authorBio && !entry.bio) entry.bio = book.authorBio;
    }
    return [...authorMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  const genres = computed(() => {
    const seen = new Set();
    const result = [];
    for (const book of books.value) {
      const bookGenres = book.genres?.length
        ? book.genres
        : (book.genre ? book.genre.split(',').map(g => g.trim()).filter(Boolean) : []);
      for (const name of bookGenres) {
        if (name && !seen.has(name)) {
          seen.add(name);
          result.push({ id: name, name });
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  });

  const cacheRemoteLibraryCovers = async () => {
    if (!import.meta.client) return;
    const { cacheCoverImage } = useCoverImageCache();
    const remoteCoverBooks = books.value.filter(book =>
      book?.id && isRemoteCoverUrl(book.cover) && !coverCacheInFlight.has(book.id)
    );
    for (const book of remoteCoverBooks) {
      coverCacheInFlight.add(book.id);
      try {
        const cachedCover = await cacheCoverImage(book.cover);
        if (!cachedCover || cachedCover === book.cover) continue;
        const index = books.value.findIndex(item => item.id === book.id);
        if (index !== -1) {
          books.value[index] = { ...books.value[index], cover: cachedCover };
          await updateBook(books.value[index]);
        }
      } catch (err) {
        console.warn('Failed to cache remote cover:', err);
      } finally {
        coverCacheInFlight.delete(book.id);
      }
    }
  };

  const fetchAllData = async (force = false) => {
    if (initialized.value && !force) {
      loading.value = false;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const store = useLibraryStore();
      const [booksData, collectionsData] = await Promise.all([
        store.getBooks(),
        store.getCollections(),
      ]);
      books.value = booksData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      collections.value = collectionsData;
      cacheRemoteLibraryCovers();
    } catch (fetchError) {
      console.error('Failed to load library:', fetchError);
      error.value = 'Bookish could not load your library.';
    } finally {
      initialized.value = true;
      loading.value = false;
    }
  };

  const fetchBookById = (id) => {
    return books.value.find(b => String(b.id) === String(id)) ?? null;
  };

  if (!initialized.value && import.meta.client) {
    fetchAllData();
  }

  const recentlyAddedBooks = computed(() =>
    [...books.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10)
  );

  const recentlyReadBooks = computed(() =>
    books.value
      .filter(b => b.status === 'Reading' || b.progress > 0)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  );

  const favourites = computed(() => books.value.filter(b => b.isFavourite));

  const recentAuthors = computed(() => authors.value.slice(0, 4));

  const seriesList = computed(() => {
    const grouped = {};
    books.value.forEach(book => {
      if (book.series) {
        if (!grouped[book.series]) {
          grouped[book.series] = { name: book.series, author: book.author, books: [] };
        }
        grouped[book.series].books.push(book);
      }
    });
    return Object.values(grouped);
  });

  const genresList = computed(() => genres.value);
  const allAuthors = computed(() => authors.value);

  const toggleFavourite = async (bookId) => {
    const book = books.value.find(b => b.id === bookId);
    if (book) await updateBook({ ...book, isFavourite: !book.isFavourite });
  };

  const addBook = async (book) => {
    try {
      const store = useLibraryStore();
      const savedBook = await store.addBook(book);
      books.value.unshift(savedBook);
      return savedBook;
    } catch (err) {
      console.error('Failed to add book:', err);
      throw err;
    }
  };

  const updateBook = async (updatedBook) => {
    const index = books.value.findIndex(b => b.id === updatedBook.id);
    let previousBook = null;
    if (index !== -1) {
      previousBook = { ...books.value[index] };
      books.value[index] = { ...books.value[index], ...updatedBook };
    }
    try {
      const store = useLibraryStore();
      const result = await store.updateBook(index !== -1 ? books.value[index] : updatedBook);
      if (index !== -1) books.value[index] = result;
    } catch (err) {
      console.error('Failed to update book:', err);
      if (index !== -1 && previousBook) books.value[index] = previousBook;
    }
  };

  const deleteBook = async (bookId) => {
    const previousBooks = [...books.value];
    books.value = books.value.filter(b => b.id !== bookId);
    try {
      const store = useLibraryStore();
      const deleteContentPromise = import.meta.client
        ? useBookStorage().deleteBookContent(bookId)
        : Promise.resolve();
      await Promise.all([store.deleteBook(bookId), deleteContentPromise]);
    } catch (err) {
      books.value = previousBooks;
      console.error('Failed to delete book:', err);
    }
  };

  const createPlaylist = async (playlist) => {
    try {
      const store = useLibraryStore();
      const savedPlaylist = await store.addCollection(playlist);
      collections.value.unshift(savedPlaylist);
      return savedPlaylist;
    } catch (err) {
      console.error('Failed to create playlist:', err);
      throw err;
    }
  };

  const addBookToPlaylist = async (playlistId, bookId) => {
    try {
      const store = useLibraryStore();
      await store.addBookToCollection(playlistId, bookId);
      await fetchAllData(true);
    } catch (err) {
      console.error('Failed to add book to playlist:', err);
      throw err;
    }
  };

  const popularBooks = computed(() =>
    [...books.value]
      .sort((a, b) => {
        const diff = getGoodreadsRating(b) - getGoodreadsRating(a);
        if (diff !== 0) return diff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, 4)
  );

  return {
    books,
    authors,
    collections,
    genres,
    loading,
    initialized,
    error,
    recentAuthors,
    recentlyAddedBooks,
    recentlyReadBooks,
    favourites,
    popularBooks,
    seriesList,
    genresList,
    allAuthors,
    toggleFavourite,
    addBook,
    updateBook,
    deleteBook,
    createPlaylist,
    addBookToPlaylist,
    fetchAllData,
    fetchBookById,
  };
};
```

- [ ] **Step 2: Commit**

```
git add composables/useBooks.js
git commit -m "refactor: rewrite useBooks to use local IndexedDB instead of server API"
```

---

## Task 3: Update `composables/useBooks.test.js`

**Files:**
- Modify: `composables/useBooks.test.js`

`resolveLibraryDataResult` no longer exists. Remove tests that import or use it. Keep the Goodreads rating test.

- [ ] **Step 1: Replace `composables/useBooks.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { useBooks } from '~/composables/useBooks'
import { getGoodreadsRating } from '~/composables/useGoodreadsRating'

describe('useBooks', () => {
  it('should be resolvable', () => {
    expect(useBooks).toBeDefined()
  })

  it('parses Goodreads ratings from saved web reviews', () => {
    expect(getGoodreadsRating({ webReview: 'Goodreads Rating: 4.28/5 (based on 1,511,111 reviews).' })).toBe(4.28)
    expect(getGoodreadsRating({ webReview: 'Rating: 3.91/5' })).toBe(3.91)
    expect(getGoodreadsRating({ webReview: '' })).toBe(0)
  })
})
```

- [ ] **Step 2: Run the full test suite**

```
npx vitest run
```

Expected: all tests pass (useLibraryStore tests + useBooks tests + existing useBookStorage tests)

- [ ] **Step 3: Commit**

```
git add composables/useBooks.test.js
git commit -m "test: update useBooks tests after removing resolveLibraryDataResult"
```

---

## Task 4: Fix component — `CollectionsComp.vue`

**Files:**
- Modify: `components/CollectionsComp.vue`

The server previously returned a `bookCount` field on each collection. In the local-first model, collections only have `bookIds`. The component's `collectionsWithBooks` computed must derive `bookCount` from `bookIds.length`.

- [ ] **Step 1: Add `bookCount` to the `collectionsWithBooks` computed**

In `components/CollectionsComp.vue`, find the `collectionsWithBooks` computed (lines 70–84). Change the return value from:

```js
    return {
      ...collection,
      previewBooks
    };
```

to:

```js
    return {
      ...collection,
      bookCount: bookIds.length,
      previewBooks
    };
```

- [ ] **Step 2: Commit**

```
git add components/CollectionsComp.vue
git commit -m "fix: derive bookCount from bookIds in CollectionsComp"
```

---

## Task 5: Fix component — `AuthorsComp.vue`

**Files:**
- Modify: `components/AuthorsComp.vue`

Authors no longer have integer IDs. The `author.id` field is now `encodeURIComponent(author.name)`. The router push already uses `author.id`, so only the field name change in `useBooks` propagates — but the push target must use the name so the detail page can decode it. Since `author.id = encodeURIComponent(author.name)` in the new `useBooks`, the existing `router.push('/author/${author.id}')` already produces the right URL.

Verify this is correct by checking `AuthorsComp.vue` line 19:
```js
@click="router.push(`/author/${author.id}`)"
```

Since `author.id` is now `encodeURIComponent(author.name)`, this produces `/author/J.R.R.%20Tolkien` which is correct. **No change needed to `AuthorsComp.vue`.**

- [ ] **Step 1: Verify no change needed**

Open `components/AuthorsComp.vue` and confirm line 19 reads:
```js
@click="router.push(`/author/${author.id}`)"
```

If it reads this exactly, no edit is required. Move to Task 6.

---

## Task 6: Rewrite `AuthorDetailComp.vue` script

**Files:**
- Modify: `components/AuthorDetailComp.vue` (script section only — template is unchanged)

Old script:
- Looks up author by integer ID from `route.params.id` via `$fetch('/api/authors/${id}')`
- Updates author image via `$fetch('/api/authors/${id}', { method: 'PATCH' })`

New script:
- Decodes author name from `route.params.id` via `decodeURIComponent()`
- Derives author data from `globalBooks` and `globalAuthors` (already in `useBooks`)
- Updates author image via `useLibraryStore().updateAuthorImage()`
- Uses `watchEffect` instead of `onMounted` so the view reacts when books load

- [ ] **Step 1: Replace the `<script setup>` block in `components/AuthorDetailComp.vue`**

Find the opening `<script setup>` tag (line 188) through the closing `</script>` tag (line 354). Replace the entire block with:

```vue
<script setup>
import { ref, computed, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTTS } from '~/composables/useTTS';
import { useToast } from '~/composables/useToast';
import { useBooks } from '~/composables/useBooks';
import { useLibraryStore } from '~/composables/useLibraryStore';
import { fetchAuthorImageResults } from '~/composables/useAuthorImageSearch';

const route = useRoute();
const router = useRouter();
const { play: playTTS } = useTTS();
const { addToast } = useToast();
const { fetchAllData, authors: globalAuthors, books: globalBooks, initialized } = useBooks();

const author = ref(null);
const loading = ref(true);
const error = ref(null);
const isScraping = ref(false);
const showEditChoice = ref(false);
const showImagePicker = ref(false);
const imageOptions = ref([]);

const fetchAuthor = () => {
  const authorName = decodeURIComponent(route.params.id);
  const authorBooks = globalBooks.value.filter(b => b.author === authorName);
  const authorInfo = globalAuthors.value.find(a => a.name === authorName);

  if (authorBooks.length > 0) {
    author.value = {
      name: authorName,
      image: authorInfo?.image ?? authorBooks.find(b => b.authorImage)?.authorImage ?? null,
      bio: authorInfo?.bio ?? authorBooks.find(b => b.authorBio)?.authorBio ?? null,
      books: authorBooks,
    };
    error.value = null;
  } else if (initialized.value) {
    error.value = 'Author not found in your library.';
    author.value = null;
  }
  loading.value = false;
};

watchEffect(() => {
  if (!initialized.value) {
    loading.value = true;
    return;
  }
  fetchAuthor();
});

const handleImageClick = () => {
  showEditChoice.value = true;
};

const triggerFileUpload = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await updateAuthorImage(reader.result);
      addToast('Image uploaded successfully', 'success');
    };
    reader.readAsDataURL(file);
  };
  input.click();
  showEditChoice.value = false;
};

const scrapeAuthorImage = async () => {
  if (!author.value) return;
  try {
    isScraping.value = true;
    showEditChoice.value = false;
    showImagePicker.value = true;
    imageOptions.value = [];
    const images = await fetchAuthorImageResults(author.value.name);
    if (images.length > 0) {
      imageOptions.value = images;
    } else {
      showImagePicker.value = false;
      addToast('Could not find any suitable images on the web.', 'error');
    }
  } catch (err) {
    console.error('Scrape failed:', err);
    showImagePicker.value = false;
    addToast('Failed to search for images.', 'error');
  } finally {
    isScraping.value = false;
  }
};

const selectImage = async (imgUrl) => {
  showImagePicker.value = false;
  await updateAuthorImage(imgUrl);
  addToast('Author image updated', 'success');
};

const removeImageOption = (imgUrl) => {
  imageOptions.value = imageOptions.value.filter(img => img !== imgUrl);
};

const updateAuthorImage = async (newImageUrl) => {
  try {
    isScraping.value = true;
    const authorName = decodeURIComponent(route.params.id);
    await useLibraryStore().updateAuthorImage(authorName, newImageUrl);
    if (author.value) author.value = { ...author.value, image: newImageUrl };
    await fetchAllData(true);
  } catch (err) {
    console.error('Update failed:', err);
    addToast('Failed to update image.', 'error');
  } finally {
    isScraping.value = false;
  }
};

const totalPages = computed(() => {
  if (!author.value?.books) return 0;
  return author.value.books.reduce((acc, b) => acc + (b.pages || 0), 0);
});

const handlePlay = (book) => {
  playTTS(book);
};

const resolveBookCover = (book) => {
  if (book.cover && !book.cover.startsWith('blob:')) return book.cover;
  return '/placeholder-book.png';
};
</script>
```

- [ ] **Step 2: Commit**

```
git add components/AuthorDetailComp.vue
git commit -m "refactor: rewrite AuthorDetailComp to use local book data instead of author API"
```

---

## Task 7: Delete DB-backed server routes and infrastructure

**Files:** (all deleted)

- [ ] **Step 1: Delete the DB-backed book, author, collection, and genre API routes**

```
git rm server/api/books/index.get.ts
git rm server/api/books/index.post.ts
git rm "server/api/books/[id].get.ts"
git rm "server/api/books/[id].patch.ts"
git rm "server/api/books/[id].delete.ts"
git rm server/api/authors/index.get.ts
git rm "server/api/authors/[id].get.ts"
git rm "server/api/authors/[id].patch.ts"
git rm server/api/collections/index.get.ts
git rm server/api/collections/index.post.ts
git rm "server/api/collections/[id]/books.post.ts"
git rm server/api/genres/index.get.ts
git rm server/api/books/backfill-pages.post.ts
```

- [ ] **Step 2: Delete debug routes and DB infrastructure files**

```
git rm server/api/debug/data-sizes.get.ts
git rm server/api/debug/enrich-authors.get.ts
git rm server/api/debug/fix-karin.get.ts
git rm server/api/debug/manual-enrich.get.ts
git rm server/database/schema.ts
git rm server/utils/db.ts
git rm drizzle.config.ts
```

- [ ] **Step 3: Confirm directory cleanup**

After deletion, `server/api/debug/` and `server/database/` directories should be empty. Verify:

```
git status
```

Expected: all deleted files shown as `deleted:` in staging area. No untracked stragglers.

- [ ] **Step 4: Commit**

```
git commit -m "chore: delete DB-backed server routes and Drizzle/Neon infrastructure"
```

---

## Task 8: Remove DB packages from `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Uninstall the packages**

```
npm uninstall @neondatabase/serverless drizzle-orm
npm uninstall --save-dev drizzle-kit
```

- [ ] **Step 2: Verify `package.json` no longer contains them**

Open `package.json` and confirm none of these appear:
- `@neondatabase/serverless`
- `drizzle-orm`
- `drizzle-kit`

- [ ] **Step 3: Run the test suite one final time**

```
npx vitest run
```

Expected: all tests pass

- [ ] **Step 4: Verify the dev build starts without errors**

```
npm run dev
```

Expected: server starts, no import errors for `drizzle-orm` or `@neondatabase/serverless`, no `DATABASE_URL` error thrown on startup.

- [ ] **Step 5: Commit**

```
git add package.json package-lock.json
git commit -m "chore: remove @neondatabase/serverless, drizzle-orm, drizzle-kit dependencies"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| New `useLibraryStore.js` composable | Task 1 |
| `books` store keyed by UUID, `collections` store keyed by UUID | Task 1 |
| `updateAuthorImage` on all books by author name | Task 1 |
| Rewrite `useBooks.js` — replace `$fetch` with store calls | Task 2 |
| `authors` computed from books | Task 2 |
| `genres` computed from books as `{ id, name }[]` | Task 2 |
| Remove `resolveLibraryDataResult` | Task 2 + Task 3 |
| Fix `CollectionsComp` `bookCount` | Task 4 |
| Author routing via encoded name | Task 5 (verified no change needed) |
| Rewrite `AuthorDetailComp` — remove API calls | Task 6 |
| Delete all DB-backed server routes | Task 7 |
| Remove DB infrastructure files | Task 7 |
| Remove npm packages | Task 8 |
| Keep utility server routes (TTS, metadata, covers) | Verified untouched — not in delete list |

All spec requirements covered. ✓
