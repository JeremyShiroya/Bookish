import { computed } from "vue";
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
          grouped[book.series] = { id: encodeURIComponent(book.series), name: book.series, author: book.author, books: [] };
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
      // Always write the full merged record so the store has a complete snapshot.
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
