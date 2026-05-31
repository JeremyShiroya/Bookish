<template>
  <div class="books-container">
    <!-- Header -->
    <div class="books-header">
      <div class="books-title-row">
        <h1 class="books-title">Books</h1>
        <button class="add-book-btn" @click="router.push('/add')">
          <i class="ri-add-line"></i>
          Add Book
        </button>
      </div>

      <!-- Metric Cards -->
      <div v-if="books.length > 0" class="metric-cards">
        <div class="metric-card">
          <div class="metric-icon metric-icon-total">
            <i class="ri-stack-line"></i>
          </div>
          <div class="metric-text">
            <div class="metric-label">Total</div>
            <div class="metric-value">{{ bookMetrics.total }}</div>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon metric-icon-unread">
            <i class="ri-book-2-line"></i>
          </div>
          <div class="metric-text">
            <div class="metric-label">Unread</div>
            <div class="metric-value">{{ bookMetrics.unread }}</div>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon metric-icon-reading">
            <i class="ri-book-open-line"></i>
          </div>
          <div class="metric-text">
            <div class="metric-label">Reading</div>
            <div class="metric-value">{{ bookMetrics.reading }}</div>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon metric-icon-finished">
            <i class="ri-checkbox-circle-line"></i>
          </div>
          <div class="metric-text">
            <div class="metric-label">Finished</div>
            <div class="metric-value">{{ bookMetrics.read }}</div>
          </div>
        </div>
      </div>
      
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="books-loading">
      <SkeletonLoader variant="books-grid" :count="12" />
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
              <!-- Reading Status Chips -->
              <div
                class="status-chips"
                ref="chipsRef"
                @mouseleave="chipHoverIndex = -1"
              >
                <div
                  class="chip-highlight"
                  :style="chipHighlightStyle"
                  :class="{ 'is-active': isChipHighlightActive }"
                ></div>
                <button
                  class="status-chip"
                  :class="{ active: selectedStatus === 'all' }"
                  @click="setStatus('all')"
                  @mouseenter="chipHoverIndex = 0"
                >All</button>
                <button
                  v-for="(status, idx) in readingStatuses"
                  :key="status"
                  class="status-chip"
                  :class="{ active: selectedStatus === status }"
                  @click="setStatus(status)"
                  @mouseenter="chipHoverIndex = idx + 1"
                >{{ status }}</button>
              </div>
            </div>
            
            <div class="controls-right">
              <!-- Combined Filters Dropdown -->
              <div class="filter-dropdown filters-merged" ref="filtersDropdown">
                <button class="filter-button" @click="toggleDropdown('filters')">
                  <i class="ri-filter-3-line"></i>
                  Filters
                  <span v-if="activeFilterCount > 0" class="filter-count">{{ activeFilterCount }}</span>
                  <i class="ri-arrow-down-s-line"></i>
                </button>
                <div class="dropdown-menu filters-menu" v-show="activeDropdown === 'filters'">
                  <div class="dropdown-section">
                    <h4>Sort by</h4>
                    <div
                      class="dropdown-option"
                      :class="{ active: sortBy === 'name' }"
                      @click="setSortBy('name')"
                    >
                      <i class="ri-check-line" v-if="sortBy === 'name'"></i>
                      Name
                    </div>
                    <div
                      class="dropdown-option"
                      :class="{ active: sortBy === 'rating' }"
                      @click="setSortBy('rating')"
                    >
                      <i class="ri-check-line" v-if="sortBy === 'rating'"></i>
                      Rating
                    </div>
                  </div>
                  <div class="dropdown-divider"></div>
                  <div class="dropdown-section">
                    <h4>Sort direction</h4>
                    <template v-if="sortBy === 'name'">
                      <div
                        class="dropdown-option"
                        :class="{ active: sortDirection === 'asc' }"
                        @click="setSortDirection('asc')"
                      >
                        <i class="ri-check-line" v-if="sortDirection === 'asc'"></i>
                        A to Z
                      </div>
                      <div
                        class="dropdown-option"
                        :class="{ active: sortDirection === 'desc' }"
                        @click="setSortDirection('desc')"
                      >
                        <i class="ri-check-line" v-if="sortDirection === 'desc'"></i>
                        Z to A
                      </div>
                    </template>
                    <template v-else-if="sortBy === 'rating'">
                      <div
                        class="dropdown-option"
                        :class="{ active: sortDirection === 'desc' }"
                        @click="setSortDirection('desc')"
                      >
                        <i class="ri-check-line" v-if="sortDirection === 'desc'"></i>
                        Good - Bad
                      </div>
                      <div
                        class="dropdown-option"
                        :class="{ active: sortDirection === 'asc' }"
                        @click="setSortDirection('asc')"
                      >
                        <i class="ri-check-line" v-if="sortDirection === 'asc'"></i>
                        Bad - Good
                      </div>
                    </template>
                  </div>
                  <div class="dropdown-divider"></div>
                  <div class="dropdown-section">
                    <h4>Rating</h4>
                    <div
                      class="dropdown-option"
                      :class="{ active: selectedRating === 'all' }"
                      @click="setRating('all')"
                    >
                      <i class="ri-check-line" v-if="selectedRating === 'all'"></i>
                      All Ratings
                    </div>
                    <div
                      class="dropdown-option"
                      :class="{ active: selectedRating === 'good' }"
                      @click="setRating('good')"
                    >
                      <i class="ri-check-line" v-if="selectedRating === 'good'"></i>
                      Good (6-10)
                    </div>
                    <div
                      class="dropdown-option"
                      :class="{ active: selectedRating === 'mid' }"
                      @click="setRating('mid')"
                    >
                      <i class="ri-check-line" v-if="selectedRating === 'mid'"></i>
                      Mid (5)
                    </div>
                    <div
                      class="dropdown-option"
                      :class="{ active: selectedRating === 'bad' }"
                      @click="setRating('bad')"
                    >
                      <i class="ri-check-line" v-if="selectedRating === 'bad'"></i>
                      Bad (1-4)
                    </div>
                  </div>
                </div>
              </div>

              <!-- View Toggle -->
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
                  aria-label="Table view"
                  title="Table view"
                >
                  <i class="ri-list-unordered"></i>
                </button>
              </div>
            </div>
          </div>

        <!-- Grid View -->
        <div v-if="viewMode === 'grid'" class="books-grid">
          <div
            v-for="book in paginatedBooks"
            :key="book.id"
            class="book-card horizontal"
            @click="router.push(`/reader/${book.id}`)"
          >
            <div class="book-card-bg-container">
              <div class="book-bg" :style="{ backgroundImage: `url(${resolveBookCover(book)})` }"></div>
              <div class="book-bg-overlay"></div>
            </div>
            <div class="book-cover">
              <img :src="resolveBookCover(book)" :alt="book.title" @error="(e) => coverFallback(e, book.title)" />
              <div class="cover-overlay">
                <button
                  class="play-btn"
                  :class="{ active: isBookActive(book) }"
                  title="Read aloud"
                  @click.stop="handlePlay(book)"
                >
                  <i :class="isBookActive(book) ? 'ri-pause-fill' : 'ri-play-fill'"></i>
                </button>
              </div>
            </div>
            <div class="book-info">
              <h3 class="book-title" :title="book.title">{{ truncateWords(book.title, 7) }}</h3>
              <p class="book-author">
                {{ book.author }} 
                <span v-if="book.publishYear">• {{ book.publishYear }}</span>
              </p>
              <p class="book-series" :class="{ standalone: !book.series }">
                {{ book.series || 'Standalone' }}
              </p>
              <div v-if="book.genre" class="book-genre-tag" :title="'Genre: ' + book.genre">
                <i class="ri-price-tag-3-line"></i>
                <span>{{ book.genre }}</span>
              </div>
              
              <div v-if="getGoodreadsRating(book)" class="book-goodreads-row" title="Goodreads Rating">
                <GoodreadsRatingDisplay :web-review="book.webReview" compact />
              </div>

              <div class="book-meta">
                <div class="meta-item" title="Personal Rating">
                  <i class="ri-star-fill star-icon"></i>
                  <span>{{ formatPersonalRating(book.rating) }}</span>
                  <span>{{ book.rating || '—' }}</span>
                </div>
                <div class="grid-progress" title="Reading Progress">
                  <div class="grid-progress-track">
                    <div class="grid-progress-fill" :style="{ width: `${book.progress || 0}%` }"></div>
                  </div>
                  <span>{{ book.progress || 0 }}%</span>
                </div>
              </div>
              
              <div class="book-actions">
                <button class="action-btn" :class="{ active: book.isFavourite }" title="Add to favorites" @click.stop="toggleFavourite(book.id)">
                  <i :class="[book.isFavourite ? 'ri-heart-fill' : 'ri-heart-line']"></i>
                </button>
                <button class="action-btn" title="Add to playlist" @click.stop="openPlaylistModal(book)">
                  <i class="ri-play-list-2-line"></i>
                </button>
                <button class="action-btn" title="Edit book" @click.stop="router.push(`/edit/${book.id}`)">
                  <i class="ri-edit-line"></i>
                </button>
                <button class="action-btn delete" title="Delete book" @click.stop="openDeleteModal(book)">
                  <i class="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="data-table">
            <!-- Header -->
            <div class="data-header">
              <div class="col-book">Book</div>
              <div class="col-status">Status</div>
              <div class="col-progress">Progress</div>
              <div class="col-personal">Personal Rating</div>
              <div class="col-goodreads">Goodreads Rating</div>
              <div class="col-actions"></div>
            </div>

            <!-- Rows -->
            <div
              v-for="book in paginatedBooks"
              :key="book.id"
              class="data-row"
              @click="router.push(`/reader/${book.id}`)"
            >
              <div class="col-book book-cell">
                <img :src="resolveBookCover(book)" :alt="book.title" class="cell-cover" @error="(e) => coverFallback(e, book.title)" />
                <div class="cell-book-info">
                  <div class="cell-book-title-row">
                    <h3 class="cell-book-title" :title="book.title">{{ truncateWords(book.title, 9) }}</h3>
                    <span class="cell-format">{{ book.format ? book.format.toUpperCase() : 'BOOK' }}</span>
                  </div>
                  <p class="cell-book-author">
                    {{ book.author || 'Unknown author' }}<span v-if="book.publishYear"> • {{ book.publishYear }}</span>
                  </p>
                  <div class="cell-book-tags">
                    <span class="cell-chip" :class="{ standalone: !book.series }">{{ book.series || 'Standalone' }}</span>
                    <span v-if="book.genre" class="cell-chip genre"><i class="ri-price-tag-3-line"></i>{{ book.genre }}</span>
                  </div>
                </div>
              </div>

              <div class="col-status">
                <span class="status-pill" :class="statusBadgeClass(book.status)">{{ book.status || 'Unread' }}</span>
              </div>

              <div class="col-progress">
                <div class="progress-wrap">
                  <template v-if="(book.progress || 0) >= 100">
                    <i class="ri-checkbox-circle-fill progress-complete-icon"></i>
                    <span class="progress-complete-text">100%</span>
                  </template>
                  <template v-else>
                    <div class="progress-bar">
                      <div class="progress-fill" :style="{ width: `${book.progress || 0}%` }"></div>
                    </div>
                    <span class="progress-text">{{ book.progress || 0 }}%</span>
                  </template>
                </div>
              </div>

              <div class="col-personal">
                <div class="rating-wrap">
                  <i class="ri-star-fill list-star"></i>
                  <span>{{ formatPersonalRating(book.rating) }}</span>
                </div>
              </div>

              <div class="col-goodreads">
                <div class="goodreads-wrap" :data-tooltip="goodreadsTooltip(book) || null">
                  <GoodreadsRatingDisplay v-if="getGoodreadsRating(book)" :web-review="book.webReview" compact />
                  <span v-else class="rating-empty">—</span>
                </div>
              </div>

              <div class="col-actions" @click.stop>
                <button class="row-action-btn" :class="{ active: book.isFavourite }" title="Favourite" @click="toggleFavourite(book.id)">
                  <i :class="book.isFavourite ? 'ri-heart-fill' : 'ri-heart-line'"></i>
                </button>
                <button class="row-action-btn" title="Add to playlist" @click="openPlaylistModal(book)">
                  <i class="ri-play-list-2-line"></i>
                </button>
                <button class="row-action-btn" title="Edit" @click="router.push(`/edit/${book.id}`)">
                  <i class="ri-edit-line"></i>
                </button>
                <button class="row-action-btn delete" title="Delete" @click="openDeleteModal(book)">
                  <i class="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pagination">
            <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">
              <i class="ri-arrow-left-s-line"></i>
            </button>
            <template v-for="(page, idx) in visiblePageNumbers" :key="idx">
              <span v-if="page === '...'" class="page-ellipsis">...</span>
              <button v-else class="page-btn" :class="{ active: page === currentPage }" @click="currentPage = page">{{ page }}</button>
            </template>
            <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">
              <i class="ri-arrow-right-s-line"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else
        title="Your library is empty"
        description="Connect your first document to start building your personal library."
        icon="ri-book-open-line"
      >
        <template #action>
          <button class="add-book-btn" @click="router.push('/add')">
            <i class="ri-add-line"></i>
            Add Your First Book
          </button>
        </template>
      </EmptyState>
    </div>


    <div v-if="showPlaylistModal" class="playlist-modal-overlay" @click="closePlaylistModal">
      <div class="playlist-modal" @click.stop>
        <div class="playlist-modal-header">
          <div>
            <h2>Add to Playlist</h2>
            <p>{{ selectedPlaylistBook?.title }}</p>
          </div>
          <button class="close-button" @click="closePlaylistModal">
            <i class="ri-close-line"></i>
          </button>
        </div>

        <div class="playlist-mode-toggle">
          <button
            type="button"
            :class="{ active: playlistMode === 'existing' }"
            :disabled="selectablePlaylists.length === 0"
            @click="playlistMode = 'existing'"
          >
            Existing
          </button>
          <button
            type="button"
            :class="{ active: playlistMode === 'new' }"
            @click="playlistMode = 'new'"
          >
            New Playlist
          </button>
        </div>

        <div v-if="playlistMode === 'existing'" class="playlist-picker">
          <label
            v-for="playlist in selectablePlaylists"
            :key="playlist.id"
            class="playlist-option"
            :class="{ active: selectedPlaylistId === String(playlist.id) }"
          >
            <input type="radio" :value="String(playlist.id)" v-model="selectedPlaylistId" />
            <span>
              <strong>{{ playlist.name }}</strong>
              <small>{{ playlist.bookCount || 0 }} books</small>
            </span>
          </label>

          <p v-if="selectablePlaylists.length === 0" class="playlist-empty-note">
            This book is already in every playlist. Create a new one to add it somewhere fresh.
          </p>
        </div>

        <div v-else class="playlist-create-form">
          <label>
            Name
            <input v-model="newPlaylistName" type="text" placeholder="Weekend reads" class="playlist-input" />
          </label>
          <label>
            Description
            <textarea v-model="newPlaylistDescription" rows="3" placeholder="Optional note..." class="playlist-input"></textarea>
          </label>
        </div>

        <div class="playlist-modal-actions">
          <button type="button" class="btn-secondary" @click="closePlaylistModal">Cancel</button>
          <button type="button" class="btn-primary-modal" :disabled="!canSavePlaylist || isSavingPlaylist" @click="saveBookToPlaylist">
            <i v-if="isSavingPlaylist" class="ri-loader-4-line spinner"></i>
            <i v-else class="ri-play-list-add-line"></i>
            {{ isSavingPlaylist ? 'Adding...' : 'Add to Playlist' }}
          </button>
        </div>
      </div>
    </div>


    <!-- Delete Confirmation Modal -->
    <DeleteConfirmModal
      v-if="showDeleteModal"
      :book="selectedBook"
      @close="closeDeleteModal"
      @confirm="deleteBook"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import DeleteConfirmModal from "./DeleteConfirmModal.vue";
import GoodreadsRatingDisplay from "./GoodreadsRatingDisplay.vue";

import { useBooks } from "~/composables/useBooks";
import { getGoodreadsRating, parseGoodreadsReview } from "~/composables/useGoodreadsRating";
import { useTTS } from "~/composables/useTTS";
import { useBookishSettings } from "~/composables/useBookishSettings";
import { useToast } from "~/composables/useToast";

// Reactive data
import EmptyState from "./EmptyState.vue";

const {
  books,
  collections,
  loading,
  error,
  updateBook,
  deleteBook: removeBookFromStore,
  toggleFavourite,
  createPlaylist,
  addBookToPlaylist,
  fetchAllData,
} = useBooks();
const { play: playTTS, ttsBook, ttsStatus } = useTTS()
const { settings, updateSettings } = useBookishSettings();
const { addToast } = useToast();

const isBookActive = (book) =>
  ttsBook.value?.id === book.id && ttsStatus.value !== 'idle'

const handlePlay = (book) => {
  playTTS(book)
}

const router = useRouter();

// Filter options
const readingStatuses = ["Unread", "Reading", "Read"];

// Filter states
const sortBy = ref(settings.value.librarySort);
const sortDirection = ref(settings.value.librarySort === "rating" ? "desc" : "asc");
const selectedStatus = ref("all");
const selectedRating = ref("all");
const viewMode = ref(settings.value.libraryView);

// Dropdown states
const activeDropdown = ref(null);
const activeActionsMenu = ref(null);

// Modal states
const showDeleteModal = ref(false);
const selectedBook = ref(null);
const showPlaylistModal = ref(false);
const selectedPlaylistBook = ref(null);
const selectedPlaylistId = ref("");
const playlistMode = ref("existing");
const newPlaylistName = ref("");
const newPlaylistDescription = ref("");
const isSavingPlaylist = ref(false);

// Computed filtered books
const filteredBooks = computed(() => {
  let filtered = [...books.value];

  // Filter by status
  if (selectedStatus.value !== "all") {
    filtered = filtered.filter((book) => book.status === selectedStatus.value);
  }

  // Filter by rating
  if (selectedRating.value !== "all") {
    filtered = filtered.filter((book) => {
      if (selectedRating.value === "good")
        return book.rating >= 6 && book.rating <= 10;
      if (selectedRating.value === "mid") return book.rating === 5;
      if (selectedRating.value === "bad")
        return book.rating >= 1 && book.rating <= 4;
      return true;
    });
  }

  // Sort books
  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy.value === "name") {
      comparison = a.title.localeCompare(b.title);
    } else if (sortBy.value === "rating") {
      comparison = getGoodreadsRating(a) - getGoodreadsRating(b);
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

// Sliding pill for status chips (mirrors Sidebar.vue pattern)
const chipsRef = ref(null);
const chipHoverIndex = ref(-1);
const chipHighlightStyle = ref({ left: '0px', width: '0px', opacity: 0 });
const isChipHighlightActive = ref(false);

const activeChipIndex = computed(() => {
  if (selectedStatus.value === 'all') return 0;
  const idx = readingStatuses.indexOf(selectedStatus.value);
  return idx === -1 ? 0 : idx + 1;
});

const updateChipHighlight = async () => {
  await nextTick();
  if (!chipsRef.value) return;

  let targetIndex = chipHoverIndex.value;
  let isActive = false;

  if (targetIndex === -1) {
    targetIndex = activeChipIndex.value;
    isActive = true;
  } else if (targetIndex === activeChipIndex.value) {
    isActive = true;
  }

  isChipHighlightActive.value = isActive;

  const chips = chipsRef.value.querySelectorAll('.status-chip');
  const targetEl = chips[targetIndex];
  if (!targetEl) {
    chipHighlightStyle.value = { ...chipHighlightStyle.value, opacity: 0 };
    return;
  }

  chipHighlightStyle.value = {
    left: `${targetEl.offsetLeft}px`,
    width: `${targetEl.offsetWidth}px`,
    opacity: 1,
  };
};

watch([activeChipIndex, chipHoverIndex], updateChipHighlight);

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

// Active filter count for the merged Filters dropdown badge
const activeFilterCount = computed(() => (selectedRating.value !== 'all' ? 1 : 0));

const currentPage = ref(1);
const itemsPerPage = computed(() => Number(settings.value.libraryItemsPerPage) || 20);

const totalPages = computed(() => Math.ceil(filteredBooks.value.length / itemsPerPage.value));

const paginatedBooks = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredBooks.value.slice(start, start + itemsPerPage.value);
});

const visiblePageNumbers = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
});

watch([selectedStatus, selectedRating, sortBy, sortDirection, viewMode, itemsPerPage], () => {
  currentPage.value = 1;
});

const statusBadgeClass = (status) => {
  if (status === 'Reading') return 'status-reading';
  if (status === 'Read') return 'status-read';
  return 'status-unread';
};

const selectablePlaylists = computed(() => {
  const bookId = selectedPlaylistBook.value?.id;
  return collections.value
    .filter((playlist) => !bookId || !(playlist.bookIds || []).includes(bookId))
    .map((playlist) => ({ ...playlist, bookCount: (playlist.bookIds || []).length }));
});

const canSavePlaylist = computed(() => (
  playlistMode.value === "new"
    ? newPlaylistName.value.trim().length > 0
    : Boolean(selectedPlaylistId.value)
));

const truncateWords = (value, limit = 7) => {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return words.join(" ");
  return `${words.slice(0, limit).join(" ")}...`;
};

const formatPersonalRating = (rating) => {
  const score = Number(rating || 0);
  return score > 0 ? `${score}/10` : "--/10";
};

const goodreadsTooltip = (book) => {
  const info = parseGoodreadsReview(book.webReview);
  const parts = [];
  if (info.ratingsCount) parts.push(`${info.ratingsCount} ratings`);
  if (info.reviewsCount) parts.push(`${info.reviewsCount} reviews`);
  return parts.join(" · ");
};

// Methods
const toggleDropdown = (dropdown) => {
  activeDropdown.value = activeDropdown.value === dropdown ? null : dropdown;
};

const toggleActionsMenu = (bookId) => {
  activeActionsMenu.value = activeActionsMenu.value === bookId ? null : bookId;
};

const setSortBy = (value) => {
  sortBy.value = value;
  updateSettings({ librarySort: value });
  // When switching to rating sort, default to Good - Bad (desc)
  if (value === "rating" && sortDirection.value === "asc") {
    sortDirection.value = "desc";
  }
  activeDropdown.value = null;
};

const setSortDirection = (value) => {
  sortDirection.value = value;
  activeDropdown.value = null;
};

const setStatus = (value) => {
  selectedStatus.value = value;
  activeDropdown.value = null;
};

const setRating = (value) => {
  selectedRating.value = value;
  activeDropdown.value = null;
};

const setViewMode = (mode) => {
  viewMode.value = mode;
  updateSettings({ libraryView: mode });
};

const retryLoadLibrary = () => {
  fetchAllData(true);
};

const openPlaylistModal = (book) => {
  selectedPlaylistBook.value = book;
  const firstAvailable = collections.value.find((playlist) => !(playlist.bookIds || []).includes(book.id));
  selectedPlaylistId.value = firstAvailable ? String(firstAvailable.id) : "";
  playlistMode.value = firstAvailable ? "existing" : "new";
  newPlaylistName.value = "";
  newPlaylistDescription.value = "";
  showPlaylistModal.value = true;
};

const closePlaylistModal = () => {
  showPlaylistModal.value = false;
  selectedPlaylistBook.value = null;
  selectedPlaylistId.value = "";
  playlistMode.value = "existing";
  newPlaylistName.value = "";
  newPlaylistDescription.value = "";
  isSavingPlaylist.value = false;
};

const saveBookToPlaylist = async () => {
  if (!selectedPlaylistBook.value || !canSavePlaylist.value || isSavingPlaylist.value) return;

  isSavingPlaylist.value = true;
  try {
    let playlistId = selectedPlaylistId.value;
    if (playlistMode.value === "new") {
      const playlist = await createPlaylist({
        name: newPlaylistName.value.trim(),
        description: newPlaylistDescription.value.trim() || null,
      });
      playlistId = String(playlist.id);
    }

    await addBookToPlaylist(playlistId, selectedPlaylistBook.value.id);
    addToast("Book added to playlist", "success");
    closePlaylistModal();
  } catch (error) {
    console.error("Playlist update failed:", error);
    addToast("Failed to update playlist", "error");
  } finally {
    isSavingPlaylist.value = false;
  }
};



const resolveBookCover = (book) => {
  if (!book.cover) {
    return generateCoverPlaceholder(book.title)
  }
  return book.cover
}

const generateCoverPlaceholder = (title) => {
  const colors = getThemeCssVars([
    { name: '--color-book-cover-placeholder-one', fallback: '#8A2BE2' },
    { name: '--color-book-cover-placeholder-two', fallback: '#6A0DAD' },
    { name: '--color-book-cover-placeholder-three', fallback: '#9370DB' },
    { name: '--color-book-cover-placeholder-four', fallback: '#BA55D3' },
    { name: '--color-book-cover-placeholder-five', fallback: '#DDA0DD' },
  ])
  const hash = [...title].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = title.trim()[0]?.toUpperCase() || '?'
  const displayTitle = title.length > 18 ? `${title.substring(0, 18)}...` : title
  const softText = getThemeCssVar('--color-book-cover-placeholder-text-soft', 'rgba(255,255,255,0.25)')
  const strongText = getThemeCssVar('--color-book-cover-placeholder-text-strong', 'rgba(255,255,255,0.65)')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="130" font-family="serif" font-size="100" fill="${softText}" text-anchor="middle" dominant-baseline="middle">${initial}</text><text x="100" y="230" font-family="sans-serif" font-size="11" fill="${strongText}" text-anchor="middle">${displayTitle}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const coverFallback = (event, title) => {
  event.target.src = generateCoverPlaceholder(title)
}

const openDeleteModal = (book) => {
  selectedBook.value = book;
  showDeleteModal.value = true;
  activeActionsMenu.value = null;
};

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  selectedBook.value = null;
};

const deleteBook = () => {
  removeBookFromStore(selectedBook.value.id);
  closeDeleteModal();
};

// Close dropdowns when clicking outside
const handleClickOutside = (event) => {
  if (!event.target.closest(".filter-dropdown")) {
    activeDropdown.value = null;
  }
  if (!event.target.closest(".actions-dropdown")) {
    activeActionsMenu.value = null;
  }
};

const handleResize = () => {
  updateChipHighlight();
  updateViewHighlight();
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  setTimeout(() => {
    updateChipHighlight();
    updateViewHighlight();
  }, 100);
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
.books-container {
  padding: 0rem;
  margin: 0 auto;
}

.books-header {
  margin-bottom: 2rem;
}

.books-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.books-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.filters-container {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-dropdown {
  position: relative;
}

.filter-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  background: var(--color-surface-card);
  color: var(--color-text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.filter-button:hover {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.filters-merged .filter-button i:first-child {
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  font-size: 0.7rem;
  font-weight: 500;
  line-height: 1;
}

.filters-menu {
  min-width: 240px;
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

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: var(--color-surface-modal);
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  box-shadow: 0 10px 24px -10px rgba(15, 23, 42, 0.18);
  z-index: 50;
  min-width: 200px;
  margin-top: 0.25rem;
}

.dropdown-section {
  padding: 0.75rem;
}

.dropdown-section h4 {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.dropdown-option:hover {
  background: var(--color-surface-muted);
}

.dropdown-option.active {
  background: var(--color-surface-active);
  color: var(--color-brand-primary);
}

.dropdown-option i {
  width: 1rem;
  font-size: 0.875rem;
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border-subtle);
  margin: 0.5rem 0;
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
  background: var(--color-surface-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 276px;
  gap: 2rem;
  justify-content: start;
  align-items: stretch;
}

@media (max-width: 1100px) {
  .books-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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
  flex: 1;
  min-width: 90px;
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

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text-on-image-secondary);
  min-width: 58px;
}

.meta-item i {
  color: var(--color-text-on-image-subtle);
}

.meta-item span + span {
  display: none;
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

.meta-item .star-icon {
  color: var(--color-status-star);
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

.list-header-row,
.list-row {
  display: grid;
  grid-template-columns: 50px minmax(220px, 2fr) minmax(130px, 1fr) 150px 210px 70px 70px 148px;
  align-items: center;
  gap: 1rem;
}

.list-header-row {
  padding: 0 1rem;
  color: var(--color-text-subtle);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.list-row {
  padding: 0.85rem 1rem;
  background: var(--color-surface-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-card-subtle);
}

.list-row:hover {
  background: var(--color-surface-secondary);
  border-color: var(--color-border-card);
  transform: translateY(-2px);
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

.list-meta {
  min-width: 0;
}

.list-series {
  display: inline-flex;
  max-width: 100%;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  background: var(--color-surface-tertiary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-series.standalone {
  color: var(--color-text-muted);
}

.list-meta .list-series + .list-series {
  display: none;
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

.list-rating-cell {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
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

.list-star {
  color: var(--color-status-star);
  font-size: 0.9rem;
}

.list-format {
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  background: var(--color-brand-primary-faint);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  width: fit-content;
  text-align: center;
  letter-spacing: 0.03em;
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

/* === Metric Cards === */
.metric-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: 12px;
  transition: background-color 0.2s, transform 0.2s;
}

.metric-card:hover {
  background: var(--color-surface-hover);
  transform: translateY(-1px);
}

.metric-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.metric-icon-total {
  background: rgba(139, 92, 246, 0.12);
  color: rgb(124, 58, 237);
}

.metric-icon-reading {
  background: rgba(245, 158, 11, 0.14);
  color: rgb(217, 119, 6);
}

.metric-icon-finished {
  background: rgba(34, 197, 94, 0.14);
  color: rgb(22, 163, 74);
}

.metric-icon-unread {
  background: rgba(100, 116, 139, 0.14);
  color: rgb(71, 85, 105);
}

.metric-text {
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin-bottom: 0.15rem;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.1;
}

/* === Status Chips (filter row) === */
.status-chips {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
}

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
  border: 1px solid var(--color-border-card);
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
  border-bottom: 1px solid var(--color-border-card);
  background: transparent;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.data-table {
  width: 100%;
}

/* Pagination inside the container */
.view-container .pagination {
  margin: 0;
  padding: 0.85rem 1rem;
}

.view-container.is-card .pagination {
  border-top: 1px solid var(--color-border-card);
  background: transparent;
}

/* Add some breathing room between toolbar and grid for grid view */
.view-container:not(.is-card) .controls-row.in-container {
  padding: 0 0 1rem 0;
}

.data-header,
.data-row {
  display: grid;
  grid-template-columns: minmax(260px, 2.2fr) 130px minmax(160px, 1fr) 120px minmax(160px, 1.1fr) 150px;
  gap: 1rem;
  align-items: center;
  padding: 0.95rem 1.25rem;
}

.data-header {
  background: transparent;
  border-bottom: 1px solid var(--color-border-card);
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}

.data-header .col-status,
.data-header .col-progress,
.data-header .col-personal,
.data-header .col-goodreads {
  text-align: center;
}

.data-row {
  border-bottom: 1px solid var(--color-border-card);
  cursor: pointer;
  transition: background-color 0.15s;
}

.data-row:last-child {
  border-bottom: none;
}

.data-row:hover {
  background: var(--color-surface-hover);
}

/* Book cell (cover + info) */
.book-cell {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
}

.cell-cover {
  width: 48px;
  height: 70px;
  border-radius: 5px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: var(--shadow-control-subtle);
}

.cell-book-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.cell-book-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.cell-book-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-format {
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--color-brand-primary);
  background: var(--color-brand-primary-faint);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.cell-book-author {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-book-tags {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.3rem;
  min-width: 0;
}

.cell-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  max-width: 140px;
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
  background: transparent;
  border: 1px solid var(--color-border-card);
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-chip.standalone {
  color: var(--color-text-muted);
}

.cell-chip.genre {
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary-hover);
  border-color: transparent;
}

/* Status pill */
.col-status {
  display: flex;
  justify-content: center;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.8rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.status-pill.status-reading {
  background: rgba(245, 158, 11, 0.14);
  color: rgb(180, 83, 9);
}

.status-pill.status-read {
  background: rgba(34, 197, 94, 0.14);
  color: rgb(21, 128, 61);
}

.status-pill.status-unread {
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
}

/* Progress */
.col-progress {
  display: flex;
  justify-content: center;
}

.progress-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-bar {
  width: 100px;
  height: 6px;
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--gradient-library-progress);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  min-width: 34px;
  text-align: right;
}

.progress-complete-icon {
  font-size: 1.1rem;
  color: var(--color-brand-primary);
}

.progress-complete-text {
  font-size: 0.82rem;
  color: var(--color-brand-primary);
  font-weight: 500;
}

/* Personal rating */
.col-personal {
  display: flex;
  justify-content: center;
}

.rating-wrap {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

/* Goodreads rating */
.col-goodreads {
  display: flex;
  justify-content: center;
  min-width: 0;
}

.goodreads-wrap {
  display: flex;
  align-items: center;
  min-width: 0;
  position: relative;
}

/* In table view only: hide the inline ratings/reviews counts; show on hover as a tooltip */
.data-row .goodreads-wrap :deep(.goodreads-count) {
  display: none;
}

.data-row .goodreads-wrap[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.4rem 0.65rem;
  background: var(--color-text-primary);
  color: var(--color-surface-primary);
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  border-radius: 6px;
  box-shadow: var(--shadow-card-hover);
  z-index: 20;
  pointer-events: none;
}

.data-row .goodreads-wrap[data-tooltip]:hover::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--color-text-primary);
  z-index: 20;
  pointer-events: none;
}

.rating-empty {
  color: var(--color-text-subtle);
  font-size: 0.85rem;
}

/* Actions */
.col-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.15rem;
}

/* Table view only: hide action buttons until the row is hovered */
.data-row .col-actions {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.data-row:hover .col-actions,
.data-row:focus-within .col-actions {
  opacity: 1;
}

.row-action-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-action-btn:hover {
  background: var(--color-surface-muted);
  color: var(--color-brand-primary-hover);
}

.row-action-btn.active i {
  color: var(--color-status-danger-bright);
}

.row-action-btn.delete:hover {
  background: var(--color-status-danger-soft);
  color: var(--color-status-danger);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  margin-top: 1.5rem;
  padding: 1rem 0;
}

.page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 0.5rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.page-btn:hover:not(:disabled) {
  background: var(--purple-li-active);
  color: var(--color-brand-primary);
}

.page-btn.active {
  background: var(--purple-li-active);
  color: var(--color-brand-primary);
  font-weight: 500;
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-ellipsis {
  color: var(--color-text-muted);
  padding: 0 0.35rem;
  font-size: 0.875rem;
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
  width: min(520px, 100%);
  background: var(--color-surface-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 14px;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
}

.playlist-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.playlist-modal-header h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.2rem;
  font-weight: 500;
}

.playlist-modal-header p {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.88rem;
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
  gap: 0.5rem;
  padding: 1rem 1.5rem 0;
}

.playlist-mode-toggle button {
  padding: 0.65rem 1rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.playlist-mode-toggle button.active {
  background: var(--color-brand-primary);
  border-color: var(--color-brand-primary);
  color: var(--color-text-on-brand);
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
  gap: 0.65rem;
  max-height: 280px;
  overflow-y: auto;
}

.playlist-option {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.85rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  background: var(--color-surface-secondary);
  cursor: pointer;
}

.playlist-option.active {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
}

.playlist-option input {
  accent-color: var(--color-brand-primary);
}

.playlist-option span {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.playlist-option strong {
  color: var(--color-text-primary);
  font-weight: 500;
}

.playlist-option small,
.playlist-empty-note {
  color: var(--color-text-muted);
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
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
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
  background: var(--color-brand-primary);
  border-color: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.btn-primary-modal:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .books-container {
    padding: 0;
  }

  .books-header {
    flex-direction: column;
    align-items: stretch;
  }

  .filters-container {
    justify-content: center;
  }

  .books-grid {
    grid-template-columns: minmax(0, 1fr);
    justify-content: stretch;
  }

  .list-header-row,
  .redesigned-header {
    display: none;
  }

  .list-row {
    grid-template-columns: 46px minmax(0, 1fr) auto;
    gap: 0.85rem;
  }

  .redesigned-list .list-row {
    grid-template-columns: 46px minmax(0, 1fr) auto;
    min-height: auto;
  }

  .list-meta,
  .list-status-cell,
  .list-progress-cell,
  .list-goodreads-cell,
  .list-rating-cell,
  .list-format {
    display: none;
  }

  .list-row {
    padding: 0.6rem 0.75rem;
  }

  .list-actions {
    opacity: 1;
  }
}
</style>
