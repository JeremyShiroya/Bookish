<template>
  <div class="group-detail-page">
    <MobileSettingsNav :title="seriesNavTitle" back-to="/series" aria-label="Series navigation" />

    <section v-if="seriesBooks.length" class="detail-shell">
      <header class="detail-hero">
        <div class="cover-stack" aria-hidden="true">
          <div
            v-for="(book, index) in previewBooks"
            :key="`${book.id || book.title}-${index}`"
            class="cover-item"
            :style="getStackStyle(index, previewBooks.length)"
          >
            <img :src="resolveBookCover(book)" :alt="book.title" @error="(event) => coverFallback(event, book.title)" />
          </div>
        </div>

        <div class="detail-copy">
          <p>Your series</p>
          <h1>{{ series?.name || seriesName }}</h1>
          <span>{{ seriesCountLabel }}</span>
        </div>
      </header>

      <div class="status-chips" aria-label="Filter by reading status">
        <button
          v-for="status in statusOptions"
          :key="status.value"
          type="button"
          class="status-chip"
          :class="{ active: selectedStatus === status.value }"
          @click="selectedStatus = status.value"
        >
          {{ status.label }}
        </button>
      </div>

      <div v-if="filteredBooks.length" class="book-list">
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

      <EmptyState
        v-else
        title="No books match this status"
        description="Choose another reading status to see more books."
        icon="ri-filter-3-line"
      />
    </section>

    <EmptyState
      v-else
      title="Series not found"
      description="Books with matching series metadata will appear here."
      icon="ri-book-shelf-line"
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
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AddToPlaylistModal from '~/components/shared/AddToPlaylistModal.vue';
import DeleteConfirmModal from '~/components/shared/DeleteConfirmModal.vue';
import EmptyState from '~/components/shared/EmptyState.vue';
import LibraryBookCard from '~/components/shared/LibraryBookCard.vue';
import { fetchBookMetadataResults } from '~/composables/useBookMetadataSearch';
import { useBooks } from '~/composables/useBooks';
import { ensureSeriesTotal, formatSeriesCollectionProgress } from '~/composables/useSeriesProgress';
import { useTTS } from '~/composables/useTTS';
import MobileSettingsNav from './MobileSettingsNav.vue';

const route = useRoute();
const router = useRouter();
const { seriesList, updateBook, deleteBook, toggleFavourite } = useBooks();
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS();
const selectedStatus = ref('all');
const selectedPlaylistBook = ref(null);
const showDeleteModal = ref(false);
const bookToDelete = ref(null);
const seriesTotalRefreshKey = ref('');

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'Unread' },
  { label: 'Reading', value: 'Reading' },
  { label: 'Read', value: 'Read' },
];

const seriesName = computed(() => {
  try {
    return decodeURIComponent(String(route.params.id || 'Series'));
  } catch {
    return String(route.params.id || 'Series');
  }
});

const series = computed(() => (
  seriesList.value.find((item) => String(item.id) === String(route.params.id))
    || seriesList.value.find((item) => item.name === seriesName.value)
    || null
));

const seriesNavTitle = computed(() => series.value?.name || seriesName.value || 'Series');

const seriesBooks = computed(() => (
  [...(series.value?.books || [])]
    .sort((a, b) => {
      const aOrder = Number(a.seriesInstallment);
      const bOrder = Number(b.seriesInstallment);
      if (Number.isFinite(aOrder) && Number.isFinite(bOrder)) return aOrder - bOrder;
      return String(a.title || '').localeCompare(String(b.title || ''));
    })
));

const derivedSeriesTotal = computed(() => {
  const totals = seriesBooks.value
    .map(book => Number(book.seriesTotal || 0))
    .filter(total => total > 0 && Number.isFinite(total));
  return totals.length ? Math.max(...totals) : null;
});

const seriesCountLabel = computed(() => (
  formatSeriesCollectionProgress(seriesBooks.value.length, derivedSeriesTotal.value)
));

const previewBooks = computed(() => seriesBooks.value.slice(0, 3));

const normalizedStatus = (book) => {
  const status = String(book.status || 'Unread').toLowerCase();
  if (status === 'read' || status === 'completed' || Number(book.progress) >= 100) return 'Read';
  if (status === 'reading') return 'Reading';
  return 'Unread';
};

const filteredBooks = computed(() => (
  selectedStatus.value === 'all'
    ? seriesBooks.value
    : seriesBooks.value.filter(book => normalizedStatus(book) === selectedStatus.value)
));

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
  const colors = ['#8A2BE2', '#6A0DAD', '#2f7d62', '#b45309'];
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

const getStackStyle = (index, total = 3) => {
  if (total === 1) return { transform: 'translate(70px, 0) rotate(0deg)', zIndex: 1 };
  if (total === 2) {
    const pairOffsets = [
      { x: 34, y: 10, rotate: -7, z: 1 },
      { x: 108, y: 10, rotate: 7, z: 2 },
    ];
    const pairStyle = pairOffsets[index] || pairOffsets[0];
    return { transform: `translate(${pairStyle.x}px, ${pairStyle.y}px) rotate(${pairStyle.rotate}deg)`, zIndex: pairStyle.z };
  }
  const offsets = [
    { x: 0, y: 16, rotate: -10, z: 1 },
    { x: 70, y: 0, rotate: 1, z: 3 },
    { x: 138, y: 16, rotate: 10, z: 2 },
  ];
  const style = offsets[index] || offsets[0];
  return { transform: `translate(${style.x}px, ${style.y}px) rotate(${style.rotate}deg)`, zIndex: style.z };
};

watch(seriesBooks, async (books) => {
  if (!import.meta.client || !books.length || !seriesName.value) return;
  const refreshKey = [
    seriesName.value,
    ...books.map(book => `${book.id || book.title}:${book.seriesTotal || ''}`),
  ].join('|');
  if (seriesTotalRefreshKey.value === refreshKey) return;
  seriesTotalRefreshKey.value = refreshKey;

  try {
    await ensureSeriesTotal({
      seriesName: seriesName.value,
      books,
      fetchMetadataResults: fetchBookMetadataResults,
      updateBook,
    });
  } catch (error) {
    console.warn('[series detail] Failed to verify series total:', error);
  }
}, { immediate: true });
</script>

<style scoped>
.group-detail-page {
  width: 100%;
}

.detail-shell {
  padding: 0 var(--mobile-page-padding-inline) calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
}

.detail-hero {
  display: grid;
  gap: 0.85rem;
  margin-bottom: 1rem;
  text-align: center;
}

.cover-stack {
  position: relative;
  width: 230px;
  height: 150px;
  margin: 0 auto;
}

.cover-item {
  position: absolute;
  top: 0;
  left: 0;
  width: 86px;
  height: 129px;
  overflow: hidden;
  border-radius: 6px;
  background: var(--color-surface-muted);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.18);
  transform-origin: center bottom;
}

.cover-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-copy {
  min-width: 0;
}

.detail-copy p {
  margin: 0 0 0.2rem;
  color: var(--color-text-secondary);
  font-size: var(--mobile-caption-size);
}

.detail-copy h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: clamp(1.65rem, 8vw, 2rem);
  font-weight: 500;
  line-height: 1.1;
}

.detail-copy span {
  display: block;
  margin-top: 0.35rem;
  color: var(--color-text-muted);
  font-size: var(--mobile-subtext-size);
}

.status-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  margin-bottom: 1rem;
  scrollbar-width: none;
}

.status-chips::-webkit-scrollbar {
  display: none;
}

.status-chip {
  min-height: 34px;
  flex: 0 0 auto;
  padding: 0 12px;
  border: 0;
  border-radius: var(--mobile-control-radius);
  background: rgba(138, 43, 226, 0.1);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--mobile-caption-size);
  line-height: 1;
}

.status-chip.active {
  background: var(--color-brand-primary-soft);
  color: var(--color-brand-primary);
}

.book-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
</style>
