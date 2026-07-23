<template>
  <div class="favourites-container">
    <MobileTopNav />


    <div v-if="loading && !initialized" class="favourites-loading">
      <MobileSkeleton page="favourites" :count="6" />
    </div>

    <template v-else-if="initialized">
        <!-- The same controls row every other shelf uses, so the filter and
             view toggle look and behave identically here. -->
        <div v-if="favourites.length > 0" class="favourites-controls">
          <LibraryControlsRow
            v-model:status="selectedStatus"
            :view="favouritesLayout"
            @update:view="setLayout"
          />
        </div>

        <div
          v-if="displayedFavourites.length > 0"
          :class="favouritesLayout === 'list' ? 'favourites-list' : 'books-grid'"
        >
          <LibraryBookCard
            :show-personal-rating="false"
            v-for="book in displayedFavourites"
            :key="book.id"
            :book="book"
            :active="isBookActive(book)"
            :card-background="favouritesBackground"
            :class="{ 'mobile-list-book-card': favouritesLayout === 'list' }"
            @open="router.push(`/book/${book.id}`)"
            @play="handlePlay"
            @favourite="toggleFavourite(book.id)"
            @playlist="selectedPlaylistBook = book"
            @edit="router.push(`/edit/${book.id}`)"
            @hide="hideBook(book.id)"
            @delete="deleteFavouriteBook(book)"
          />
        </div>
        
        <EmptyState
          v-else-if="favourites.length > 0"
          illustration="filter"
          title="Nothing matches this filter"
          description="Try a different reading status to see more of your favourites."
        >
          <template #action>
            <button type="button" class="explore-btn" @click="clearFilters">
              Clear filter
            </button>
          </template>
        </EmptyState>

        <EmptyState
          v-else
          illustration="favourites"
          title="No favourites yet"
          description="Tap the heart on any book and it will be kept here for quick access."
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
import { computed, ref } from 'vue';
import { useBooks } from "~/composables/useBooks";
import {
  matchesFormatFilter,
  useBookishSettings,
} from '~/composables/useBookishSettings';
import { useToast } from '~/composables/useToast';
import { useTTS } from '~/composables/useTTS';
import EmptyState from "../shared/EmptyState.vue";
import LibraryBookCard from '../shared/LibraryBookCard.vue';
import LibraryControlsRow from '../shared/LibraryControlsRow.vue';
import AddToPlaylistModal from '../shared/AddToPlaylistModal.vue';
import DeleteConfirmModal from '../shared/DeleteConfirmModal.vue';
import MobileBottomNav from './MobileBottomNav.vue';
import MobileSkeleton from './MobileSkeleton.vue';
import MobileTopNav from './MobileTopNav.vue';

const { favourites, toggleFavourite, deleteBook, hideBook, loading, initialized } = useBooks();
const { settings, updateSettings } = useBookishSettings();
const { addToast } = useToast();
const favouritesLayout = computed(() => settings.value.favouritesCardLayout || 'grid');
const favouritesBackground = computed(() => settings.value.favouritesCardBackground || 'blur');
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS();
const router = useRouter();
const selectedPlaylistBook = ref(null);
const showDeleteModal = ref(false);
const selectedDeleteBook = ref(null);

// ── Controls row: status + format filters, grid/list view ───────────────────
const selectedStatus = ref('all');
const selectedFormat = computed(() => settings.value.formatFilter || 'all');

const displayedFavourites = computed(() => favourites.value.filter((book) => (
  matchesFormatFilter(book, selectedFormat.value)
  && (selectedStatus.value === 'all' || book.status === selectedStatus.value)
)));

const clearFilters = () => {
  selectedStatus.value = 'all';
  updateSettings({ formatFilter: 'all' });
};

// The view choice is the same setting the Preferences page used to own; the
// controls row is where it actually belongs.
const setLayout = (layout) => updateSettings({ favouritesCardLayout: layout });

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
  const book = selectedDeleteBook.value;
  showDeleteModal.value = false;
  selectedDeleteBook.value = null;
  if (!book) return;
  try {
    await deleteBook(book.id);
    addToast(`"${book.title}" was permanently deleted.`, 'success');
  } catch {
    addToast(`Could not delete "${book.title}".`, 'error');
  }
};
</script>

<style scoped>
/* Inline padding lives on the rows and grids inside, exactly like the Series
   and Playlists pages — favourites used to pad the container AND the controls
   row on top of it, so its contents sat further in than every other shelf. */
.favourites-container {
  margin: 0 auto;
  padding-top: calc(4.85rem + env(safe-area-inset-top));
  padding-bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
}

.favourites-controls {
  padding: 0 var(--mobile-page-padding-inline);
  margin-bottom: 1rem;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px 14px;
  justify-content: start;
  padding: 0 var(--mobile-page-padding-inline);
}

/* List positioning option: one card per row, full width. */
.favourites-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 0 var(--mobile-page-padding-inline);
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
