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

    <div v-else-if="initialized" class="mobile-home">
      <section class="mobile-search-section">
        <label class="mobile-search-bar">
          <i class="ri-search-line"></i>
          <input
            v-model="homeSearch"
            type="search"
            placeholder="Search books"
            autocomplete="off"
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

      <section class="mobile-home-section">
        <h2 class="mobile-section-title">Currently Reading</h2>
        <div v-if="currentReadingBook" class="continue-single">
          <HomeContinueReadingCard
            :book="currentReadingBook"
            :is-playing="isBookPlaying(currentReadingBook)"
            @open="openBook"
            @play="handleContinuePlay"
          />
        </div>
        <EmptyState
          v-else
          title="Your library is clear"
          description="Start building your digital library by uploading your first book."
          image="/Images/Empty-state.png"
        >
          <template #action>
            <NuxtLink to="/books" class="add-btn">
              <i class="ri-add-line"></i>
              Add Book
            </NuxtLink>
          </template>
        </EmptyState>
      </section>

      <section class="mobile-home-section">
        <div class="mobile-section-header">
          <h2 class="mobile-section-title">Recently Added</h2>
          <NuxtLink to="/books" class="mobile-see-all">See all</NuxtLink>
        </div>
        <div v-if="mobileRecentBooks.length > 0" class="book-grid">
          <HomeBookRailCard
            v-for="book in mobileRecentBooks"
            :key="book.id"
            :book="book"
            @open="openBook"
          />
        </div>
      </section>

      <section class="mobile-home-section mobile-series-section">
        <div class="mobile-section-header">
          <h2 class="mobile-section-title">Series</h2>
          <NuxtLink to="/series" class="mobile-see-all">See all</NuxtLink>
        </div>
        <div v-if="mobileSeries.length > 0" class="series-list">
          <SeriesCollageCard
            v-for="series in mobileSeries"
            :key="series.id"
            :series="series"
            @open="openSeries"
          />
        </div>
        <EmptyState
          v-else-if="books.length > 0"
          title="No series yet"
          description="Books with series metadata will appear here."
          image="/Images/Empty-state.png"
        />
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

const currentReadingBook = computed(() => ttsBook.value || recentlyReadBooks.value[0] || null)
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
</style>
