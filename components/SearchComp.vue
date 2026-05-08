<template>
  <div class="search-container">
    <!-- Search Bar -->
    <div class="search-bar-wrapper">
      <div class="search-input-container">
        <i class="ri-search-line search-icon"></i>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search for books, authors, or genres..." 
          class="search-input"
          @keyup.esc="searchQuery = ''"
        >
        <button v-if="searchQuery" @click="searchQuery = ''" class="clear-btn">
          <i class="ri-close-line"></i>
        </button>
      </div>
    </div>

    <!-- Search Results -->
    <div class="search-results" v-if="searchQuery">
      
      <!-- Books Section -->
      <section v-if="filteredBooks.length > 0" class="results-section">
        <h2 class="section-title">Books</h2>
        <div class="books-grid">
          <div v-for="book in filteredBooks" :key="book.id" class="book-card" @click="router.push(`/reader/${book.id}`)">
            <div class="book-cover">
              <img :src="book.cover" :alt="book.title" />
              <button class="play-btn" title="Play">
                <i class="ri-play-fill"></i>
              </button>
            </div>
            <div class="book-info">
              <h3 class="book-title">{{ book.title }}</h3>
              <p class="book-author">{{ book.author }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Authors Section -->
      <section v-if="filteredAuthors.length > 0" class="results-section">
        <h2 class="section-title">Authors</h2>
        <div class="authors-grid">
          <div v-for="author in filteredAuthors" :key="author.id" class="author-card">
            <div class="author-avatar">
              <img v-if="author.image" :src="author.image" :alt="author.name" />
              <div v-else class="initial-avatar">{{ author.name.charAt(0) }}</div>
            </div>
            <p class="author-name">{{ author.name }}</p>
          </div>
        </div>
      </section>

      <!-- No Results -->
      <EmptyState 
        v-if="filteredBooks.length === 0 && filteredAuthors.length === 0" 
        :title="`No results for '${searchQuery}'`"
        description="Try adjusting your search query or browse our collections to find something new."
        icon="ri-search-eye-line"
      >
        <template #action>
          <button @click="searchQuery = ''" class="reset-link">Clear search</button>
        </template>
      </EmptyState>
    </div>

    <!-- Initial / Suggestion Content -->
    <div v-else class="suggestions">
      <div class="suggestion-header">
        <i class="ri-flashlight-line"></i>
        <h2>Quick Browse</h2>
      </div>
      <div class="suggestion-chips">
        <button 
          v-for="genre in popularGenres" 
          :key="genre" 
          class="genre-chip"
          @click="searchQuery = genre"
        >
          {{ genre }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useBooks } from "~/composables/useBooks";
import EmptyState from "./EmptyState.vue";

const searchQuery = ref("");
const { books, allAuthors, genresList } = useBooks();
const router = useRouter();

const popularGenres = computed(() => {
  return genresList.value.slice(0, 6).map(g => g.name);
});

const filteredBooks = computed(() => {
  const query = searchQuery.value.toLowerCase();
  if (!query) return [];
  return books.value.filter(book => 
    book.title.toLowerCase().includes(query) || 
    (book.series && book.series.toLowerCase().includes(query)) ||
    book.genres.some(g => g.toLowerCase().includes(query))
  );
});

const filteredAuthors = computed(() => {
  const query = searchQuery.value.toLowerCase();
  if (!query) return [];
  return allAuthors.value.filter(author => 
    author.name.toLowerCase().includes(query)
  );
});
</script>

<style scoped>
.search-container {
  padding: 0rem;
  margin: 0 auto;
}

.search-bar-wrapper {
  margin-bottom: 3rem;
  max-width: 800px;
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1.5rem;
  font-size: 1.5rem;
  color: #9ca3af;
}

.search-input {
  width: 100%;
  padding: 1.25rem 1.25rem 1.25rem 4rem;
  font-size: 1.25rem;
  border-radius: 4rem;
  border: 4px solid #f3f4f6;
  background: white;
  color: #1f2937;
  transition: all 0.3s ease;
  font-family: 'Comfortaa', sans-serif;
}

.search-input:focus {
  outline: none;
  border-color: #E6E6FA;
  box-shadow: 0 10px 25px rgba(172, 211, 255, 0.2);
}

.clear-btn {
  position: absolute;
  right: 1.5rem;
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 1.5rem;
  cursor: pointer;
}

.results-section {
  margin-bottom: 3rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 400;
  color: #8A2BE2;
  margin-bottom: 1.5rem;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.5rem;
}

.book-card {
  width: 200px;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.book-card:hover {
  transform: translateY(-5px);
}

.book-cover {
  width: 100%;
  aspect-ratio: 7/10;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  margin-bottom: 0.75rem;
  transition: all 0.3s ease;
  position: relative;
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.play-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: #8A2BE2;
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s ease;
}

.book-card:hover .play-btn {
  opacity: 1;
  transform: translateY(0);
}

.book-title {
  font-size: 0.875rem;
  font-weight: 400;
  color: #1f2937;
  margin: 0 0 2px 0;
}

.book-author {
  font-size: 0.75rem;
  color: #6b7280;
}

.authors-grid {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.author-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.author-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.initial-avatar {
  font-size: 2rem;
  font-weight: 400;
  color: #8A2BE2;
}

.author-name {
  font-size: 0.875rem;
  font-weight: 400;
  color: #1f2937;
}

.no-results {
  padding: 5rem 0;
  text-align: center;
  color: #9ca3af;
}

.no-results i {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.reset-link {
  background: #f3f4f6;
  border: none;
  color: #8A2BE2;
  font-weight: 400;
  padding: 0.75rem 1.5rem;
  border-radius: 2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-link:hover {
  background: #e5e7eb;
}

.suggestions {
  padding-top: 1rem;
}

.suggestion-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #8A2BE2;
  margin-bottom: 2rem;
}

.suggestion-header h2 {
  font-size: 1.5rem;
  font-weight: 400;
}

.suggestion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.genre-chip {
  padding: 0.75rem 1.5rem;
  border: 3px solid #f3f4f6;
  border-radius: 2rem;
  background: white;
  color: #6b7280;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Comfortaa', sans-serif;
}

.genre-chip:hover {
  border-color: #E6E6FA;
  background: #f9fafb;
  color: #8A2BE2;
}
</style>
