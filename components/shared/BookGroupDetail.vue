<template>
  <div class="book-group-detail-page">
    <div class="detail-back-row">
      <button type="button" class="back-btn" @click="router.push(backTo)">
        <i class="ri-arrow-left-line"></i>
        <span>Back</span>
      </button>
    </div>

    <div class="detail-hero">
        <div class="detail-cover-stack" aria-hidden="true">
          <div
            v-for="(book, index) in previewBooks"
            :key="`${book.id || book.title}-${index}`"
            class="detail-cover-item"
            :style="getDetailStackStyle(index, previewBooks.length)"
          >
            <img :src="resolveBookCover(book)" :alt="book.title" @error="(event) => coverFallback(event, book.title)" />
          </div>
        </div>
        <div class="detail-copy">
          <p class="detail-kicker">{{ kicker }}</p>
          <div class="detail-title-row">
            <h1>{{ title }}</h1>
            <button
              v-if="titleEditable"
              type="button"
              class="detail-title-action"
              :aria-label="`Edit ${title}`"
              title="Edit playlist"
              @click="$emit('edit-title')"
            >
              <i class="ri-edit-line"></i>
            </button>
          </div>
          <p>
            {{ countLabel || `${books.length} ${books.length === 1 ? 'Book' : 'Books'}` }}
            <span v-if="description"> &bull; {{ description }}</span>
          </p>
        </div>
    </div>

    <div v-if="books.length" class="view-container" :class="{ 'is-card': viewMode === 'table' }">
      <LibraryDisplayControls
        :status="selectedStatus"
        :view="viewMode"
        @update:status="selectedStatus = $event"
        @update:view="setViewMode"
      />

      <div v-if="filteredBooks.length && viewMode === 'grid'" class="detail-books-grid">
        <LibraryBookCard
          v-for="book in filteredBooks"
          :key="book.id"
          :book="book"
          :active="isBookActive(book)"
          @open="router.push(`/book/${book.id}`)"
          @play="handlePlay"
          @favourite="toggleFavourite(book.id)"
          @playlist="selectedPlaylistBook = book"
          @edit="router.push(`/edit/${book.id}`)"
          @delete="handleDeleteBook(book)"
        />
      </div>

      <section v-else-if="filteredBooks.length" class="detail-table" :aria-label="`${title} books`">
        <div class="data-header">
          <div class="col-index">#</div>
          <div class="col-book">Book</div>
          <div class="col-status">Status</div>
          <div class="col-progress">Progress</div>
          <div class="col-personal">Personal Rating</div>
          <div class="col-goodreads">Goodreads Rating</div>
          <div class="col-actions"></div>
        </div>

        <div
          v-for="(book, index) in filteredBooks"
          :key="book.id"
          class="data-row"
          tabindex="0"
          @click="router.push(`/book/${book.id}`)"
          @keydown.enter="router.push(`/book/${book.id}`)"
        >
          <div class="col-index row-index">{{ showInstallment ? (book.seriesInstallment ?? index + 1) : (index + 1) }}</div>
          <div class="col-book book-cell">
            <img :src="resolveBookCover(book)" :alt="book.title" class="cell-cover" @error="(event) => coverFallback(event, book.title)" />
            <div class="cell-book-info">
              <div class="cell-book-title-row">
                <h2 class="cell-book-title" :title="book.title">{{ truncateWords(book.title, 9) }}</h2>
                <span class="cell-format">{{ book.format ? book.format.toUpperCase() : 'BOOK' }}</span>
              </div>
              <p class="cell-book-author">
                {{ book.author || 'Unknown author' }}<span v-if="book.publishYear"> &bull; {{ book.publishYear }}</span>
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
              <span v-else class="rating-empty">--</span>
            </div>
          </div>

          <div class="col-actions" @click.stop>
            <button type="button" class="row-action-btn" :class="{ active: book.isFavourite }" title="Favourite" @click="toggleFavourite(book.id)">
              <i :class="book.isFavourite ? 'ri-heart-fill' : 'ri-heart-line'"></i>
            </button>
            <button type="button" class="row-action-btn muted" title="Add to playlist from Books page">
              <i class="ri-play-list-2-line"></i>
            </button>
            <button type="button" class="row-action-btn" title="Edit" @click="router.push(`/edit/${book.id}`)">
              <i class="ri-edit-line"></i>
            </button>
            <button type="button" class="row-action-btn delete" title="Delete" @click="handleDeleteBook(book)">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
      </section>

      <EmptyState
        v-else
        title="No books match this status"
        description="Choose another reading status to see more books."
        icon="ri-filter-3-line"
      />
    </div>

    <EmptyState
      v-else
      :title="emptyTitle"
      :description="emptyDescription"
      :icon="emptyIcon"
    />

    <AddToPlaylistModal
      v-if="selectedPlaylistBook"
      :book="selectedPlaylistBook"
      @close="selectedPlaylistBook = null"
    />

    <DeleteConfirmModal
      v-if="showDeleteModal && bookToDelete"
      :book="bookToDelete"
      @close="showDeleteModal = false; bookToDelete = null"
      @confirm="confirmDeleteBook"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import AddToPlaylistModal from './AddToPlaylistModal.vue';
import DeleteConfirmModal from './DeleteConfirmModal.vue';
import EmptyState from './EmptyState.vue';
import GoodreadsRatingDisplay from './GoodreadsRatingDisplay.vue';
import LibraryBookCard from './LibraryBookCard.vue';
import LibraryDisplayControls from './LibraryDisplayControls.vue';
import { useBooks } from '~/composables/useBooks';
import { useBookishSettings } from '~/composables/useBookishSettings';
import { getGoodreadsRating, parseGoodreadsReview } from '~/composables/useGoodreadsRating';
import { useTTS } from '~/composables/useTTS';

const props = defineProps({
  backTo: {
    type: String,
    required: true,
  },
  books: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    required: true,
  },
  kicker: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  emptyTitle: {
    type: String,
    default: 'No books found',
  },
  emptyDescription: {
    type: String,
    default: 'Books will appear here when they are available.',
  },
  emptyIcon: {
    type: String,
    default: 'ri-book-open-line',
  },
  showInstallment: {
    type: Boolean,
    default: false,
  },
  countLabel: {
    type: String,
    default: '',
  },
  titleEditable: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['edit-title']);

const router = useRouter();
const { deleteBook, toggleFavourite } = useBooks();
const { settings, updateSettings } = useBookishSettings();
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS();
const selectedStatus = ref('all');
const viewMode = ref(settings.value.groupDetailView);
const selectedPlaylistBook = ref(null);
const showDeleteModal = ref(false);
const bookToDelete = ref(null);

const normalizedStatus = (book) => {
  const status = String(book.status || 'Unread').toLowerCase();
  if (status === 'read' || status === 'completed' || Number(book.progress) >= 100) return 'Read';
  if (status === 'reading') return 'Reading';
  return 'Unread';
};

const filteredBooks = computed(() => (
  selectedStatus.value === 'all'
    ? props.books
    : props.books.filter(book => normalizedStatus(book) === selectedStatus.value)
));

const previewBooks = computed(() => props.books.slice(0, 3));

const setViewMode = (mode) => {
  viewMode.value = mode;
  updateSettings({ groupDetailView: mode });
};

const isBookActive = (book) => (
  ttsBook.value?.id === book.id && ttsStatus.value !== 'idle'
);

const handlePlay = (book) => {
  if (isBookActive(book)) {
    toggleTTS();
    return;
  }
  playTTS(book);
};

const statusBadgeClass = (status) => {
  if (status === 'Reading') return 'status-reading';
  if (status === 'Read' || status === 'Completed') return 'status-read';
  return 'status-unread';
};

const formatPersonalRating = (rating) => {
  const score = Number(rating || 0);
  return score > 0 ? `${score}/10` : '--/10';
};

const goodreadsTooltip = (book) => {
  const info = parseGoodreadsReview(book.webReview);
  const parts = [];
  if (info.ratingsCount) parts.push(`${info.ratingsCount} ratings`);
  if (info.reviewsCount) parts.push(`${info.reviewsCount} reviews`);
  return parts.join(' / ');
};

const truncateWords = (text, maxWords = 9) => {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return String(text || '');
  return `${words.slice(0, maxWords).join(' ')}...`;
};

const handleDeleteBook = (book) => {
  bookToDelete.value = book;
  showDeleteModal.value = true;
};

const confirmDeleteBook = async () => {
  if (bookToDelete.value) await deleteBook(bookToDelete.value.id);
  showDeleteModal.value = false;
  bookToDelete.value = null;
};

const generateCoverPlaceholder = (title) => {
  const colors = getThemeCssVars([
    { name: '--color-book-cover-placeholder-one', fallback: '#8A2BE2' },
    { name: '--color-book-cover-placeholder-two', fallback: '#6A0DAD' },
    { name: '--color-book-cover-placeholder-three', fallback: '#2f7d62' },
    { name: '--color-book-cover-placeholder-four', fallback: '#b45309' },
  ]);
  const safeTitle = String(title || 'Book');
  const hash = [...safeTitle].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = colors[hash % colors.length];
  const initial = safeTitle.trim()[0]?.toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="145" font-family="serif" font-size="96" fill="rgba(255,255,255,0.48)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const resolveBookCover = (book) => book.cover || generateCoverPlaceholder(book.title);
const coverFallback = (event, title) => {
  event.target.src = generateCoverPlaceholder(title);
};

const getDetailStackStyle = (index, total = 3) => {
  if (total === 1) {
    return {
      transform: 'translate(86px, 0) rotate(0deg)',
      zIndex: 1,
    };
  }
  if (total === 2) {
    const pairOffsets = [
      { x: 44, y: 12, rotate: -7, z: 1 },
      { x: 132, y: 12, rotate: 7, z: 2 },
    ];
    const pairStyle = pairOffsets[index] || pairOffsets[0];
    return {
      transform: `translate(${pairStyle.x}px, ${pairStyle.y}px) rotate(${pairStyle.rotate}deg)`,
      zIndex: pairStyle.z,
    };
  }
  const offsets = [
    { x: 0, y: 18, rotate: -10, z: 1 },
    { x: 86, y: 0, rotate: 1, z: 3 },
    { x: 170, y: 18, rotate: 10, z: 2 },
  ];
  const style = offsets[index] || offsets[0];
  return {
    transform: `translate(${style.x}px, ${style.y}px) rotate(${style.rotate}deg)`,
    zIndex: style.z,
  };
};
</script>

<style scoped>
.book-group-detail-page {
  width: 100%;
  min-width: 0;
}

.detail-back-row {
  display: flex;
  align-items: center;
  min-height: 38px;
  margin-bottom: 1.2rem;
}

.back-btn {
  min-height: 38px;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  padding: 0 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
}

.back-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-brand-primary-hover);
}

.detail-hero {
  display: grid;
  grid-template-columns: 285px minmax(0, 1fr);
  gap: 3rem;
  align-items: center;
  min-height: 210px;
  margin-bottom: 1.75rem;
}

.detail-cover-stack {
  position: relative;
  width: 285px;
  height: 190px;
}

.detail-cover-item {
  position: absolute;
  top: 0;
  left: 0;
  width: 104px;
  height: 156px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-surface-muted);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.18);
  transform-origin: center bottom;
}

.detail-cover-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.detail-copy {
  min-width: 0;
}

.detail-title-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.detail-kicker {
  margin: 0 0 0.25rem;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}

.detail-copy h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: clamp(2rem, 4vw, 3.1rem);
  font-weight: 500;
  line-height: 1.05;
}

.detail-title-action {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  background: var(--color-surface-secondary);
  color: var(--color-brand-primary);
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.15s, border-color 0.15s, transform 0.15s;
}

.detail-title-action:hover {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
  transform: translateY(-1px);
}

.detail-copy p:not(.detail-kicker) {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

.detail-table {
  background: var(--color-surface-card);
  overflow: hidden;
}

.view-container {
  width: 100%;
}

.view-container.is-card {
  overflow: hidden;
  border: 1px solid var(--color-border-card);
  border-radius: 14px;
  background: var(--color-surface-card);
}

.data-header,
.data-row {
  display: grid;
  grid-template-columns: 36px minmax(260px, 2.2fr) 130px minmax(160px, 1fr) 120px minmax(160px, 1.1fr) 150px;
  gap: 1rem;
  align-items: center;
  width: 100%;
  padding: 0.95rem 1.25rem;
}

.col-index {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.row-index {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-subtle);
}

.data-header {
  background: transparent;
  border-bottom: 1px solid var(--color-border-card);
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0;
}

.data-row {
  border-bottom: 1px solid var(--color-border-card);
  background: transparent;
  color: var(--color-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.data-row:last-child {
  border-bottom: 0;
}

.data-row:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: -2px;
}

.data-row:hover {
  background: var(--color-table-row-hover);
}

.detail-books-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
  align-items: start;
}

.book-cell {
  display: flex;
  align-items: center;
  gap: 0.85rem;
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
  max-width: 150px;
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

.data-header .col-status,
.data-header .col-progress,
.data-header .col-personal,
.data-header .col-goodreads {
  text-align: center;
}

.col-status,
.col-progress,
.col-personal,
.col-goodreads {
  display: flex;
  justify-content: center;
  min-width: 0;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.25rem 0.8rem;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.status-pill.status-reading {
  background: rgba(245, 158, 11, 0.14);
  color: rgb(180, 83, 9);
}

.status-pill.status-read {
  background: var(--color-surface-hover);
  color: var(--color-brand-primary);
}

.status-pill.status-unread {
  background: rgba(100, 116, 139, 0.14);
  color: rgb(71, 85, 105);
}

.progress-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-bar {
  width: 100px;
  height: 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--gradient-library-progress);
  transition: width 0.3s ease;
}

.progress-text {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  min-width: 34px;
  text-align: right;
}

.progress-complete-icon {
  color: var(--color-brand-primary);
  font-size: 1.1rem;
}

.progress-complete-text {
  color: var(--color-brand-primary);
  font-size: 0.82rem;
  font-weight: 500;
}

.rating-wrap,
.goodreads-wrap {
  display: flex;
  align-items: center;
  min-width: 0;
}

.rating-wrap {
  gap: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.list-star {
  color: #f6a400;
}

.goodreads-wrap {
  position: relative;
}

.data-row .goodreads-wrap :deep(.goodreads-count) {
  display: none;
}

.data-row .goodreads-wrap[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  padding: 0.4rem 0.65rem;
  border-radius: 6px;
  background: var(--color-text-primary);
  color: var(--color-surface-primary);
  box-shadow: var(--shadow-card-hover);
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
}

.data-row .goodreads-wrap[data-tooltip]:hover::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  border: 5px solid transparent;
  border-top-color: var(--color-text-primary);
  pointer-events: none;
}

.rating-empty {
  color: var(--color-text-subtle);
  font-size: 0.85rem;
}

.col-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.15rem;
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
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all 0.15s;
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

.row-action-btn.muted {
  cursor: default;
  opacity: 0.55;
}

.row-action-btn.muted:hover {
  background: transparent;
  color: var(--color-text-subtle);
}

@media (min-width: 761px) and (max-width: 1180px) {
  .detail-books-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
