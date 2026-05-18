<template>
  <div class="books-container">
    <!-- Header -->
    <div class="books-header">
      <h1 class="books-title">
        Books <span class="books-count">({{ filteredBooks.length }})</span>
      </h1>

      <div class="controls-row">
        <!-- Filters -->
        <div class="filters-container">
          <!-- Sort by Filter -->
          <div class="filter-dropdown" ref="sortDropdown">
            <button class="filter-button" @click="toggleDropdown('sort')">
              Sort by
              <i class="ri-arrow-down-s-line"></i>
            </button>
            <div class="dropdown-menu" v-show="activeDropdown === 'sort'">
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
                    <i
                      class="ri-check-line"
                      v-if="sortDirection === 'desc'"
                    ></i>
                    Z to A
                  </div>
                </template>
                <template v-else-if="sortBy === 'rating'">
                  <div
                    class="dropdown-option"
                    :class="{ active: sortDirection === 'desc' }"
                    @click="setSortDirection('desc')"
                  >
                    <i
                      class="ri-check-line"
                      v-if="sortDirection === 'desc'"
                    ></i>
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
            </div>
          </div>

          <!-- Reading Status Filter -->
          <div class="filter-dropdown" ref="statusDropdown">
            <button class="filter-button" @click="toggleDropdown('status')">
              Reading Status
              <i class="ri-arrow-down-s-line"></i>
            </button>
            <div class="dropdown-menu" v-show="activeDropdown === 'status'">
              <div
                class="dropdown-option"
                :class="{ active: selectedStatus === 'all' }"
                @click="setStatus('all')"
              >
                <i class="ri-check-line" v-if="selectedStatus === 'all'"></i>
                All Status
              </div>
              <div
                class="dropdown-option"
                v-for="status in readingStatuses"
                :key="status"
                :class="{ active: selectedStatus === status }"
                @click="setStatus(status)"
              >
                <i class="ri-check-line" v-if="selectedStatus === status"></i>
                {{ status }}
              </div>
            </div>
          </div>

          <!-- Rating Filter -->
          <div class="filter-dropdown" ref="ratingDropdown">
            <button class="filter-button" @click="toggleDropdown('rating')">
              Rating
              <i class="ri-arrow-down-s-line"></i>
            </button>
            <div class="dropdown-menu" v-show="activeDropdown === 'rating'">
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

          <!-- Add Book Button -->
          <button class="add-book-btn" @click="router.push('/add')">
            <i class="ri-add-line"></i>
            Add Book
          </button>
        </div>

        <!-- View Toggle -->
        <div class="view-toggle">
          <span class="view-label">View</span>
          <div class="toggle-buttons">
            <button
              class="toggle-button"
              :class="{ active: viewMode === 'grid' }"
              @click="setViewMode('grid')"
            >
              <i class="ri-apps-2-line"></i>
            </button>
            <button
              class="toggle-button"
              :class="{ active: viewMode === 'table' }"
              @click="setViewMode('table')"
            >
              <i class="ri-list-unordered"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="books-loading">
      <div class="loader-spinner"></div>
      <p>Loading your books...</p>
    </div>

    <!-- Books Content -->
    <div v-else class="books-content">
      <div v-if="books.length > 0">
        <!-- Grid View -->
        <div v-if="viewMode === 'grid'" class="books-grid">
          <div
            v-for="book in filteredBooks"
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
              <h3 class="book-title">{{ book.title }}</h3>
              <p class="book-author">
                {{ book.author }} 
                <span v-if="book.publishYear">• {{ book.publishYear }}</span>
              </p>
              <p v-if="book.series" class="book-series">{{ book.series }}</p>
              <div v-if="book.genre" class="book-genre-tag" :title="'Genre: ' + book.genre">
                <i class="ri-price-tag-3-line"></i>
                <span>{{ book.genre }}</span>
              </div>
              
              <div class="book-meta">
                <div class="meta-item" title="Goodreads Rating">
                  <svg class="goodreads-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f4f1ea"/><path fill="#382110" d="M13.203 14.341c-2.404 0-3.329-1.22-3.329-3.272c0-2.324 1.21-3.313 3.329-3.313c2.424 0 3.329 1.23 3.329 3.313c0 2.052-.925 3.272-3.329 3.272M13.203 5c-3.134 0-5.46 1.251-5.46 5.424c0 3.518 1.879 5.86 5.46 5.86c1.192 0 2.454-.369 3.329-1.313v1.313c0 2.502-1.128 3.579-3.329 3.579c-2.051 0-3.18-.892-3.344-2.267H7.728c.164 2.462 2.379 4.144 5.475 4.144c4.154 0 5.459-2.195 5.459-5.456V5.215h-2.133v1.1c-.875-.953-2.138-1.315-3.326-1.315z"/></svg>
                  <span>{{ formatWebRating(book.webReview) }}</span>
                </div>
                <div class="meta-item" title="Personal Rating">
                  <i class="ri-star-fill star-icon"></i>
                  <span>{{ book.rating || '—' }}</span>
                </div>
                <div class="meta-item progress-meta" title="Reading Progress">
                  <i class="ri-book-read-line"></i>
                  <span>{{ book.progress }}%</span>
                </div>
              </div>
              
              <div class="book-actions">
                <button class="action-btn" :class="{ active: book.isFavourite }" title="Add to favorites" @click.stop="toggleFavourite(book.id)">
                  <i :class="[book.isFavourite ? 'ri-heart-fill' : 'ri-heart-line']"></i>
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

        <!-- List View -->
        <div v-else class="books-list">
          <div 
            v-for="book in filteredBooks" 
            :key="book.id" 
            class="list-row"
            @click="router.push(`/reader/${book.id}`)"
          >
            <img :src="resolveBookCover(book)" :alt="book.title" class="list-cover" @error="(e) => coverFallback(e, book.title)" />
            
            <div class="list-details">
              <h3 class="list-title">{{ book.title }}</h3>
              <p class="list-author">{{ book.author }}</p>
            </div>

            <div class="list-meta">
              <span class="list-series">{{ book.series || '—' }}</span>
            </div>

            <div class="list-progress-cell">
              <div class="list-progress-bar">
                <div class="list-progress-fill" :style="{ width: book.progress + '%' }"></div>
              </div>
              <span class="list-progress-text">{{ book.progress }}%</span>
            </div>

            <div class="list-rating-cell">
              <i class="ri-star-fill list-star"></i>
              <span>{{ book.rating || '—' }}</span>
            </div>

            <span class="list-format">{{ book.format ? book.format.toUpperCase() : '—' }}</span>

            <div class="list-actions" @click.stop>
              <button class="list-action-btn" :class="{ active: book.isFavourite }" title="Favourite" @click="toggleFavourite(book.id)">
                <i :class="book.isFavourite ? 'ri-heart-fill' : 'ri-heart-line'"></i>
              </button>
              <button class="list-action-btn" title="Edit" @click="router.push(`/edit/${book.id}`)">
                <i class="ri-edit-line"></i>
              </button>
              <button class="list-action-btn delete" title="Delete" @click="openDeleteModal(book)">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else
        title="Your library is empty"
        description="Connect your first document to start building your personal book collection."
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
import { ref, computed, onMounted, onUnmounted } from "vue";
import DeleteConfirmModal from "./DeleteConfirmModal.vue";

import { useBooks } from "~/composables/useBooks";
import { useTTS } from "~/composables/useTTS";

// Reactive data
import EmptyState from "./EmptyState.vue";

const { books, loading, updateBook, deleteBook: removeBookFromStore, addBook, toggleFavourite, fetchAllData } = useBooks();
const { play: playTTS, ttsBook, ttsStatus } = useTTS()

const isBookActive = (book) =>
  ttsBook.value?.id === book.id && ttsStatus.value !== 'idle'

const handlePlay = (book) => {
  playTTS(book)
}

const router = useRouter();

// Filter options
const readingStatuses = ["Unread", "Reading", "Completed"];

// Filter states
const sortBy = ref("name");
const sortDirection = ref("asc");
const selectedStatus = ref("all");
const selectedRating = ref("all");
const viewMode = ref("grid");

// Dropdown states
const activeDropdown = ref(null);
const activeActionsMenu = ref(null);

// Modal states
const showDeleteModal = ref(false);
const selectedBook = ref(null);

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
      comparison = a.rating - b.rating;
    }
    return sortDirection.value === "asc" ? comparison : -comparison;
  });

  return filtered;
});

// Methods
const toggleDropdown = (dropdown) => {
  activeDropdown.value = activeDropdown.value === dropdown ? null : dropdown;
};

const toggleActionsMenu = (bookId) => {
  activeActionsMenu.value = activeActionsMenu.value === bookId ? null : bookId;
};

const setSortBy = (value) => {
  sortBy.value = value;
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
};





const formatWebRating = (webReview) => {
  if (!webReview) return '—';
  const match = webReview.match(/Rating:\s*([\d.]+)/);
  return match ? match[1] : '—';
};



const resolveBookCover = (book) => {
  if (!book.cover) {
    return generateCoverPlaceholder(book.title)
  }
  return book.cover
}

const generateCoverPlaceholder = (title) => {
  const colors = ['#8A2BE2', '#6A0DAD', '#9370DB', '#BA55D3', '#DDA0DD']
  const hash = [...title].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = title.trim()[0]?.toUpperCase() || '?'
  const displayTitle = title.length > 18 ? title.substring(0, 18) + '…' : title
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="130" font-family="serif" font-size="100" fill="rgba(255,255,255,0.25)" text-anchor="middle" dominant-baseline="middle">${initial}</text><text x="100" y="230" font-family="sans-serif" font-size="11" fill="rgba(255,255,255,0.65)" text-anchor="middle">${displayTitle}</text></svg>`
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

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
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

.books-title {
  font-size: 1.5rem;
  font-weight: 400;;
  color: #000;
  margin: 0 0 1.5rem 0;
}

.books-count {
  color: #999;
  font-weight: 400;;
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
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  color: #6b7280;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-button:hover {
  border-color: #76aeef;
  background: #f9fafb;
}

.add-book-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #8A2BE2 0%, #6A0DAD 100%);
  color: white;
  font-size: 0.875rem;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 10px rgba(138, 43, 226, 0.2);
}

.add-book-btn:hover {
  background: linear-gradient(135deg, #6A0DAD 0%, #4a6f85 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(138, 43, 226, 0.3);
}

.add-book-btn i {
  font-size: 1.125rem;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
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
  color: #6b7280;
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
  background: #f3f4f6;
}

.dropdown-option.active {
  background: #F8F8FF;
  color: #2563eb;
}

.dropdown-option i {
  width: 1rem;
  font-size: 0.875rem;
}

.dropdown-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 0.5rem 0;
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.view-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.toggle-buttons {
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  overflow: hidden;
}

.toggle-button {
  padding: 0.5rem 1rem;
  border: none;
  background: white;
  color: #6b7280;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-button:hover {
  background: #f3f4f6;
}

.toggle-button.active {
  background: #E6E6FA;
  color: #233447;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
  justify-content: start;
}

.book-card.horizontal {
  display: flex;
  flex-direction: row;
  gap: 1.25rem;
  background: transparent;
  border-radius: 16px;
  padding: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  width: 100%;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
  color: white;
  z-index: 1;
}

.book-card.horizontal:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
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
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.5) 100%);
}

.book-cover {
  width: 110px;
  aspect-ratio: 2/3;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  transition: all 0.3s ease;
  position: relative;
}

.book-card.horizontal:hover .book-cover {
  box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.2);
}

/* Overlay & Icons Styles */
.cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.1) 50%, rgba(15, 23, 42, 0.8) 100%);
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
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.3);
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
  color: #fff;
  font-size: 20px;
  margin-left: 2px; /* Optical centering */
}

.play-btn:hover {
  transform: scale(1.1);
  background: #8A2BE2;
  border-color: #8A2BE2;
}

.play-btn.active {
  background: #8A2BE2;
  border-color: #8A2BE2;
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
  padding: 0.25rem 0;
}

.book-title {
  font-size: 1.15rem;
  font-weight: 500;
  color: #ffffff;
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.book-author {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-series {
  font-size: 0.8rem;
  color: #E6E6FA;
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-genre-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.1);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.75rem;
  width: fit-content;
}

.book-meta {
  display: flex;
  gap: 1rem;
  margin-top: auto;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.9);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.meta-item i {
  color: rgba(255, 255, 255, 0.6);
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
  color: #fbbf24;
}

.progress-meta i {
  color: #E6E6FA;
}

.book-actions {
  display: flex;
  gap: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 0.75rem;
}

.action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.4);
}

.action-btn i.active,
.action-btn i.ri-heart-fill {
  color: #ef4444;
}

.action-btn:hover i.active {
  color: #dc2626;
}

.action-btn.delete:hover {
  background: #fef2f2;
  color: #ef4444;
  border-color: #fecaca;
}

.books-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 0.75rem 1rem;
  background: #fafafa;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.list-row:hover {
  background: #f0f4f8;
  transform: translateX(4px);
}

.list-cover {
  width: 42px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.list-details {
  flex: 2;
  min-width: 0;
}

.list-title {
  font-size: 0.9rem;
  font-weight: 400;
  color: #1f2937;
  margin: 0 0 0.15rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-author {
  font-size: 0.78rem;
  color: #9ca3af;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-meta {
  flex: 1;
  min-width: 0;
}

.list-series {
  font-size: 0.8rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-progress-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 120px;
  flex-shrink: 0;
}

.list-progress-bar {
  flex: 1;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.list-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8A2BE2, #B19CD9);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.list-progress-text {
  font-size: 0.75rem;
  color: #6b7280;
  min-width: 32px;
  text-align: right;
}

.list-rating-cell {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  width: 50px;
  flex-shrink: 0;
  font-size: 0.85rem;
  color: #374151;
}

.list-star {
  color: #fbbf24;
  font-size: 0.9rem;
}

.list-format {
  font-size: 0.7rem;
  font-weight: 400;
  color: #8A2BE2;
  background: rgba(138, 43, 226, 0.1);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  width: 50px;
  text-align: center;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.list-actions {
  display: flex;
  gap: 0.15rem;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.list-row:hover .list-actions {
  opacity: 1;
}

.list-action-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-action-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.list-action-btn.active {
  color: #ef4444;
}

.list-action-btn.delete:hover {
  background: #fef2f2;
  color: #dc2626;
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
    grid-template-columns: repeat(auto-fill, 160px);
    justify-content: center;
  }

  .list-meta,
  .list-progress-cell,
  .list-rating-cell,
  .list-format {
    display: none;
  }

  .list-row {
    gap: 1rem;
    padding: 0.6rem 0.75rem;
  }

  .list-actions {
    opacity: 1;
  }
}
</style>
