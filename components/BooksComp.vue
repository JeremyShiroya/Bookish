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
          <button class="add-book-btn" @click="openAddModal">
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
            class="book-card"
            @click="router.push(`/reader/${book.id}`)"
          >
            <div class="book-cover">
              <img :src="book.cover" :alt="book.title" />
              <button class="heart-btn" title="Add to favorites" @click.stop="toggleFavourite(book.id)">
                <i :class="[book.isFavourite ? 'ri-heart-fill' : 'ri-heart-line', { active: book.isFavourite }]"></i>
              </button>
              <button class="play-btn" title="Play" @click.stop>
                <i class="ri-play-fill"></i>
              </button>
            </div>
            <div class="book-info">
              <h3 class="book-title">{{ book.title }}</h3>
              <p class="book-author">{{ book.author }}</p>
            </div>
          </div>
        </div>

        <!-- Table View -->
        <div v-else class="books-table-container">
          <table class="books-table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Author</th>
                <th>Series</th>
                <th>Progress</th>
                <th>Rating</th>
                <th>Format</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="book in filteredBooks" :key="book.id" @click="router.push(`/reader/${book.id}`)">
                <td class="book-cell">
                  <div class="table-book-info">
                    <img :src="book.cover" :alt="book.title" class="table-cover" />
                    <span class="table-title">{{ book.title }}</span>
                  </div>
                </td>
                <td>{{ book.author }}</td>
                <td>{{ book.series || '-' }}</td>
                <td>
                  <div class="table-progress">
                    <div class="progress-bar">
                      <div class="progress-fill" :style="{ width: book.progress + '%' }"></div>
                    </div>
                    <span class="progress-text">{{ book.progress }}%</span>
                  </div>
                </td>
                <td>
                  <div class="table-rating">
                    <i class="ri-star-fill"></i>
                    <span>{{ book.rating }}</span>
                  </div>
                </td>
                <td><span class="format-badge">{{ book.format ? book.format.toUpperCase() : '-' }}</span></td>
                <td>
                  <div class="table-actions" @click.stop>
                    <button class="action-icon" :class="{ active: book.isFavourite }" @click="toggleFavourite(book.id)">
                      <i :class="book.isFavourite ? 'ri-heart-fill' : 'ri-heart-line'"></i>
                    </button>
                    <button class="action-icon" @click="openEditModal(book)">
                      <i class="ri-edit-line"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else
        title="Your library is empty"
        description="Connect your first document to start building your personal book collection."
        icon="ri-book-read-line"
      >
        <template #action>
          <button class="add-book-btn" @click="openAddModal">
            <i class="ri-add-line"></i>
            Add Your First Book
          </button>
        </template>
      </EmptyState>
    </div>

    <!-- Edit Modal -->
    <EditBookModal
      v-if="showEditModal"
      :book="selectedBook"
      @close="closeEditModal"
      @save="saveBook"
    />

    <!-- Add Modal -->
    <AddBookModal
      v-if="showAddModal"
      @close="closeAddModal"
      @add="handleBookAdded"
    />

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
import EditBookModal from "./EditBookModal.vue";
import AddBookModal from "./AddBookModal.vue";
import DeleteConfirmModal from "./DeleteConfirmModal.vue";

import { useBooks } from "~/composables/useBooks";

// Reactive data
import EmptyState from "./EmptyState.vue";

const { books, loading, updateBook, deleteBook: removeBookFromStore, addBook, toggleFavourite, fetchAllData } = useBooks();
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
const showEditModal = ref(false);
const showAddModal = ref(false);
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

const openEditModal = (book) => {
  selectedBook.value = { ...book };
  showEditModal.value = true;
  activeActionsMenu.value = null;
};

const closeEditModal = () => {
  showEditModal.value = false;
  selectedBook.value = null;
};

const saveBook = (updatedBook) => {
  updateBook(updatedBook);
  closeEditModal();
};

const openAddModal = () => {
  showAddModal.value = true;
};

const closeAddModal = () => {
  showAddModal.value = false;
};

const handleBookAdded = async (newBook) => {
  try {
    await addBook(newBook);
  } catch {
    alert('Failed to save the book. Please try again.');
  }
  closeAddModal();
};

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
  font-weight: 600;
  color: #6c97b1;
  margin: 0 0 1.5rem 0;
}

.books-count {
  color: #9ca3af;
  font-weight: normal;
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
  border: 2px solid #e5e7eb;
  border-radius: 2rem;
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
  border-radius: 2rem;
  background: linear-gradient(135deg, #6C97B1 0%, #5a8299 100%);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 10px rgba(108, 151, 177, 0.2);
}

.add-book-btn:hover {
  background: linear-gradient(135deg, #5a8299 0%, #4a6f85 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(108, 151, 177, 0.3);
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
  border-radius: 0.5rem;
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
  font-weight: 600;
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
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.dropdown-option:hover {
  background: #f3f4f6;
}

.dropdown-option.active {
  background: #eff6ff;
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
  border: 2px solid #e5e7eb;
  border-radius: 2rem;
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
  background: #acd3ff;
  color: #233447;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
  justify-content: start;
}

.book-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  width: 200px;
  transition: all 0.3s ease;
}

.book-card:hover {
  transform: translateY(-8px) scale(1.02);
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

/* Icons Styles */
.heart-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.9);
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
  color: #ef4444;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 10;
}

.play-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: #6C97B1; /* App blue */
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
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 10;
}

.play-btn i {
  color: #fff; /* White play icon */
  font-size: 24px;
  margin-left: 2px; /* Optical centering */
}

.book-card:hover .heart-btn,
.book-card:hover .play-btn {
  opacity: 1;
  transform: translateY(0);
}

.heart-btn:hover {
  background: white;
  transform: scale(1.1) !important;
}

.play-btn:hover {
  transform: scale(1.05) translateY(0) !important;
  background: #5a829b; /* Slightly darker on hover */
}

.book-card:hover .book-cover {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
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
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
  line-height: 1.2;
}

.book-author {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
}

.books-table-container {
  overflow-x: auto;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.books-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.books-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

.books-table td {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.book-cell {
  min-width: 250px;
}

.book-info-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.book-thumbnail {
  width: 40px;
  height: 56px;
  object-fit: cover;
  border-radius: 0.25rem;
}

.book-title-table {
  font-weight: 600;
  color: #1f2937;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-bar {
  width: 80px;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #6c97b1;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: #6b7280;
  min-width: 35px;
}

.rating-stars {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.rating-stars i {
  color: #d1d5db;
  font-size: 0.875rem;
}

.rating-stars i.active {
  color: #fbbf24;
}

.rating-num.books-count {
  font-size: 1rem;
  color: #6b7280;
  font-weight: 400;
  margin-left: 0.5rem;
}

.books-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8rem 0;
  gap: 1.5rem;
  color: #6b7280;
}

.loader-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(108, 151, 177, 0.1);
  border-top-color: #6C97B1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.rating-number {
  font-size: 0.75rem;
  color: #6b7280;
  margin-left: 0.25rem;
}

.format-badge {
  background: #eff6ff;
  color: #2563eb;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.actions-dropdown {
  position: relative;
}

.actions-button {
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.actions-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.actions-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  z-index: 50;
  min-width: 120px;
  margin-top: 0.25rem;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.875rem;
}

.action-item:hover {
  background: #f3f4f6;
}

.action-item.delete {
  color: #dc2626;
}

.action-item.delete:hover {
  background: #fef2f2;
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

  .books-table-container {
    font-size: 0.875rem;
  }

  .books-table th,
  .books-table td {
    padding: 0.75rem 0.5rem;
  }
}
</style>
