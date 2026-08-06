<template>
  <div class="home-container">
    <MobileTopNav />

    <div v-if="loading && !initialized" class="home-loading">
      <MobileSkeleton page="home" />
    </div>

    <EmptyState
      v-else-if="error && books.length === 0"
      title="Library could not load"
      :description="error"
      icon="ri-error-warning-line"
    >
      <template #action>
        <button class="add-btn retry-btn" @click="retryLoadLibrary">
          <i class="ri-refresh-line"></i>
          Retry
        </button>
      </template>
    </EmptyState>

    <EmptyState
      v-else-if="initialized && books.length === 0"
      illustration="library"
      title="Welcome to Bookish"
      description="Import your first PDF or EPUB to build your library shelves."
    >
      <template #action>
        <NuxtLink to="/add" class="add-btn">
          <i class="ri-add-line"></i>
          Add Your First Book
        </NuxtLink>
      </template>
    </EmptyState>

    <div v-else-if="initialized" class="mobile-home">
      <section class="mobile-search-section">
        <label class="mobile-search-bar">
          <i class="ri-search-line"></i>
          <input
            :value="homeSearch"
            type="search"
            placeholder="Search books"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="none"
            spellcheck="false"
            @input="homeSearch = $event.target.value"
          />
          <button
            v-if="homeSearch"
            class="mobile-search-clear"
            type="button"
            title="Clear search"
            @click="homeSearch = ''"
          >
            <i class="ri-close-line"></i>
          </button>
        </label>

        <div v-if="homeSearchResults.length > 0" class="mobile-search-results">
          <button
            v-for="book in homeSearchResults"
            :key="book.id"
            class="mobile-search-result"
            type="button"
            @click="openBook(book); homeSearch = ''"
          >
            <img v-if="book.cover" :src="book.cover" :alt="book.title" @error="onCoverError($event, book.title)" />
            <span v-else class="mobile-search-cover-fallback">
              {{ book.title?.charAt(0) || 'B' }}
            </span>
            <span class="mobile-search-result-text">
              <strong>{{ book.title }}</strong>
              <small>{{ book.author || 'Unknown author' }}</small>
            </span>
          </button>
        </div>
        <p v-else-if="homeSearch.trim()" class="mobile-search-empty">No books found</p>
      </section>

      <!-- Currently Reading -->
      <section v-if="currentReadingBook" class="mobile-home-section">
        <h2 class="mobile-section-title">Currently Reading</h2>
        <div class="continue-single">
          <HomeContinueReadingCard
            :book="currentReadingBook"
            :is-playing="isBookPlaying(currentReadingBook)"
            @open="openBook"
            @play="handleContinuePlay"
          />
        </div>
      </section>

      <!-- Recently Added -->
      <section v-if="mobileRecentBooks.length > 0" class="mobile-home-section">
        <div class="mobile-section-header">
          <h2 class="mobile-section-title">Recently Added</h2>
          <NuxtLink to="/books" class="mobile-see-all">See all</NuxtLink>
        </div>
        <div class="book-grid">
          <HomeBookRailCard
            v-for="book in mobileRecentBooks"
            :key="book.id"
            :book="book"
            @open="openBook"
          />
        </div>
      </section>

      <!-- Series -->
      <section v-if="mobileSeries.length > 0" class="mobile-home-section mobile-series-section">
        <div class="mobile-section-header">
          <h2 class="mobile-section-title">Series</h2>
          <NuxtLink to="/series" class="mobile-see-all">See all</NuxtLink>
        </div>
        <div class="series-list">
          <SeriesCollageCard
            v-for="series in mobileSeries"
            :key="series.id"
            :series="series"
            @open="openSeries"
          />
        </div>
      </section>
    </div>

    <MobileBottomNav />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBooks } from '~/composables/useBooks'
import { onCoverError } from '~/composables/useCoverFallback'
import { searchLibrary } from '~/composables/useLibrarySearch'
import { useTTS } from '~/composables/useTTS'
import EmptyState from '../shared/EmptyState.vue'
import HomeBookRailCard from '../shared/HomeBookRailCard.vue'
import HomeContinueReadingCard from '../shared/HomeContinueReadingCard.vue'
import SeriesCollageCard from '../shared/SeriesCollageCard.vue'
import MobileBottomNav from './MobileBottomNav.vue'
import MobileSkeleton from './MobileSkeleton.vue'
import MobileTopNav from './MobileTopNav.vue'

const {
  books,
  recentlyReadBooks,
  recentlyAddedBooks,
  seriesList,
  loading,
  initialized,
  error,
  fetchAllData,
} = useBooks()
const { ttsBook, ttsStatus, play: playTTS, togglePlay: toggleTTS } = useTTS()
const router = useRouter()
const homeSearch = ref('')

const isBookPlaying = (book) => (
  !!book && ttsBook.value?.id === book.id && ttsStatus.value === 'playing'
)

// Play icon toggles narration in place; @click.stop keeps the card's own
// click (which opens book detail) from firing.
const handleContinuePlay = (book) => {
  if (!book) return
  if (ttsBook.value?.id === book.id && ttsStatus.value !== 'idle') {
    toggleTTS()
    return
  }
  playTTS(book)
}

const mobileRecentBooks = computed(() => (
  recentlyAddedBooks.value.length > 0
    ? recentlyAddedBooks.value.slice(0, 3)
    : books.value.slice(0, 3)
))

// The book you are READING, not the one you last listened to. `ttsBook` used to
// win unconditionally, which is why the card was really "last narrated" — it
// outranked a book being actively scrolled or swiped through.
//
// recentlyReadBooks already orders by lastReadAt, and every page turn and scroll
// settle now stamps that (see useReadingPosition), so silent reading takes the
// slot. Narration still stamps it too, so a book being listened to naturally
// appears here while it genuinely is the most recent activity.
const currentReadingBook = computed(() => recentlyReadBooks.value[0] || ttsBook.value || null)
const mobileSeries = computed(() => seriesList.value.slice(0, 2));

// Ranked so the very first typed letter already surfaces the right books.
const homeSearchResults = computed(() => searchLibrary(books.value, homeSearch.value))

const openBook = (book) => {
  if (book?.id) router.push(`/book/${book.id}`)
}

const openSeries = (series) => {
  if (series?.id) router.push(`/serie/${series.id}`)
}

const retryLoadLibrary = () => {
  fetchAllData(true)
}
</script>

<style scoped>
.home-container {
  width: 100%;
  margin: 0 auto;
  padding-top: calc(4.85rem + env(safe-area-inset-top));
  padding-bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
}

.home-loading {
  padding: 0.5rem;
}

.mobile-home {
  min-height: calc(100vh - 106px);
  padding: 0 var(--mobile-page-padding-inline) 16px;
}

.mobile-search-section {
  position: relative;
  margin-bottom: 20px;
}

.mobile-search-bar {
  display: flex;
  height: 42px;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 1px solid var(--color-border-card);
  border-radius: var(--mobile-control-radius);
  background: var(--color-surface-input);
  color: var(--color-text-muted);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

.mobile-search-bar i {
  flex: 0 0 auto;
  font-size: 20px;
}

.mobile-search-bar input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-size: var(--mobile-subtext-size);
}

/* type="search" draws its own blue clear button on Blink — two clear icons.
   Hide it; the styled button below is the only affordance. */
.mobile-search-bar input::-webkit-search-cancel-button,
.mobile-search-bar input::-webkit-search-decoration {
  -webkit-appearance: none;
  appearance: none;
}

.mobile-search-clear {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.mobile-search-results {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  z-index: 10;
  display: grid;
  max-height: 60vh;
  overflow-y: auto;
  gap: 4px;
  padding: 8px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: var(--mobile-control-radius);
  background: var(--color-background-app);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
}

.mobile-search-result {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.mobile-search-result img,
.mobile-search-cover-fallback {
  width: 34px;
  height: 48px;
  flex: 0 0 auto;
  border-radius: 5px;
  object-fit: cover;
}

.mobile-search-cover-fallback {
  display: grid;
  place-items: center;
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary);
  font-weight: 600;
}

.mobile-search-result-text {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.mobile-search-result-text strong,
.mobile-search-result-text small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-search-result-text strong {
  color: var(--color-text-primary);
  font-size: var(--mobile-subtext-size);
  font-weight: 500;
}

.mobile-search-result-text small,
.mobile-search-empty {
  color: var(--color-text-muted);
  font-size: var(--mobile-caption-size);
}

.mobile-home-section {
  margin-top: var(--mobile-section-gap);
}

.mobile-search-section + .mobile-home-section {
  margin-top: 0;
}

.mobile-section-title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--mobile-section-title-size);
  line-height: 1.25;
}

.mobile-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.mobile-home-section > .mobile-section-title {
  margin-bottom: 10px;
}

.mobile-see-all {
  color: var(--color-brand-primary);
  text-decoration: none;
  font-size: var(--mobile-subtext-size);
  line-height: 1;
}

.continue-single {
  width: 100%;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.series-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: 0;
  border-radius: var(--mobile-control-radius);
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
  font-family: inherit;
  font-size: var(--mobile-subtext-size);
  font-weight: 400;
  text-decoration: none;
  cursor: pointer;
}

/* ── Currently Reading empty state ── */
.empty-reading-card {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 130px;
  overflow: hidden;
  border-radius: var(--mobile-card-radius);
  background: linear-gradient(135deg, #6c3fb5 0%, #8a2be2 40%, #a855f7 100%);
  color: #fff;
}

.empty-reading-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px;
  flex: 1;
  min-width: 0;
}

.empty-reading-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.25;
  color: #fff;
}

.empty-reading-sub {
  margin: 0 0 8px;
  font-size: var(--mobile-caption-size, 0.8125rem);
  opacity: 0.85;
  color: rgba(255, 255, 255, 0.85);
}

.empty-reading-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 8px 16px;
  border: 0;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-family: inherit;
  font-size: var(--mobile-caption-size, 0.8125rem);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: background 0.2s;
}

.empty-reading-btn:active {
  background: rgba(0, 0, 0, 0.4);
}

.empty-reading-btn i {
  font-size: 14px;
}

.empty-reading-arc {
  position: absolute;
  right: -20px;
  bottom: -20px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

.empty-reading-illustration {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 140px;
  height: 140px;
  object-fit: contain;
  pointer-events: none;
  z-index: 1;
}

/* ── Recently Added empty state ── */
.empty-recently-card {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 180px;
  padding: 0 20px;
  border-radius: var(--mobile-card-radius);
  background: #e8e8f1;
}

:root[data-theme="dark"] .empty-recently-card {
  background: var(--color-surface-primary);
}

.empty-recently-illustration {
  width: 180px;
  height: auto;
  flex: 0 0 auto;
  object-fit: contain;
}

.empty-recently-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.empty-recently-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text-primary);
}

.empty-recently-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 8px 16px;
  border: 0;
  border-radius: 8px;
  background: var(--color-text-primary, #1e293b);
  color: var(--color-text-on-brand, #fff);
  font-family: inherit;
  font-size: var(--mobile-caption-size, 0.8125rem);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.empty-recently-btn:active {
  opacity: 0.8;
}

.empty-recently-btn i {
  font-size: 14px;
}

/* ── Series empty state ── */
.empty-series-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 214px;
  padding: 20px;
  border-radius: var(--mobile-card-radius);
  background: #e8e8f1;
  text-align: center;
}

:root[data-theme="dark"] .empty-series-card {
  background: var(--color-surface-primary);
}

.empty-series-illustration {
  width: 180px;
  height: auto;
  margin-bottom: 12px;
  object-fit: contain;
}

.empty-series-title {
  margin: 0 0 4px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.empty-series-sub {
  margin: 0;
  font-size: var(--mobile-caption-size, 0.8125rem);
  color: var(--color-text-muted);
  line-height: 1.45;
  max-width: 240px;
}
</style>

