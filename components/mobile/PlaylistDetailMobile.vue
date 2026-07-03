<template>
  <div class="group-detail-page">
    <MobileSettingsNav :title="playlistNavTitle" back-to="/playlists" aria-label="Playlist navigation" />

    <section v-if="playlist" class="detail-shell">
      <header class="detail-hero">
        <div v-if="previewBooks.length" class="hero-backdrop" aria-hidden="true">
          <img :src="resolveBookCover(previewBooks[0])" alt="" />
        </div>

        <div class="cover-stack" aria-hidden="true">
          <div
            v-for="(book, index) in previewBooks"
            :key="`${book.id || book.title}-${index}`"
            class="cover-item"
            :style="getStackStyle(index, previewBooks.length)"
          >
            <img :src="resolveBookCover(book)" :alt="book.title" @error="(event) => coverFallback(event, book.title)" />
          </div>
          <div v-if="!previewBooks.length" class="empty-cover">
            <i class="ri-play-list-2-line"></i>
          </div>
        </div>

        <div class="detail-copy">
          <p class="hero-eyebrow">Playlist</p>
          <div class="title-row">
            <h1>{{ playlist.name || 'Playlist' }}</h1>
            <button type="button" class="title-action" title="Edit playlist" @click="editingPlaylist = playlist">
              <i class="ri-edit-line"></i>
            </button>
          </div>
          <span class="hero-meta">
            {{ playlistBooks.length }} {{ playlistBooks.length === 1 ? 'book' : 'books' }}<template v-if="playlistBooks.length"> · {{ readCount }} read</template>
          </span>

          <div v-if="playlistBooks.length" class="hero-progress" role="img" :aria-label="`${readPercent}% read`">
            <div class="hero-progress-fill" :style="{ width: `${readPercent}%` }"></div>
          </div>

          <div v-if="playlistBooks.length" class="hero-actions">
            <button type="button" class="hero-play" @click="playPlaylist">
              <i :class="anyBookActive ? 'ri-pause-fill' : 'ri-play-fill'"></i>
              {{ anyBookActive ? 'Pause' : heroPlayLabel }}
            </button>
          </div>
        </div>
      </header>

      <div v-if="playlistBooks.length" class="status-chips" aria-label="Filter by reading status">
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
          @hide="handleHideBook"
          @delete="handleDeleteBook(book)"
        />
      </div>

      <EmptyState
        v-else-if="playlistBooks.length"
        title="No books match this status"
        description="Choose another reading status to see more books."
        icon="ri-filter-3-line"
      />

      <EmptyState
        v-else
        title="No books here yet"
        description="Add books to this playlist from the Books page."
        icon="ri-play-list-2-line"
      />
    </section>

    <EmptyState
      v-else
      title="No books here yet"
      description="Add books to this playlist from the Books page."
      icon="ri-play-list-2-line"
    />

    <PlaylistEditModal
      v-if="editingPlaylist"
      :playlist="editingPlaylist"
      :saving="savingPlaylist"
      @close="editingPlaylist = null"
      @save="savePlaylist"
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
import { useRoute, useRouter } from 'vue-router';
import AddToPlaylistModal from '~/components/shared/AddToPlaylistModal.vue';
import DeleteConfirmModal from '~/components/shared/DeleteConfirmModal.vue';
import EmptyState from '~/components/shared/EmptyState.vue';
import LibraryBookCard from '~/components/shared/LibraryBookCard.vue';
import PlaylistEditModal from '~/components/shared/PlaylistEditModal.vue';
import { useBooks } from '~/composables/useBooks';
import { useToast } from '~/composables/useToast';
import { useTTS } from '~/composables/useTTS';
import MobileSettingsNav from './MobileSettingsNav.vue';

const route = useRoute();
const router = useRouter();
const { books, collections, updatePlaylist, deleteBook, toggleFavourite, hideBook } = useBooks();
const { addToast } = useToast();
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS();
const selectedStatus = ref('all');
const selectedPlaylistBook = ref(null);
const editingPlaylist = ref(null);
const savingPlaylist = ref(false);
const showDeleteModal = ref(false);
const bookToDelete = ref(null);

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'Unread' },
  { label: 'Reading', value: 'Reading' },
  { label: 'Read', value: 'Read' },
];

const playlist = computed(() => (
  collections.value.find((item) => String(item.id) === String(route.params.id))
));

const playlistNavTitle = computed(() => playlist.value?.name || 'Playlist');

const playlistBooks = computed(() => {
  const ids = playlist.value?.bookIds || [];
  return ids
    .map((id) => books.value.find((book) => String(book.id) === String(id)))
    .filter(Boolean);
});

const previewBooks = computed(() => playlistBooks.value.slice(0, 3));

const normalizedStatus = (book) => {
  const status = String(book.status || 'Unread').toLowerCase();
  if (status === 'read' || status === 'completed' || Number(book.progress) >= 100) return 'Read';
  if (status === 'reading') return 'Reading';
  return 'Unread';
};

const filteredBooks = computed(() => (
  selectedStatus.value === 'all'
    ? playlistBooks.value
    : playlistBooks.value.filter(book => normalizedStatus(book) === selectedStatus.value)
));

const isBookActive = (book) => (
  ttsBook.value?.id === book.id && ttsStatus.value !== 'idle'
);

const readCount = computed(() => playlistBooks.value.filter((book) => normalizedStatus(book) === 'Read').length);
const readPercent = computed(() => (
  playlistBooks.value.length
    ? Math.round((readCount.value / playlistBooks.value.length) * 100)
    : 0
));

// Continue with the in-progress book; otherwise start the first unread one.
const nextUpBook = computed(() => (
  playlistBooks.value.find((book) => normalizedStatus(book) === 'Reading')
  || playlistBooks.value.find((book) => normalizedStatus(book) === 'Unread')
  || playlistBooks.value[0]
));

const anyBookActive = computed(() => (
  ttsStatus.value === 'playing' && playlistBooks.value.some((book) => book.id === ttsBook.value?.id)
));

const heroPlayLabel = computed(() => (
  nextUpBook.value && normalizedStatus(nextUpBook.value) === 'Reading' ? 'Continue' : 'Play'
));

const playPlaylist = () => {
  if (anyBookActive.value) {
    toggleTTS();
    return;
  }
  if (ttsBook.value && playlistBooks.value.some((book) => book.id === ttsBook.value?.id) && ttsStatus.value === 'paused') {
    toggleTTS();
    return;
  }
  if (nextUpBook.value) playTTS(nextUpBook.value);
};

const handlePlay = (book) => {
  if (isBookActive(book)) {
    toggleTTS();
    return;
  }
  playTTS(book);
};

const handleHideBook = async (book) => {
  await hideBook(book.id);
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

const savePlaylist = async (updatedPlaylist) => {
  savingPlaylist.value = true;
  try {
    await updatePlaylist(updatedPlaylist);
    addToast('Playlist updated', 'success');
    editingPlaylist.value = null;
  } catch {
    addToast('Could not update playlist', 'error');
  } finally {
    savingPlaylist.value = false;
  }
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
</script>

<style scoped>
.group-detail-page {
  width: 100%;
}

.detail-shell {
  padding: 0 var(--mobile-page-padding-inline) calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
}

.detail-hero {
  position: relative;
  display: grid;
  gap: 0.9rem;
  overflow: hidden;
  margin: 0 calc(-1 * var(--mobile-page-padding-inline)) 1.1rem;
  padding: 1.4rem var(--mobile-page-padding-inline) 1.3rem;
  border-radius: 0 0 24px 24px;
  text-align: center;
}

/* Blurred first-cover backdrop with a readability gradient over it. */
.hero-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(28px) saturate(1.25);
  transform: scale(1.35);
  opacity: 0.55;
}

.hero-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 0%,
    color-mix(in srgb, var(--color-background-app) 55%, transparent) 62%,
    var(--color-background-app) 100%
  );
}

.hero-eyebrow {
  margin: 0 0 0.3rem;
  color: var(--color-brand-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero-meta {
  display: block;
  margin-top: 0.4rem;
  color: var(--color-text-secondary);
  font-size: var(--mobile-subtext-size);
}

.hero-progress {
  width: min(230px, 70%);
  height: 6px;
  margin: 0.75rem auto 0;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-brand-primary) 16%, transparent);
}

.hero-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--color-brand-primary);
  transition: width 0.4s ease;
}

.hero-actions {
  display: flex;
  justify-content: center;
  margin-top: 0.9rem;
}

.hero-play {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 26px;
  border: 0;
  border-radius: 999px;
  background: var(--color-brand-primary);
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 10px 24px rgba(138, 43, 226, 0.35);
}

.hero-play i {
  font-size: 20px;
}

.hero-play:active {
  transform: scale(0.96);
}

.cover-stack {
  position: relative;
  z-index: 1;
  width: 230px;
  height: 152px;
  margin: 0 auto;
}

.cover-item {
  position: absolute;
  top: 0;
  left: 0;
  width: 88px;
  height: 132px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.65);
  border-radius: 8px;
  background: var(--color-surface-muted);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.32);
  transform-origin: center bottom;
}

.cover-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty-cover {
  display: grid;
  width: 86px;
  height: 129px;
  margin: 0 auto;
  place-items: center;
  border: 1px dashed var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-secondary);
  color: var(--color-text-muted);
  font-size: 2rem;
}

.detail-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.detail-copy h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: clamp(1.55rem, 7.5vw, 1.9rem);
  font-weight: 600;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.title-action {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--color-border-subtle);
  border-radius: 9px;
  background: var(--color-surface-secondary);
  color: var(--color-brand-primary);
  cursor: pointer;
  font-size: 1rem;
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
