<template>
  <div class="favourites-container">
    <MobileTopNav />


    <div v-if="loading && !initialized" class="favourites-loading">
      <MobileSkeleton page="favourites" :count="6" />
    </div>

    <template v-else-if="initialized">
        <!-- Controls row — mirrors the Books page: status filter on the left,
             grid/list toggle pinned right. -->
        <div v-if="favourites.length > 0" class="controls-row">
          <div class="controls-left">
            <div ref="filterRef" class="filter-dropdown">
              <button
                type="button"
                class="filter-button"
                :class="{ open: filterOpen }"
                @click="filterOpen = !filterOpen"
              >
                <i class="ri-filter-3-line"></i>
                <span class="filter-label-text">Filter</span>
                <span v-if="selectedStatus !== 'all'" class="filter-active-dot"></span>
                <i class="ri-arrow-down-s-line dropdown-arrow" :class="{ rotated: filterOpen }"></i>
              </button>

              <div v-show="filterOpen" class="dropdown-menu filter-panel">
                <div class="sfp-section">
                  <div class="sfp-section-header">
                    <i class="ri-bookmark-line"></i>
                    Status
                  </div>
                  <div class="sfp-pills">
                    <button
                      type="button"
                      class="sfp-pill"
                      :class="{ active: selectedStatus === 'all' }"
                      @click="setStatus('all')"
                    >All</button>
                    <button
                      v-for="status in readingStatuses"
                      :key="status"
                      type="button"
                      class="sfp-pill"
                      :class="{ active: selectedStatus === status }"
                      @click="setStatus(status)"
                    >{{ status }}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="controls-right">
            <div class="view-chips">
              <button
                type="button"
                class="view-chip-icon"
                :class="{ active: favouritesLayout === 'grid' }"
                aria-label="Grid view"
                title="Grid view"
                @click="setLayout('grid')"
              >
                <i class="ri-apps-2-line"></i>
              </button>
              <button
                type="button"
                class="view-chip-icon"
                :class="{ active: favouritesLayout === 'list' }"
                aria-label="List view"
                title="List view"
                @click="setLayout('list')"
              >
                <i class="ri-list-unordered"></i>
              </button>
            </div>
          </div>
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
          title="No favourites match this filter"
          description="Try a different reading status to see more of your favourites."
          icon="ri-filter-off-line"
        >
          <template #action>
            <button type="button" class="explore-btn" @click="setStatus('all')">
              Clear filter
            </button>
          </template>
        </EmptyState>

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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useBooks } from "~/composables/useBooks";
import { useBookishSettings } from '~/composables/useBookishSettings';
import { useToast } from '~/composables/useToast';
import { useTTS } from '~/composables/useTTS';
import EmptyState from "../shared/EmptyState.vue";
import LibraryBookCard from '../shared/LibraryBookCard.vue';
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

// ── Controls row: reading-status filter + grid/list view ────────────────────
const readingStatuses = ['Unread', 'Reading', 'Read'];
const selectedStatus = ref('all');
const filterRef = ref(null);
const filterOpen = ref(false);

const displayedFavourites = computed(() => (
  selectedStatus.value === 'all'
    ? favourites.value
    : favourites.value.filter((book) => book.status === selectedStatus.value)
));

const setStatus = (status) => {
  selectedStatus.value = status;
  filterOpen.value = false;
};

// The view choice is the same setting the Preferences page used to own; the
// controls row is where it actually belongs.
const setLayout = (layout) => updateSettings({ favouritesCardLayout: layout });

const closeFilterOnOutsideClick = (event) => {
  if (!event.target.closest('.filter-dropdown')) filterOpen.value = false;
};

onMounted(() => document.addEventListener('click', closeFilterOnOutsideClick));
onUnmounted(() => document.removeEventListener('click', closeFilterOnOutsideClick));

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
.favourites-container {
  padding: calc(4.85rem + env(safe-area-inset-top)) 0rem calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
  margin: 0 auto;
}

/* ── Controls row — mirrors the Books page ─────────────────────────────────── */
.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0 var(--mobile-page-padding-inline);
}

.filter-dropdown {
  position: relative;
}

.filter-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--color-border-card);
  border-radius: var(--mobile-control-radius);
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--mobile-caption-size);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.filter-button.open {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary-faint);
  color: var(--color-text-primary);
}

.filter-button > i:first-child {
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.filter-button.open > i:first-child {
  color: var(--color-brand-primary);
}

.filter-label-text {
  font-weight: 500;
}

.filter-active-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-brand-primary);
}

.filter-button .dropdown-arrow {
  font-size: 1rem;
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}

.filter-button .dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.filter-panel {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  z-index: 50;
  min-width: 240px;
  padding: 0.5rem;
  border: 1px solid var(--color-border-card);
  border-radius: 14px;
  background: var(--color-background-app);
  box-shadow: var(--shadow-modal);
}

.sfp-section {
  padding: 0.6rem 0.5rem;
}

.sfp-section-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.55rem;
  color: var(--color-text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.sfp-section-header i {
  color: var(--color-brand-primary);
  font-size: 0.85rem;
  opacity: 0.75;
}

.sfp-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.sfp-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.32rem 0.8rem;
  border: 1px solid var(--color-border-card);
  border-radius: 20px;
  background: transparent;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--mobile-caption-size);
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.sfp-pill.active {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-hover);
  color: var(--color-brand-primary);
  font-weight: 500;
}

.view-chips {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
}

.view-chip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.65rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.05rem;
  line-height: 1;
}

.view-chip-icon.active {
  background: var(--color-surface-primary);
  color: var(--color-brand-primary);
  box-shadow: var(--shadow-card-subtle);
}







.books-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2rem;
  justify-content: start;
}

/* List positioning option: one card per row, full width. */
.favourites-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 0 var(--mobile-page-padding-inline);
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
