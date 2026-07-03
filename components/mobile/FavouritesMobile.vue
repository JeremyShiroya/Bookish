<template>
  <div class="favourites-container">
    <MobileTopNav />


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
            @open="router.push(`/book/${book.id}`)"
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

    <DeleteConfirmModal
      v-if="showDeleteModal && selectedDeleteBook"
      :book="selectedDeleteBook"
      @close="showDeleteModal = false; selectedDeleteBook = null"
      @confirm="confirmDelete"
    />

    <MobileBottomNav />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useBooks } from "~/composables/useBooks";
import { useTTS } from '~/composables/useTTS';
import EmptyState from "../shared/EmptyState.vue";
import LibraryBookCard from '../shared/LibraryBookCard.vue';
import AddToPlaylistModal from '../shared/AddToPlaylistModal.vue';
import DeleteConfirmModal from '../shared/DeleteConfirmModal.vue';
import SkeletonLoader from '../shared/SkeletonLoader.vue';
import MobileBottomNav from './MobileBottomNav.vue';
import MobileTopNav from './MobileTopNav.vue';

const { favourites, toggleFavourite, deleteBook, loading, initialized } = useBooks();
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS();
const router = useRouter();
const selectedPlaylistBook = ref(null);
const showDeleteModal = ref(false);
const selectedDeleteBook = ref(null);

const isBookActive = (book) => ttsBook.value?.id === book.id && ttsStatus.value !== 'idle';
const handlePlay = (book) => {
  if (isBookActive(book)) {
    toggleTTS();
    return;
  }
  playTTS(book);
};

const deleteFavouriteBook = (book) => {
  selectedDeleteBook.value = book;
  showDeleteModal.value = true;
};

const confirmDelete = async () => {
  if (selectedDeleteBook.value) await deleteBook(selectedDeleteBook.value.id);
  showDeleteModal.value = false;
  selectedDeleteBook.value = null;
};
</script>

<style scoped>
.favourites-container {
  padding: calc(4.85rem + env(safe-area-inset-top)) 0rem calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
  margin: 0 auto;
}







.books-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2rem;
  justify-content: start;
}



  .favourites-container {
    padding: calc(4.85rem + env(safe-area-inset-top)) var(--mobile-page-padding-inline) calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
  }

  .books-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px 14px;
  }

  .book-card {
    width: 100%;
  }

  .book-cover {
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .heart-btn {
    opacity: 1;
    transform: none;
    width: 34px;
    height: 34px;
  }

  .play-btn {
    opacity: 1;
    transform: none;
    width: var(--mobile-touch-target);
    height: var(--mobile-touch-target);
  }

  .play-btn i {
    font-size: var(--mobile-icon-size);
  }

  .book-title {
    font-size: var(--mobile-caption-size);
    line-height: 1.2;
  }

  .book-author {
    font-size: var(--mobile-tiny-size);
    line-height: 1.2;
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
