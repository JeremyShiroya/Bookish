<template>
  <div class="favourites-container">
    <div class="favourites-header">
      <h1 class="favourites-title">
        Favourites <span class="favourites-count">({{ favourites.length }})</span>
      </h1>
    </div>

    <div v-if="loading && !initialized" class="favourites-loading">
        <SkeletonLoader variant="favourites-grid" :count="6" />
    </div>

    <template v-else-if="initialized">
        <div v-if="favourites.length > 0" class="books-grid">
          <LibraryBookCard
            v-for="book in favourites"
            :key="book.id"
            :book="book"
            :active="isBookActive(book)"
            @open="router.push(`/reader/${book.id}`)"
            @play="handlePlay"
            @favourite="toggleFavourite(book.id)"
            @playlist="selectedPlaylistBook = book"
            @edit="router.push(`/edit/${book.id}`)"
            @delete="deleteFavouriteBook(book)"
          />
        </div>
        
        <EmptyState
          v-else
          title="No favorites yet"
          description="Books you mark as favorite will appear here for quick access."
          icon="ri-heart-line"
        >
          <template #action>
            <NuxtLink to="/books" class="explore-btn">
              Explore Library
            </NuxtLink>
          </template>
        </EmptyState>
    </template>

    <AddToPlaylistModal
      v-if="selectedPlaylistBook"
      :book="selectedPlaylistBook"
      @close="selectedPlaylistBook = null"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useBooks } from "~/composables/useBooks";
import { useTTS } from '~/composables/useTTS';
import EmptyState from "./EmptyState.vue";
import LibraryBookCard from './LibraryBookCard.vue';
import AddToPlaylistModal from './AddToPlaylistModal.vue';

const { favourites, toggleFavourite, deleteBook, loading, initialized } = useBooks();
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS();
const router = useRouter();
const selectedPlaylistBook = ref(null);

const isBookActive = (book) => ttsBook.value?.id === book.id && ttsStatus.value !== 'idle';
const handlePlay = (book) => {
  if (isBookActive(book)) {
    toggleTTS();
    return;
  }
  playTTS(book);
};

const deleteFavouriteBook = async (book) => {
  if (!window.confirm(`Delete "${book.title}" from your library?`)) return;
  await deleteBook(book.id);
};
</script>

<style scoped>
.favourites-container {
  padding: 0rem;
  margin: 0 auto;
}

.favourites-header {
  margin-bottom: 2rem;
}

.favourites-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

.favourites-count {
  color: var(--color-text-subtle);
  font-weight: normal;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 276px;
  gap: 2rem;
  justify-content: start;
}

@media (max-width: 1100px) {
  .books-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 720px) {
  .books-grid {
    grid-template-columns: 1fr;
  }
}

.favourites-loading {
  padding: 0.5rem 0;
}

.book-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  width: 200px;
  transition: all 0.3s ease;
}

.book-card:hover {
  transform: translateY(-5px);
}

.book-cover {
  width: 100%;
  aspect-ratio: 7/10;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: var(--shadow-card-subtle);
  margin-bottom: 0.75rem;
  transition: all 0.3s ease;
  position: relative;
}

.heart-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: var(--color-surface-glass);
  border-radius: 50%;
  border: none;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.3s ease;
  color: var(--color-status-danger-bright);
}

.play-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: var(--color-brand-primary);
  border-radius: 50%;
  border: none;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s ease;
}

.play-btn i {
  color: var(--color-text-on-brand);
  font-size: 24px;
}

.book-card:hover .heart-btn,
.book-card:hover .play-btn {
  opacity: 1;
  transform: translateY(0);
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.book-info {
  text-align: left;
}

.book-title {
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem 0;
}

.book-author {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 0;
  color: var(--color-text-subtle);
}

.empty-state i {
  font-size: 4rem;
  margin-bottom: 1rem;
}
</style>
