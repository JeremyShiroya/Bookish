import { computed } from "vue";
import { useState } from "#app";
import { useBookStorage } from '~/composables/useBookStorage';
import { coverAssetName, isLocalAssetCover, isRemoteCoverUrl, useCoverImageCache } from '~/composables/useCoverImageCache';
import { useDeviceAssets } from '~/composables/useDeviceAssets';
import { coverPlaceholder } from '~/composables/useCoverFallback';
import { getGoodreadsRating } from '~/composables/useGoodreadsRating';
import { useLibraryStore } from '~/composables/useLibraryStore';
import { useApiEndpoint } from '~/composables/useApiEndpoint';
import { readBookishSettings } from '~/composables/useBookishSettings';

const coverCacheInFlight = new Set();

// Reading status and progress are two views of the same fact, and the cards
// read progress while the filters read status. Editing one without the other
// left books that filtered as "Unread" but still rendered a 100% badge, so
// every write path routes the pair through here.
export const reconcileStatusProgress = (status, progress) => {
  const clamped = Math.max(0, Math.min(100, Number(progress) || 0));

  if (status === 'Read') return 100;
  if (status === 'Unread') return 0;
  // "Reading" is by definition unfinished: a full 100 would render the
  // complete badge on a book the user just said they're still reading.
  return Math.min(99, clamped);
};

export const normalizeLibrarySeriesName = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export const canonicalLibrarySeriesName = (value) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

export const groupBooksBySeries = (sourceBooks = []) => {
  const grouped = new Map();

  for (const book of sourceBooks) {
    const displayName = canonicalLibrarySeriesName(book?.series);
    const key = normalizeLibrarySeriesName(displayName);
    if (!key) continue;

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: encodeURIComponent(displayName),
        name: displayName,
        author: book.author,
        seriesTotal: null,
        books: [],
      });
    }

    const group = grouped.get(key);
    const seriesTotal = Number(book?.seriesTotal || 0);
    if (Number.isFinite(seriesTotal) && seriesTotal > Number(group.seriesTotal || 0)) {
      group.seriesTotal = seriesTotal;
    }

    group.books.push({
      ...book,
      series: displayName,
    });
  }

  return [...grouped.values()];
};

export const useBooks = () => {
  const { apiUrl } = useApiEndpoint()
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

  // Downloads every remote cover to on-device storage and rewrites each book's
  // cover to the local file, so covers render instantly and survive going
  // offline. Also self-heals covers that point at a device file which is no
  // longer there: it re-downloads from the saved remote source when we still
  // have it, or clears the cover to a placeholder so a metadata refetch can
  // supply a fresh one. Runs opportunistically after each library load, and can
  // be driven manually from Settings → Storage (with progress + a summary).
  const cacheRemoteLibraryCovers = async ({ onProgress, shouldStop } = {}) => {
    if (!import.meta.client) return { total: 0, cached: 0, failed: 0, repaired: 0 };
    const { cacheCoverImage } = useCoverImageCache();
    const { exists } = useDeviceAssets();

    // Resolve the remote URL we should download for a book: a live remote cover,
    // or the saved source of one that's already (or was) cached on device.
    const remoteSourceFor = (book) => {
      if (isRemoteCoverUrl(book.cover)) return book.cover;
      if (isRemoteCoverUrl(book.coverSource)) return book.coverSource;
      return null;
    };

    const targets = books.value.filter(book =>
      book?.id && !coverCacheInFlight.has(book.id)
      && (remoteSourceFor(book) || isLocalAssetCover(book.cover))
    );
    const total = targets.length;
    let cached = 0;
    let failed = 0;
    let repaired = 0;

    for (let i = 0; i < targets.length; i += 1) {
      if (shouldStop?.()) break;
      const book = targets[i];
      onProgress?.({ current: i + 1, total, title: book.title });
      coverCacheInFlight.add(book.id);
      try {
        // A cover that already renders offline is authoritative — coverSource
        // is only a recovery pointer for a lost file, never an override. It can
        // lag behind the cover (picking a new cover via web search updates the
        // cover first), and re-caching it here is what used to revert a freshly
        // chosen cover on the next app open.
        if (typeof book.cover === 'string' && book.cover.startsWith('data:image/')
          && !book.cover.startsWith('data:image/svg+xml')) {
          continue;
        }
        if (isLocalAssetCover(book.cover)) {
          const name = coverAssetName(book.cover);
          if (name && await exists('covers', name)) continue;
          if (!remoteSourceFor(book)) {
            // Source lost and the file is gone — blank it to a clean placeholder
            // so it stops 404-ing and a metadata fetch can refill it.
            await patchBookCover(book.id, { cover: coverPlaceholder(book.title), coverSource: '' });
            repaired += 1;
            continue;
          }
        }

        const source = remoteSourceFor(book);
        if (!source) { failed += 1; continue; }

        const cachedCover = await cacheCoverImage(source);
        if (!cachedCover || cachedCover === book.cover || cachedCover === source) {
          // Unchanged means the download never landed (dead link, blocked, or
          // offline). Remember the source so a later run can retry / heal it.
          if (book.coverSource !== source) await patchBookCover(book.id, { coverSource: source });
          failed += 1;
          continue;
        }
        await patchBookCover(book.id, { cover: cachedCover, coverSource: source });
        cached += 1;
      } catch (err) {
        console.warn('Failed to cache remote cover:', err);
        failed += 1;
      } finally {
        coverCacheInFlight.delete(book.id);
      }
    }
    return { total, cached, failed, repaired };
  };

  // Apply a cover patch to the in-memory list and persist it.
  const patchBookCover = async (id, patch) => {
    const index = books.value.findIndex(item => item.id === id);
    if (index === -1) return;
    books.value[index] = { ...books.value[index], ...patch };
    await updateBook(books.value[index]);
  };

  const fetchAllData = async (force = false) => {
    if (initialized.value && !force) {
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
      // "Hide content" (Settings → Preferences) previews the app as though
      // the library were empty: nothing enters the in-memory library, while
      // IndexedDB keeps everything for when the toggle turns back off.
      const { hideContent } = readBookishSettings();
      // Hidden books stay in IndexedDB but never enter the in-memory library,
      // so they disappear from every page. Restore lives in Settings → Storage.
      books.value = hideContent ? [] : booksData
        .filter((book) => !book.isHidden)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      collections.value = hideContent ? [] : collectionsData;
      if (!hideContent) cacheRemoteLibraryCovers();
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

  // "Currently reading" ordering: books actually in progress, most recently
  // READ first (lastReadAt), so editing a book or fetching metadata — which
  // touches updatedAt — never bumps an unrelated book to the top. Books with a
  // "Reading" status rank above ones that merely have progress.
  const recentlyReadBooks = computed(() => {
    const readingActivity = (book) => new Date(book.lastReadAt || book.updatedAt || 0).getTime();
    return books.value
      .filter(b => b.status === 'Reading' || b.progress > 0)
      .sort((a, b) => {
        const aReading = a.status === 'Reading' ? 1 : 0;
        const bReading = b.status === 'Reading' ? 1 : 0;
        if (aReading !== bReading) return bReading - aReading;
        return readingActivity(b) - readingActivity(a);
      });
  });

  const favourites = computed(() => books.value.filter(b => b.isFavourite));

  const recentAuthors = computed(() => authors.value.slice(0, 4));

  const seriesList = computed(() => groupBooksBySeries(books.value));


  const toggleFavourite = async (bookId) => {
    const book = books.value.find(b => b.id === bookId);
    if (book) await updateBook({ ...book, isFavourite: !book.isFavourite });
  };

  // Hide a book from the whole app without deleting it or its content.
  const hideBook = async (bookId) => {
    const book = books.value.find(b => b.id === bookId);
    if (!book) return;
    await updateBook({ ...book, isHidden: true });
    books.value = books.value.filter(b => b.id !== bookId);
  };

  // Clear the hidden flag on every hidden book and reload the library.
  const restoreHiddenBooks = async () => {
    const store = useLibraryStore();
    const allBooks = await store.getBooks();
    const hidden = allBooks.filter(b => b.isHidden);
    for (const book of hidden) {
      await store.updateBook({ ...book, isHidden: false });
    }
    if (hidden.length) await fetchAllData(true);
    return hidden.length;
  };

  const countHiddenBooks = async () => {
    const store = useLibraryStore();
    const allBooks = await store.getBooks();
    return allBooks.filter(b => b.isHidden).length;
  };

  const fetchAndStoreAuthorDetails = async (authorName, { force = false } = {}) => {
    if (!authorName || !import.meta.client) return false
    try {
      if (!force) {
        // Skip if details are already present for this author
        const existing = books.value.find(b => (
          b.author === authorName
          && b.authorBio
          && b.authorDetailsVersion === 7
        ))
        if (existing) return true
      }
      const knownBooks = books.value
        .filter(book => book.author === authorName && book.title)
        .slice(0, 5)
        .map(book => book.title)
      const params = new URLSearchParams({
        name: authorName,
        books: JSON.stringify(knownBooks),
      })
      const details = await $fetch(apiUrl(`/api/authors/bio?${params.toString()}`))
      const hasAnything = details && (
        details.bio || details.birthDate || details.nationality ||
        details.validatedBooksCount !== null || details.validatedSeriesCount !== null ||
        details.notableWorks?.length || details.spouseName || details.aiRejected
      )
      if (!hasAnything) return false
      const store = useLibraryStore()
      await store.updateAuthorDetails(authorName, details)
      // Refresh in-memory state for this author's books
      const updated = await store.getBooks()
      const updatedMap = new Map(updated.map(b => [b.id, b]))
      books.value = books.value.map(b => updatedMap.get(b.id) || b)
      return true
    } catch (err) {
      console.warn('[useBooks] Fetch author details failed:', err)
      return false
    }
  }

  const addBook = async (book) => {
    try {
      const store = useLibraryStore();
      const bookToSave = {
        ...book,
        series: book?.series ? canonicalLibrarySeriesName(book.series) : book?.series,
      };
      const savedBook = await store.addBook(bookToSave);
      books.value.unshift(savedBook);
      // Fire-and-forget: fetch author bio/details if not already stored
      if (savedBook.author) fetchAndStoreAuthorDetails(savedBook.author)
      return savedBook;
    } catch (err) {
      console.error('Failed to add book:', err);
      throw err;
    }
  };

  const updateBook = async (updatedBook) => {
    const index = books.value.findIndex(b => b.id === updatedBook.id);
    const normalizedUpdatedBook = {
      ...updatedBook,
      series: updatedBook?.series ? canonicalLibrarySeriesName(updatedBook.series) : updatedBook?.series,
    };
    let previousBook = null;
    if (index !== -1) {
      previousBook = { ...books.value[index] };
      books.value[index] = { ...books.value[index], ...normalizedUpdatedBook };
    }
    try {
      const store = useLibraryStore();
      // Always write the full merged record so the store has a complete snapshot.
      const result = await store.updateBook(index !== -1 ? books.value[index] : normalizedUpdatedBook);
      if (index !== -1) books.value[index] = result;
      return result;
    } catch (err) {
      console.error('Failed to update book:', err);
      // Roll back the optimistic update and surface the failure so callers
      // don't report success on a write that never persisted.
      if (index !== -1 && previousBook) books.value[index] = previousBook;
      throw err;
    }
  };

  // Permanently removes a book: its library record, its extracted content and
  // PDF source, its cached cover file, and — for books auto-imported from device
  // storage — the original document on the phone. This is destructive and
  // irreversible; callers must confirm with the user first (DeleteConfirmModal
  // spells out exactly what will be removed). Use `hideBook` to merely hide one.
  const deleteBook = async (bookId) => {
    const previousBooks = [...books.value];
    const book = books.value.find(b => b.id === bookId) || null;
    books.value = books.value.filter(b => b.id !== bookId);
    try {
      const store = useLibraryStore();
      const deleteContentPromise = import.meta.client
        ? useBookStorage().deleteBookContent(bookId)
        : Promise.resolve();
      await Promise.all([store.deleteBook(bookId), deleteContentPromise]);
    } catch (err) {
      // The record write failed — put the book back rather than leaving the UI
      // claiming a deletion that never happened.
      books.value = previousBooks;
      console.error('Failed to delete book:', err);
      throw err;
    }

    // Best-effort cleanup AFTER the record is gone. A failure here leaves an
    // orphaned file, not a resurrected book, so it must not fail the delete.
    if (import.meta.client && book) {
      try {
        const name = coverAssetName(book.cover);
        if (name && isLocalAssetCover(book.cover)) {
          await useDeviceAssets().remove('covers', name);
        }
      } catch (err) {
        console.warn('Could not remove cached cover:', err);
      }

      if (book.deviceImport && book.deviceImportPath) {
        try {
          const { deleteDeviceImport } = await import('~/composables/useDeviceLibrarySync');
          await deleteDeviceImport(book);
        } catch (err) {
          console.warn('Could not remove the book file from device storage:', err);
        }
      }
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

  const updatePlaylist = async (updatedPlaylist) => {
    const index = collections.value.findIndex(item => String(item.id) === String(updatedPlaylist.id));
    if (index === -1) throw new Error(`Playlist ${updatedPlaylist.id} not found`);

    const previousPlaylist = { ...collections.value[index] };
    const playlistToSave = {
      ...previousPlaylist,
      name: String(updatedPlaylist.name || '').trim(),
    };
    if (!playlistToSave.name) throw new Error('Playlist name is required');
    collections.value[index] = playlistToSave;
    try {
      const store = useLibraryStore();
      const savedPlaylist = await store.updateCollection(playlistToSave);
      collections.value[index] = savedPlaylist;
      return savedPlaylist;
    } catch (err) {
      collections.value[index] = previousPlaylist;
      console.error('Failed to update playlist:', err);
      throw err;
    }
  };

  const deletePlaylist = async (playlistId) => {
    const previousCollections = [...collections.value];
    collections.value = collections.value.filter(item => String(item.id) !== String(playlistId));
    try {
      const store = useLibraryStore();
      await store.deleteCollection(playlistId);
    } catch (err) {
      collections.value = previousCollections;
      console.error('Failed to delete playlist:', err);
      throw err;
    }
  };

  const addBookToPlaylist = async (playlistId, bookId) => {
    try {
      const store = useLibraryStore();
      const storedPlaylist = collections.value.find(item => String(item.id) === String(playlistId));
      await store.addBookToCollection(storedPlaylist?.id ?? playlistId, bookId);
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
    genresList: genres,
    allAuthors: authors,
    toggleFavourite,
    hideBook,
    restoreHiddenBooks,
    countHiddenBooks,
    addBook,
    updateBook,
    deleteBook,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addBookToPlaylist,
    fetchAllData,
    fetchBookById,
    cacheRemoteLibraryCovers,
    fetchAndStoreAuthorDetails,
  };
};
