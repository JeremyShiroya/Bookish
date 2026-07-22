<template>
  <div class="group-detail-page">
    <MobileSettingsNav :title="seriesNavTitle" back-to="/series" aria-label="Series navigation" />

    <section v-if="seriesBooks.length" class="detail-shell">
      <header class="detail-hero">
        <div class="hero-backdrop" aria-hidden="true">
          <img :src="resolveBookCover(seriesBooks[0])" alt="" />
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
        </div>

        <div class="detail-copy">
          <p class="hero-eyebrow">Series</p>
          <h1>{{ series?.name || seriesName }}</h1>
          <span class="hero-meta">{{ seriesCountLabel }} · {{ readCount }} read</span>
        </div>
      </header>

      <LibraryControlsRow
        v-model:status="selectedStatus"
        v-model:view="viewMode"
      />

      <div v-if="seriesEntries.length" :class="viewMode === 'list' ? 'book-list' : 'books-grid'">
        <template v-for="entry in seriesEntries" :key="entry.key">
          <LibraryBookCard
            v-if="entry.kind === 'book'"
            :show-personal-rating="false"
            :book="entry.book"
            :active="isBookActive(entry.book)"
            :class="{ 'mobile-list-book-card': viewMode === 'list' }"
            @open="router.push(`/book/${entry.book.id}`)"
            @play="handlePlay"
            @favourite="toggleFavourite(entry.book.id)"
            @playlist="selectedPlaylistBook = entry.book"
            @edit="router.push(`/edit/${entry.book.id}`)"
            @hide="handleHideBook"
            @delete="handleDeleteBook(entry.book)"
          />

          <!-- An installment the library doesn't have yet. Shows the real cover
               and title once metadata resolves, muted so it reads as a gap on
               the shelf; a numbered placeholder until then. -->
          <article
            v-else
            class="missing-book-card"
            :class="{ 'missing-book-card-list': viewMode === 'list' }"
          >
            <div class="missing-cover">
              <img
                v-if="entry.cover"
                :src="entry.cover"
                :alt="entry.title || `Book ${entry.installment}`"
                loading="lazy"
              />
              <template v-else>
                <i class="ri-add-line" aria-hidden="true"></i>
              </template>
              <span class="missing-number">{{ entry.installment }}</span>
            </div>
            <div class="missing-info">
              <h3>{{ entry.title || `Book ${entry.installment}` }}</h3>
              <p v-if="entry.author">
                {{ entry.author }}<template v-if="entry.year"> • {{ entry.year }}</template>
              </p>
              <p>Not in your library</p>
            </div>
          </article>
        </template>
      </div>

      <EmptyState
        v-else
        title="No books match this filter"
        description="Choose another reading status or format to see more books."
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
import LibraryControlsRow from '~/components/shared/LibraryControlsRow.vue';
import { fetchBookMetadataResults } from '~/composables/useBookMetadataSearch';
import { matchesFormatFilter, useBookishSettings } from '~/composables/useBookishSettings';
import { useBooks } from '~/composables/useBooks';
import { ensureSeriesTotal, formatSeriesCollectionProgress } from '~/composables/useSeriesProgress';
import { useSeriesSuggestions } from '~/composables/useSeriesSuggestions';
import { useTTS } from '~/composables/useTTS';
import MobileSettingsNav from './MobileSettingsNav.vue';

const route = useRoute();
const router = useRouter();
const { seriesList, updateBook, deleteBook, toggleFavourite, hideBook } = useBooks();
const { settings } = useBookishSettings();
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS();
const selectedStatus = ref('all');
const viewMode = ref('grid');
const selectedPlaylistBook = ref(null);
const showDeleteModal = ref(false);
const bookToDelete = ref(null);
const seriesTotalRefreshKey = ref('');

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

const filteredBooks = computed(() => seriesBooks.value.filter(book => (
  matchesFormatFilter(book, settings.value.formatFilter)
  && (selectedStatus.value === 'all' || normalizedStatus(book) === selectedStatus.value)
)));

const isBookActive = (book) => (
  ttsBook.value?.id === book.id && ttsStatus.value !== 'idle'
);

const readCount = computed(() => seriesBooks.value.filter((book) => normalizedStatus(book) === 'Read').length);

// ── Series suggestions (Settings → Preferences) ─────────────────────────────
//
// The hero already counts what you own against the whole series ("2/6 books").
// With suggestions on, the installments behind that gap are shown as cards
// sitting in their real place in the reading order.
//
// A missing book has no file format, so the format filter must NOT hide it —
// filtering by EPUB/PDF still shows the gaps, which is the whole point of
// "which book should I look for". It is only hidden under the "Read" status
// filter, since a book you don't own can't have been read.
const suggestionsEnabled = computed(() => (
  settings.value.seriesSuggestions === true
  && selectedStatus.value !== 'Read'
  && selectedStatus.value !== 'Reading'
));

const missingInstallments = computed(() => {
  if (!suggestionsEnabled.value) return [];
  const total = derivedSeriesTotal.value;
  if (!Number.isSafeInteger(total) || total < 1) return [];

  const owned = new Set(
    seriesBooks.value
      .map((book) => Number(book.seriesInstallment))
      .filter((installment) => Number.isSafeInteger(installment) && installment >= 1),
  );

  const missing = [];
  for (let installment = 1; installment <= total; installment += 1) {
    if (!owned.has(installment)) missing.push(installment);
  }
  return missing;
});

// Cover/title/author/year for missing installments, resolved through the same
// metadata engine as Add/Edit's Fetch Metadata (in light mode) and shared with
// the background sweep — installmentMeta is a live view of the store, so slots
// filled by the sweep appear here without reopening the page.
const { installments: installmentMeta, fetchSeriesInstallments } = useSeriesSuggestions(seriesName);

watch([missingInstallments, seriesBooks], async ([missing, books]) => {
  if (!import.meta.client || !missing.length || !seriesName.value) return;
  try {
    // Passing the missing numbers lets the composable judge whether its cache
    // actually covers them, instead of trusting any non-empty result.
    await fetchSeriesInstallments(seriesName.value, books, missing);
  } catch (error) {
    console.warn('[series detail] Failed to load missing-book metadata:', error);
  }
}, { immediate: true });

// Owned books and missing-installment placeholders as one ordered list. Books
// with no installment number can't be placed against the series, so they sort
// to the end exactly as they already did.
const seriesEntries = computed(() => {
  const entries = filteredBooks.value.map((book) => ({
    key: `book-${book.id}`,
    kind: 'book',
    book,
    order: Number(book.seriesInstallment),
  }));

  for (const installment of missingInstallments.value) {
    const meta = installmentMeta.value[installment];
    entries.push({
      key: `missing-${installment}`,
      kind: 'missing',
      installment,
      order: installment,
      title: meta?.title || null,
      author: meta?.author || null,
      year: meta?.year || null,
      cover: meta?.cover || null,
    });
  }

  return entries.sort((a, b) => (
    (Number.isFinite(a.order) ? a.order : Infinity)
    - (Number.isFinite(b.order) ? b.order : Infinity)
  ));
});

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

/* The blurred cover runs up behind the page nav rather than stopping under it.
   Ending at the nav left a hard horizontal seam across the top of the hero;
   pulling the hero up by the nav's height lets the blur fade through it. */
.detail-hero {
  --detail-nav-height: 70px;
  position: relative;
  display: grid;
  gap: 0.9rem;
  overflow: hidden;
  margin: calc(-1 * var(--detail-nav-height)) calc(-1 * var(--mobile-page-padding-inline)) 1.1rem;
  padding: calc(var(--detail-nav-height) + 1.4rem) var(--mobile-page-padding-inline) 1.3rem;
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

.detail-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.hero-eyebrow {
  margin: 0 0 0.3rem;
  color: var(--color-brand-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.detail-copy h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: clamp(1.55rem, 7.5vw, 1.9rem);
  font-weight: 600;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.hero-meta {
  display: block;
  margin-top: 0.4rem;
  color: var(--color-text-secondary);
  font-size: var(--mobile-subtext-size);
}

/* Books, grid and list, exactly as the Books page renders them. */
.books-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px 14px;
  justify-content: start;
}

.book-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

/* Series suggestions: an installment the library doesn't have yet. Deliberately
   quiet — a dashed, desaturated placeholder that reads as a gap in the shelf
   rather than as another book competing with the real covers. */
.missing-book-card {
  display: grid;
  gap: 8px;
  align-content: start;
  opacity: 0.62;
}

.missing-cover {
  position: relative;
  display: grid;
  overflow: hidden;
  aspect-ratio: 2 / 3;
  place-items: center;
  border: 1.5px dashed color-mix(in srgb, var(--color-text-muted) 55%, transparent);
  border-radius: var(--mobile-card-radius, 20px);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

/* A resolved cover fills the card and drops the dashed placeholder look; the
   whole card stays dimmed so it still reads as "not owned yet". */
.missing-cover:has(img) {
  border-style: solid;
  border-color: transparent;
}

.missing-cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.missing-cover i {
  font-size: 26px;
}

.missing-number {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-background-app) 82%, transparent);
  color: var(--color-text-secondary);
  font-size: var(--mobile-caption-size);
  font-weight: 700;
}

.missing-info h3 {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--mobile-subtext-size);
  font-weight: 600;
  line-height: 1.2;
}

.missing-info p {
  margin: 2px 0 0;
  color: var(--color-text-muted);
  font-size: var(--mobile-caption-size);
}

/* List view puts the placeholder on one row, like the list book cards. */
.missing-book-card-list {
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.missing-book-card-list .missing-cover {
  width: 64px;
}
</style>
