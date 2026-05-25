import { ref, computed } from "vue";
import { useState } from "#app";
import { useBookStorage } from '~/composables/useBookStorage';
import { isRemoteCoverUrl, useCoverImageCache } from '~/composables/useCoverImageCache';

const coverCacheInFlight = new Set();
const LIBRARY_FETCH_TIMEOUT_MS = 15000;

const fetchWithTimeout = async (url, options = {}) => {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Timed out loading ${url}`));
    }, LIBRARY_FETCH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      $fetch(url, {
        ...options,
        ...(controller ? { signal: controller.signal } : {}),
      }),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const resolveLibraryDataResult = (result, fallback) => {
  if (result.status === "fulfilled") return result.value;
  console.warn("Library data request failed:", result.reason);
  return fallback;
};

export const useBooks = () => {
  // Using Nuxt useState for cross-component shared state with SSR/Hydration support
  const books = useState('library:books', () => []);
  const authors = useState('library:authors', () => []);
  const collections = useState('library:collections', () => []);
  const genres = useState('library:genres', () => []);
  
  const loading = useState('library:loading', () => false);
  const initialized = useState('library:initialized', () => false);
  const error = useState('library:error', () => null);

  const cacheRemoteLibraryCovers = async () => {
    if (!import.meta.client) return;

    const { cacheCoverImage } = useCoverImageCache();
    const remoteCoverBooks = books.value.filter((book) => (
      book?.id && isRemoteCoverUrl(book.cover) && !coverCacheInFlight.has(book.id)
    ));

    for (const book of remoteCoverBooks) {
      coverCacheInFlight.add(book.id);
      try {
        const cachedCover = await cacheCoverImage(book.cover);
        if (!cachedCover || cachedCover === book.cover) continue;

        const index = books.value.findIndex((item) => item.id === book.id);
        if (index !== -1) {
          books.value[index] = { ...books.value[index], cover: cachedCover };
        }

        await $fetch(`/api/books/${book.id}`, {
          method: "PATCH",
          body: { ...book, cover: cachedCover },
        });
      } catch (error) {
        console.warn("Failed to cache remote cover:", error);
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
      const [booksData, authorsData, collectionsData, genresData] = await Promise.allSettled([
        fetchWithTimeout("/api/books"),
        fetchWithTimeout("/api/authors"),
        fetchWithTimeout("/api/collections"),
        fetchWithTimeout("/api/genres")
      ]);

      if (booksData.status === "rejected") {
        error.value = "Bookish could not load your library. Check the database connection and try again.";
      }
      
      books.value = resolveLibraryDataResult(booksData, books.value);
      authors.value = resolveLibraryDataResult(authorsData, authors.value);
      collections.value = resolveLibraryDataResult(collectionsData, collections.value);
      genres.value = resolveLibraryDataResult(genresData, genres.value);
      cacheRemoteLibraryCovers();
    } catch (fetchError) {
      console.error("Failed to fetch library data:", fetchError);
      error.value = "Bookish could not load your library. Check the database connection and try again.";
    } finally {
      initialized.value = true;
      loading.value = false;
    }
  };

  const fetchBookById = async (id) => {
    try {
      return await $fetch(`/api/books/${id}`);
    } catch (error) {
      console.error(`Failed to fetch book ${id}:`, error);
      return null;
    }
  };

  // Initial fetch on composition if not already doing it
  if (!initialized.value && import.meta.client) {
    fetchAllData();
  }

  const recentlyAddedBooks = computed(() => {
    return [...books.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
  });

  const recentlyReadBooks = computed(() => {
    return books.value.filter(b => b.status === 'Reading' || b.progress > 0)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  });

  const favourites = computed(() => {
    return books.value.filter(b => b.isFavourite);
  });

  const recentAuthors = computed(() => {
    return authors.value.slice(0, 5);
  });

  const seriesList = computed(() => {
    const grouped = {};
    books.value.forEach(book => {
      if (book.series) {
        if (!grouped[book.series]) {
          grouped[book.series] = {
            name: book.series,
            author: book.author,
            books: []
          };
        }
        grouped[book.series].books.push(book);
      }
    });
    return Object.values(grouped);
  });

  const genresList = computed(() => {
    return genres.value;
  });

  const allAuthors = computed(() => {
    return authors.value;
  });

  const toggleFavourite = async (bookId) => {
    const book = books.value.find((b) => b.id === bookId);
    if (book) {
      const updatedBook = { ...book, isFavourite: !book.isFavourite };
      await updateBook(updatedBook);
    }
  };

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

  const updateBook = async (updatedBook) => {
    const index = books.value.findIndex((b) => b.id === updatedBook.id);
    let previousBook = null;
    
    // Optimistic UI update
    if (index !== -1) {
      previousBook = { ...books.value[index] };
      books.value[index] = { ...books.value[index], ...updatedBook };
    }

    try {
      const result = await $fetch(`/api/books/${updatedBook.id}`, {
        method: "PATCH",
        body: updatedBook,
      });
      // Replace with truth from server
      if (index !== -1) {
        books.value[index] = result;
        // Refresh all data to sync Genres/Authors/Collections
        fetchAllData(true);
      }
    } catch (error) {
      console.error("Failed to update book:", error);
      // Revert optimistic update on failure
      if (index !== -1 && previousBook) {
        books.value[index] = previousBook;
      }
    }
  };

  const deleteBook = async (bookId) => {
    const previousBooks = [...books.value];
    books.value = books.value.filter((b) => b.id !== bookId);

    try {
      const deleteContentPromise = import.meta.client
        ? useBookStorage().deleteBookContent(bookId)
        : Promise.resolve();

      await Promise.all([
        $fetch(`/api/books/${bookId}`, {
          method: "DELETE",
        }),
        deleteContentPromise,
      ]);

      fetchAllData(true).catch((error) => {
        console.error("Failed to refresh library after delete:", error);
      });
    } catch (error) {
      books.value = previousBooks;
      console.error("Failed to delete book:", error);
    }
  };

  const popularBooks = computed(() => {
    const getRating = (book) => {
       if (!book.webReview) return 0;
       const match = book.webReview.match(/Rating:\s*([\d.]+)/);
       return match ? parseFloat(match[1]) : 0;
    };
    
    const rated = [...books.value]
      .filter(b => getRating(b) > 0)
      .sort((a, b) => getRating(b) - getRating(a));
      
    if (rated.length >= 4) return rated.slice(0, 4);
    
    const additional = [...books.value]
      .filter(b => !rated.find(r => r.id === b.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
    return [...rated, ...additional].slice(0, 4);
  });

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
    fetchAllData,
    fetchBookById,
  };
};
