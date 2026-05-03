import { ref, computed } from "vue";
import { useState } from "#app";

export const useBooks = () => {
  // Using Nuxt useState for cross-component shared state with SSR/Hydration support
  const books = useState('library:books', () => []);
  const authors = useState('library:authors', () => []);
  const collections = useState('library:collections', () => []);
  const genres = useState('library:genres', () => []);
  
  const loading = useState('library:loading', () => false);
  const initialized = useState('library:initialized', () => false);

  const fetchAllData = async (force = false) => {
    if (initialized.value && !force) return;
    
    loading.value = true;
    try {
      const [booksData, authorsData, collectionsData, genresData] = await Promise.allSettled([
        $fetch("/api/books"),
        $fetch("/api/authors"),
        $fetch("/api/collections"),
        $fetch("/api/genres")
      ]);
      
      books.value = booksData.status === 'fulfilled' ? booksData.value : [];
      authors.value = authorsData.status === 'fulfilled' ? authorsData.value : [];
      collections.value = collectionsData.status === 'fulfilled' ? collectionsData.value : [];
      genres.value = genresData.status === 'fulfilled' ? genresData.value : [];
      initialized.value = true;
    } catch (error) {
      console.error("Failed to fetch library data:", error);
    } finally {
      loading.value = false;
    }
  };

  const fetchBookById = async (id, includeContent = false) => {
    try {
      return await $fetch(`/api/books/${id}`, {
        query: { content: includeContent }
      });
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
      if (!authors.value.some(a => a.name === savedBook.author)) {
          fetchAllData(true);
      }
    } catch (error) {
      console.error("Failed to add book:", error);
      throw error;
    }
  };

  const updateBook = async (updatedBook) => {
    try {
      const result = await $fetch(`/api/books/${updatedBook.id}`, {
        method: "PATCH",
        body: updatedBook,
      });
      const index = books.value.findIndex((b) => b.id === result.id);
      if (index !== -1) {
        books.value[index] = result;
      }
    } catch (error) {
      console.error("Failed to update book:", error);
    }
  };

  const deleteBook = async (bookId) => {
    try {
      await $fetch(`/api/books/${bookId}`, {
        method: "DELETE",
      });
      books.value = books.value.filter((b) => b.id !== bookId);
    } catch (error) {
      console.error("Failed to delete book:", error);
    }
  };

  return {
    books,
    authors,
    collections,
    genres,
    loading,
    initialized,
    recentAuthors,
    recentlyAddedBooks,
    recentlyReadBooks,
    favourites,
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
