<template>
  <div class="books-container">
    <MobileTopNav />

    <!-- Loading State -->
    <div v-if="loading" class="books-loading">
      <MobileSkeleton page="books" :count="12" />
    </div>

    <!-- Books Content -->
    <div v-else class="books-content">
      <EmptyState
        v-if="error && books.length === 0"
        title="Library could not load"
        :description="error"
        icon="ri-error-warning-line"
      >
        <template #action>
          <button class="add-book-btn" @click="retryLoadLibrary">
            <i class="ri-refresh-line"></i>
            Retry
          </button>
        </template>
      </EmptyState>

      <div v-else-if="books.length > 0">
        <div class="view-container" :class="{ 'is-card': viewMode === 'table' }">
          <!-- Controls Row (chips + filters on left, add book + view toggle on right) -->
          <div class="controls-row in-container">
            <div class="controls-left">
              <!-- Reading-status filter dropdown -->
              <div class="filter-dropdown" ref="filterRef">
                <button
                  type="button"
                  class="filter-button"
                  :class="{ open: filterOpen }"
                  @click="filterOpen = !filterOpen"
                >
                  <i class="ri-filter-3-line"></i>
                  <span class="filter-label-text">Filter</span>
                  <span v-if="hasActiveFilter" class="filter-active-dot"></span>
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

                  <div class="sfp-section">
                    <div class="sfp-section-header">
                      <i class="ri-file-list-2-line"></i>
                      Format
                    </div>
                    <div class="sfp-pills">
                      <button
                        v-for="format in formatFilters"
                        :key="format.value"
                        type="button"
                        class="sfp-pill"
                        :class="{ active: selectedFormat === format.value }"
                        @click="setFormat(format.value)"
                      >{{ format.label }}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- View toggle pinned to the right end of the same row -->
            <div class="controls-right">
              <div
                class="view-chips"
                ref="viewChipsRef"
                @mouseleave="viewHoverIndex = -1"
              >
                <div
                  class="chip-highlight"
                  :style="viewHighlightStyle"
                  :class="{ 'is-active': isViewHighlightActive }"
                ></div>
                <button
                  class="status-chip view-chip-icon"
                  :class="{ active: viewMode === 'grid' }"
                  @click="setViewMode('grid')"
                  @mouseenter="viewHoverIndex = 0"
                  aria-label="Grid view"
                  title="Grid view"
                >
                  <i class="ri-apps-2-line"></i>
                </button>
                <button
                  class="status-chip view-chip-icon"
                  :class="{ active: viewMode === 'table' }"
                  @click="setViewMode('table')"
                  @mouseenter="viewHoverIndex = 1"
                  aria-label="List view"
                  title="List view"
                >
                  <i class="ri-list-unordered"></i>
                </button>
              </div>
            </div>
          </div>

        <!-- Grid View -->
        <div v-if="viewMode === 'grid'" class="books-grid">
          <LibraryBookCard
            :show-personal-rating="false"
            v-for="book in displayedBooks"
            :key="book.id"
            :book="book"
            :active="isBookActive(book)"
            @open="router.push(`/book/${book.id}`)"
            @play="handlePlay"
            @favourite="toggleFavourite(book.id)"
            @playlist="selectedPlaylistBook = book"
            @edit="router.push(`/edit/${book.id}`)"
            @hide="handleHideBook"
            @delete="openDeleteModal(book)"
          />
        </div>

        <!-- List View -->
        <div v-else class="mobile-table-card-list">
          <LibraryBookCard
            :show-personal-rating="false"
            v-for="book in displayedBooks"
            :key="book.id"
            class="mobile-list-book-card"
            :book="book"
            :active="isBookActive(book)"
            @open="router.push(`/book/${book.id}`)"
            @play="handlePlay"
            @favourite="toggleFavourite(book.id)"
            @playlist="selectedPlaylistBook = book"
            @edit="router.push(`/edit/${book.id}`)"
            @hide="handleHideBook"
            @delete="openDeleteModal(book)"
          />
        </div>
        </div>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else
        illustration="books"
        title="No books yet"
        description="Import a PDF or EPUB — or let Bookish find the documents already on your device — and your shelves start here."
      >
        <template #action>
          <button class="add-book-btn" @click="router.push('/add')">
            <i class="ri-add-line"></i>
            Add Your First Book
          </button>
        </template>
      </EmptyState>
    </div>


    <AddToPlaylistModal
      v-if="selectedPlaylistBook"
      :book="selectedPlaylistBook"
      @close="selectedPlaylistBook = null"
    />


    <!-- Delete Confirmation Modal -->
    <DeleteConfirmModal
      v-if="showDeleteModal"
      :book="selectedBook"
      @close="closeDeleteModal"
      @confirm="deleteBook"
    />

    <!-- Floating add button — stays put while the list scrolls, and lifts
         above the mini player when narration is active. -->
    <button
      type="button"
      class="add-book-fab"
      :class="{ 'above-mini-player': miniPlayerVisible }"
      aria-label="Add book"
      @click="router.push('/add')"
    >
      <i class="ri-add-line"></i>
    </button>

    <MobileBottomNav />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import DeleteConfirmModal from "../shared/DeleteConfirmModal.vue";
import LibraryBookCard from "../shared/LibraryBookCard.vue";
import AddToPlaylistModal from "../shared/AddToPlaylistModal.vue";
import MobileBottomNav from "./MobileBottomNav.vue";
import MobileSkeleton from "./MobileSkeleton.vue";
import MobileTopNav from "./MobileTopNav.vue";

import { useBooks } from "~/composables/useBooks";
import { getGoodreadsRating } from "~/composables/useGoodreadsRating";
import { useTTS } from "~/composables/useTTS";
import {
  FORMAT_FILTER_CHOICES,
  matchesFormatFilter,
  useBookishSettings,
} from "~/composables/useBookishSettings";
import { useToast } from "~/composables/useToast";

// Reactive data
import EmptyState from "../shared/EmptyState.vue";

const {
  books,
  loading,
  error,
  updateBook,
  deleteBook: removeBookFromStore,
  toggleFavourite,
  hideBook,
  fetchAllData,
} = useBooks();
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS()
const { settings, updateSettings } = useBookishSettings();
const { addToast } = useToast();

const isBookActive = (book) =>
  ttsBook.value?.id === book.id && ttsStatus.value !== 'idle'

// The mini player is showing whenever something is loaded into TTS; lift the
// FAB so it isn't hidden behind the bar.
const miniPlayerVisible = computed(() => !!ttsBook.value && ttsStatus.value !== 'idle')

const handleHideBook = async (book) => {
  await hideBook(book.id)
  addToast(`"${book.title}" is now hidden from your library.`, 'info')
}

const handlePlay = (book) => {
  if (ttsBook.value?.id === book.id && ttsStatus.value !== 'idle') {
    toggleTTS()
    return
  }
  playTTS(book)
}

const router = useRouter();

// Filter options
const readingStatuses = ["Unread", "Reading", "Read"];
const formatFilters = FORMAT_FILTER_CHOICES;

// Filter states
const sortBy = ref(settings.value.librarySort);
const sortDirection = ref(settings.value.librarySortDirection);
const selectedStatus = ref("all");
// Format lives in settings so the Books, Favourites, Series- and Playlist-detail
// filters all agree on which formats the library is showing.
const selectedFormat = computed(() => settings.value.formatFilter || "all");
const viewMode = ref(settings.value.libraryView);

// Modal states
const showDeleteModal = ref(false);
const selectedBook = ref(null);
const selectedPlaylistBook = ref(null);

// Computed filtered books
const filteredBooks = computed(() => {
  let filtered = books.value.filter((book) => matchesFormatFilter(book, selectedFormat.value));

  // Filter by status
  if (selectedStatus.value !== "all") {
    filtered = filtered.filter((book) => book.status === selectedStatus.value);
  }

  // Sort books
  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy.value === "name") {
      comparison = a.title.localeCompare(b.title);
    } else if (sortBy.value === "rating") {
      comparison = getGoodreadsRating(a) - getGoodreadsRating(b);
    } else if (sortBy.value === "year") {
      comparison = (a.publishYear || 0) - (b.publishYear || 0);
    }
    return sortDirection.value === "asc" ? comparison : -comparison;
  });

  return filtered;
});

const bookMetrics = computed(() => {
  const all = books.value;
  return {
    total: all.length,
    unread: all.filter((b) => !b.status || b.status === 'Unread').length,
    reading: all.filter((b) => b.status === 'Reading').length,
    read: all.filter((b) => b.status === 'Read').length,
  };
});

// Reading-status filter dropdown (open/close + outside-click dismissal)
const filterRef = ref(null);
const filterOpen = ref(false);

// Sliding pill for view-mode chips (Grid / Table)
const viewChipsRef = ref(null);
const viewHoverIndex = ref(-1);
const viewHighlightStyle = ref({ left: '0px', width: '0px', opacity: 0 });
const isViewHighlightActive = ref(false);

const activeViewIndex = computed(() => (viewMode.value === 'grid' ? 0 : 1));

const updateViewHighlight = async () => {
  await nextTick();
  if (!viewChipsRef.value) return;

  let targetIndex = viewHoverIndex.value;
  let isActive = false;

  if (targetIndex === -1) {
    targetIndex = activeViewIndex.value;
    isActive = true;
  } else if (targetIndex === activeViewIndex.value) {
    isActive = true;
  }

  isViewHighlightActive.value = isActive;

  const chips = viewChipsRef.value.querySelectorAll('.status-chip');
  const targetEl = chips[targetIndex];
  if (!targetEl) {
    viewHighlightStyle.value = { ...viewHighlightStyle.value, opacity: 0 };
    return;
  }

  viewHighlightStyle.value = {
    left: `${targetEl.offsetLeft}px`,
    width: `${targetEl.offsetWidth}px`,
    opacity: 1,
  };
};

watch([activeViewIndex, viewHoverIndex], updateViewHighlight);

// Mobile shows the full filtered library in one scrollable list — no paging.
const displayedBooks = computed(() => filteredBooks.value);

const hasActiveFilter = computed(() => (
  selectedStatus.value !== "all" || selectedFormat.value !== "all"
));

// Methods
const setStatus = (value) => {
  selectedStatus.value = value;
  filterOpen.value = false;
};

const setFormat = (value) => {
  updateSettings({ formatFilter: value });
  filterOpen.value = false;
};

const handleClickOutside = (event) => {
  if (!event.target.closest(".filter-dropdown")) {
    filterOpen.value = false;
  }
};


const setViewMode = (mode) => {
  viewMode.value = mode;
  updateSettings({ libraryView: mode });
};

const retryLoadLibrary = () => {
  fetchAllData(true);
};



const openDeleteModal = (book) => {
  selectedBook.value = book;
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  selectedBook.value = null;
};

const deleteBook = async () => {
  const book = selectedBook.value;
  if (!book) return;
  closeDeleteModal();
  try {
    await removeBookFromStore(book.id);
    addToast(`"${book.title}" was permanently deleted.`, 'success');
  } catch {
    addToast(`Could not delete "${book.title}".`, 'error');
  }
};

const handleResize = () => {
  updateViewHighlight();
};

onMounted(() => {
  handleResize();
  setTimeout(() => {
    updateViewHighlight();
  }, 100);
  window.addEventListener("resize", handleResize);
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  document.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped>
.books-container {
  padding: calc(4.85rem + env(safe-area-inset-top)) 0rem calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
  margin: 0 auto;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

/* Floating add button — fixed above the bottom nav, unaffected by scroll. */
.add-book-fab {
  position: fixed;
  right: 18px;
  bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom) + 18px);
  z-index: 1310;
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--color-brand-primary);
  color: #fff;
  cursor: pointer;
  font-size: 28px;
  box-shadow: 0 8px 22px rgba(138, 43, 226, 0.38);
  transition: bottom 0.28s ease;
}

/* Clears the ~62px mini player (which sits above the nav) plus a gap. */
.add-book-fab.above-mini-player {
  bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom) + 90px);
}

.add-book-fab:active {
  transform: scale(0.94);
}

.add-book-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 10px;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  font-size: 0.875rem;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 0.25s ease, transform 0.25s ease;
}

.add-book-btn:hover {
  background: var(--color-brand-primary-hover);
  transform: translateY(-1px);
}

.add-book-btn i {
  font-size: 1.125rem;
}

/* Icon-only chips inside view toggle */
.view-chip-icon {
  padding: 0.4rem 0.65rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  line-height: 1;
}

.view-chip-icon i {
  display: inline-flex;
}

/* View toggle (Grid / Table) — same styling as status chips */
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

.books-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2rem;
  justify-content: start;
  align-items: start;
}

.book-card.horizontal {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 1.25rem;
  background: transparent;
  border-radius: 16px;
  padding: 1.25rem;
  border: 1px solid var(--color-border-on-image);
  cursor: pointer;
  width: 100%;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-card-subtle);
  position: relative;
  overflow: hidden;
  color: var(--color-text-on-brand);
  z-index: 1;
  min-height: 276px;
  height: 100%;
}

.book-card.horizontal:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card-hover);
  border-color: var(--color-border-on-image-strong);
}

.book-card-bg-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  z-index: -1;
}

.book-bg {
  position: absolute;
  top: -20px;
  left: -20px;
  right: -20px;
  bottom: -20px;
  background-size: cover;
  background-position: center;
  filter: blur(25px) saturate(150%);
  transform: scale(1.2);
}

.book-bg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--gradient-image-card-overlay);
}

.book-cover {
  width: 110px;
  height: 165px;
  aspect-ratio: 2/3;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--shadow-cover);
  flex-shrink: 0;
  transition: all 0.3s ease;
  position: relative;
}

.book-card.horizontal:hover .book-cover {
  box-shadow: var(--shadow-cover-hover);
}

/* Overlay & Icons Styles */
.cover-overlay {
  position: absolute;
  inset: 0;
  background: var(--gradient-cover-action-overlay);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 10;
}

.book-card.horizontal:hover .cover-overlay {
  opacity: 1;
}

.cover-overlay.active {
  opacity: 1;
}

.play-btn {
  background: var(--color-surface-on-image-hover);
  backdrop-filter: blur(4px);
  border: 1px solid var(--color-border-on-image-strong);
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.play-btn i {
  color: var(--color-text-on-brand);
  font-size: 20px;
  margin-left: 2px; /* Optical centering */
}

.play-btn:hover {
  transform: scale(1.1);
  background: var(--color-brand-primary);
  border-color: var(--color-brand-primary);
}

.play-btn.active {
  background: var(--color-brand-primary);
  border-color: var(--color-brand-primary);
  opacity: 1;
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.book-card.horizontal:hover .book-cover img {
  transform: scale(1.05);
}

.book-info {
  text-align: left;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  padding: 0.15rem 0;
}

.book-title {
  font-size: 1.15rem;
  font-weight: 500;
  color: var(--color-text-on-image-primary);
  margin: 0 0 0.25rem 0;
  line-height: 1.22;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: var(--shadow-text-on-image);
}

.book-author {
  font-size: 0.85rem;
  color: var(--color-text-on-image-secondary);
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-series {
  font-size: 0.8rem;
  color: var(--color-text-on-image-tertiary);
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-series.standalone {
  color: var(--color-text-on-image-secondary);
  opacity: 0.8;
}

.book-genre-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: var(--color-text-on-image-muted);
  background: var(--color-border-on-image);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.45rem;
  width: fit-content;
  max-width: 100%;
}

.book-meta {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 0;
  font-size: 0.85rem;
  color: var(--color-text-on-image-secondary);
}

.grid-progress {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  min-width: 0;
  margin-bottom: 0.45rem;
}

.grid-progress-track {
  flex: 1;
  height: 7px;
  min-width: 58px;
  border-radius: 999px;
  background: var(--color-border-on-image);
  overflow: hidden;
  box-shadow: inset 0 0 0 1px var(--color-border-on-image);
}

.grid-progress-fill {
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
  background: var(--gradient-library-progress);
  transition: width 0.3s ease;
}

.grid-progress span {
  color: var(--color-text-on-image-secondary);
  font-size: 0.78rem;
  min-width: 34px;
  text-align: right;
}

.book-goodreads-row {
  margin-top: 0.4rem;
  margin-bottom: 0.5rem;
  min-width: 0;
}

.book-goodreads-row :deep(.goodreads-rating) {
  color: var(--color-text-on-image-secondary);
  flex-wrap: wrap;
  row-gap: 0.2rem;
}

.book-goodreads-row :deep(.goodreads-score) {
  color: var(--color-text-on-image-primary);
}

.book-goodreads-row :deep(.goodreads-count) {
  color: var(--color-text-on-image-secondary);
}

.goodreads-svg {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.genre-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}


.progress-meta i {
  color: var(--color-text-on-image-primary);
}

.book-actions {
  display: flex;
  gap: 0.5rem;
  border-top: 1px solid var(--color-border-on-image);
  padding-top: 0.75rem;
  margin-top: auto;
}

.action-btn {
  background: var(--color-border-on-image);
  border: 1px solid var(--color-border-on-image);
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-on-image-secondary);
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--color-surface-on-image-hover);
  color: var(--color-text-on-image-primary);
  border-color: var(--color-border-on-image-strong);
}

.action-btn i.active,
.action-btn i.ri-heart-fill {
  color: var(--color-status-danger-bright);
}

.action-btn:hover i.active {
  color: var(--color-status-danger);
}

.action-btn.delete:hover {
  background: var(--color-status-danger-soft);
  color: var(--color-status-danger-bright);
  border-color: var(--color-status-danger-border);
}

.books-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.list-cover {
  width: 50px;
  height: 72px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: var(--shadow-control-subtle);
}

.list-details {
  min-width: 0;
}

.list-title {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--color-text-primary);
  margin: 0 0 0.15rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-author {
  font-size: 0.78rem;
  color: var(--color-text-subtle);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-progress-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.list-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--color-border-subtle);
  border-radius: 3px;
  overflow: hidden;
}

.list-progress-fill {
  height: 100%;
  background: var(--gradient-library-progress);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.list-progress-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  min-width: 32px;
  text-align: right;
}

.list-goodreads-cell {
  display: flex;
  align-items: center;
  min-width: 0;
}

.list-goodreads-cell :deep(.goodreads-rating) {
  overflow: hidden;
}

.list-goodreads-cell :deep(.goodreads-count) {
  overflow: hidden;
  text-overflow: ellipsis;
}


.list-actions {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

.list-action-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-action-btn:hover {
  background: var(--color-border-subtle);
  color: var(--color-text-secondary);
}

.list-action-btn.active {
  color: var(--color-status-danger-bright);
}

.list-action-btn.delete:hover {
  background: var(--color-status-danger-soft);
  color: var(--color-status-danger);
}

/* === Reading-status Filter dropdown === */
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

.filter-button:hover,
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

.sfp-pill:hover {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
}

.sfp-pill.active {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-hover);
  color: var(--color-brand-primary);
  font-weight: 500;
}

/* === View-toggle chips === */
.chip-highlight {
  position: absolute;
  top: 4px;
  bottom: 4px;
  border-radius: 8px;
  background: var(--color-surface-hover);
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  pointer-events: none;
  z-index: 0;
}

.chip-highlight.is-active {
  background: var(--purple-li-active);
}

.status-chip {
  position: relative;
  z-index: 1;
  padding: 0.4rem 0.9rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-family: inherit;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.3s ease;
}

.status-chip:hover {
  /* color: var(--color-text-primary); */
}

.status-chip.active {
  color: var(--color-brand-primary);
  font-weight: 500;
}

/* === Unified View Container === */
.view-container {
  width: 100%;
}

.view-container.is-card {
  background: var(--color-surface-card);
  border: 0;
  border-radius: 14px;
  overflow: hidden;
}

/* Controls row inside the container */
.controls-row.in-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1rem 1.25rem;
}

.view-container.is-card .controls-row.in-container {
  background: transparent;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}


.mobile-table-card-list {
  display: none;
}



/* Add some breathing room between toolbar and grid for grid view */
.view-container:not(.is-card) .controls-row.in-container {
  padding: 0 0 1rem 0;
}

.playlist-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--color-background-overlay-soft);
  backdrop-filter: blur(5px);
}

.playlist-modal {
  width: min(560px, 100%);
  background: var(--color-surface-modal);
  border: 1px solid var(--color-border-subtle);
  border-radius: 18px;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
}

.playlist-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.35rem 1.5rem 0;
}

.playlist-modal-header h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.25rem;
  font-weight: 600;
}

.playlist-modal-header p {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}

.playlist-book-preview {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin: 1rem 1.5rem 0;
  padding: 0.75rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  background: var(--color-brand-primary-faint);
}

.playlist-book-preview img {
  width: 44px;
  height: 62px;
  flex: 0 0 auto;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: var(--shadow-cover);
}

.playlist-book-preview div {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.playlist-book-preview strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 0.92rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-book-preview span {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.close-button {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.25rem;
}

.close-button:hover {
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
}

.playlist-mode-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem;
  margin: 1rem 1.5rem 0;
  padding: 0.25rem;
  border-radius: 11px;
  background: var(--color-surface-secondary);
}

.playlist-mode-toggle button {
  padding: 0.65rem 1rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.playlist-mode-toggle button.active {
  background: var(--color-surface-primary);
  color: var(--color-brand-primary);
  box-shadow: var(--shadow-control-subtle);
}

.playlist-mode-toggle button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.playlist-picker,
.playlist-create-form {
  padding: 1rem 1.5rem 1.25rem;
}

.playlist-picker {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 330px;
  overflow-y: auto;
}

.playlist-search {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  background: var(--color-surface-input);
  color: var(--color-text-muted);
}

.playlist-search:focus-within {
  border-color: var(--color-border-focus);
  box-shadow: var(--shadow-focus-ring);
}

.playlist-search input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-size: 0.86rem;
}

.playlist-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  background: var(--color-surface-input);
  cursor: pointer;
}

.playlist-option.active {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
}

.playlist-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.playlist-option-copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
}

.playlist-option-copy strong {
  color: var(--color-text-primary);
  font-weight: 600;
}

.playlist-option-copy small,
.playlist-empty-note {
  color: var(--color-text-muted);
}

.playlist-option-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 10px;
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary);
  font-size: 1rem;
}

.playlist-option-check {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
  color: transparent;
}

.playlist-option.active .playlist-option-check {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.playlist-empty-note {
  margin: 0;
  padding: 1rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: 10px;
  text-align: center;
  font-size: 0.82rem;
  line-height: 1.5;
}

.playlist-create-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.playlist-create-form label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: var(--color-text-secondary);
  font-size: 0.86rem;
}

.playlist-input {
  width: 100%;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 9px;
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
  font: inherit;
  resize: vertical;
}

.playlist-input:focus {
  outline: none;
  border-color: var(--color-brand-primary);
  background: var(--color-surface-primary);
}

.playlist-modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-surface-secondary);
}

.playlist-selection-summary {
  margin-right: auto;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-secondary,
.btn-primary-modal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 40px;
  padding: 0.65rem 1rem;
  border-radius: 9px;
  cursor: pointer;
  border: 1px solid var(--color-border-subtle);
}

.btn-secondary {
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}

.btn-primary-modal {
  background: var(--gradient-brand-primary);
  border-color: transparent;
  color: var(--color-text-on-brand);
}

.btn-primary-modal:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

  .books-container {
    padding: calc(4.85rem + env(safe-area-inset-top)) 0 calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
  }


  .books-content {
    padding-top: 0.05rem;
  }


  .view-container:not(.is-card) .controls-row.in-container,
  .controls-row.in-container {
    align-items: center;
    flex-wrap: nowrap;
    gap: 12px;
    padding: 0 var(--mobile-page-padding-inline) 16px;
  }

  /* One row: Filter dropdown on the left, view toggle pinned right. */
  .controls-left {
    flex: 1 1 auto;
    min-width: 0;
    overflow: visible;
  }

  .controls-right {
    display: flex;
    flex: 0 0 auto;
  }


  .view-chips {
    gap: 6px;
    padding: 0;
    border: 0;
    background: transparent;
  }

  .chip-highlight {
    display: none;
  }

  .status-chip {
    min-height: 34px;
    padding: 0 12px;
    border-radius: var(--mobile-control-radius);
    background: rgba(138, 43, 226, 0.1);
    color: var(--color-text-muted);
    font-size: var(--mobile-caption-size);
    line-height: 1;
  }

  .status-chip.active {
    background: var(--color-brand-primary-soft);
    color: var(--color-brand-primary);
  }

  .view-chip-icon {
    width: 34px;
    height: 34px;
    min-height: 34px;
    padding: 0;
    border-radius: var(--mobile-control-radius);
    background: rgba(138, 43, 226, 0.07);
    color: var(--color-text-subtle);
    font-size: 18px;
  }

  .view-chip-icon.active {
    background: var(--color-surface-hover);
    color: var(--color-brand-primary);
  }

  .books-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px 14px;
    justify-content: start;
    padding: 0 var(--mobile-page-padding-inline);
  }


  .mobile-table-card-list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 0 var(--mobile-page-padding-inline);
  }

  .list-actions {
    opacity: 1;
  }

</style>
