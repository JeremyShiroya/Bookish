<template>
  <div class="playlist-detail-page">
    <div class="playlist-header">
      <button class="back-btn" @click="router.push('/playlists')">
        <i class="ri-arrow-left-line"></i>
        Back
      </button>

      <div class="playlist-heading">
        <h1>{{ playlist?.name || 'Playlist' }}</h1>
        <p>
          {{ playlistBooks.length }} {{ playlistBooks.length === 1 ? 'book' : 'books' }}
          <span v-if="playlist?.description"> &bull; {{ playlist.description }}</span>
        </p>
      </div>

      <div class="view-toggle" aria-label="Playlist view">
        <button
          class="toggle-button"
          :class="{ active: viewMode === 'grid' }"
          title="Grid view"
          @click="viewMode = 'grid'"
        >
          <i class="ri-apps-2-line"></i>
        </button>
        <button
          class="toggle-button"
          :class="{ active: viewMode === 'list' }"
          title="List view"
          @click="viewMode = 'list'"
        >
          <i class="ri-list-unordered"></i>
        </button>
      </div>
    </div>

    <EmptyState
      v-if="!playlistBooks.length"
      title="No books here yet"
      description="Add books to this playlist from the Books page."
      icon="ri-play-list-2-line"
    />

    <div v-else-if="viewMode === 'grid'" class="playlist-grid">
      <article
        v-for="book in playlistBooks"
        :key="book.id"
        class="playlist-book-card"
        @click="router.push(`/reader/${book.id}`)"
      >
        <img :src="resolveBookCover(book)" :alt="book.title" @error="(e) => coverFallback(e, book.title)" />
        <div class="playlist-book-info">
          <h2 :title="book.title">{{ truncateWords(book.title, 7) }}</h2>
          <p>{{ book.author || 'Unknown author' }}</p>
          <div class="playlist-book-meta">
            <span>{{ book.progress || 0 }}%</span>
            <span>{{ formatPersonalRating(book.rating) }}</span>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="playlist-list">
      <article
        v-for="book in playlistBooks"
        :key="book.id"
        class="playlist-list-row"
        @click="router.push(`/reader/${book.id}`)"
      >
        <img :src="resolveBookCover(book)" :alt="book.title" @error="(e) => coverFallback(e, book.title)" />
        <div class="playlist-list-main">
          <h2 :title="book.title">{{ truncateWords(book.title, 10) }}</h2>
          <p>
            {{ book.author || 'Unknown author' }}
            <span v-if="book.publishYear"> &bull; {{ book.publishYear }}</span>
          </p>
        </div>
        <div class="playlist-progress">
          <div>
            <span>{{ book.status || 'Unread' }}</span>
            <strong>{{ book.progress || 0 }}%</strong>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${book.progress || 0}%` }"></div>
          </div>
        </div>
        <div class="playlist-rating">
          <i class="ri-star-fill"></i>
          {{ formatPersonalRating(book.rating) }}
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '~/components/EmptyState.vue'
import { useBooks } from '~/composables/useBooks'

const route = useRoute()
const router = useRouter()
const { books, collections } = useBooks()
const viewMode = ref('grid')

const playlist = computed(() => (
  collections.value.find((item) => String(item.id) === String(route.params.id))
))

const playlistBooks = computed(() => {
  const ids = playlist.value?.bookIds || []
  return ids
    .map((id) => books.value.find((book) => String(book.id) === String(id)))
    .filter(Boolean)
})

const truncateWords = (value, limit = 7) => {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= limit) return words.join(' ')
  return `${words.slice(0, limit).join(' ')}...`
}

const formatPersonalRating = (rating) => {
  const score = Number(rating || 0)
  return score > 0 ? `${score}/10` : '--/10'
}

const generateCoverPlaceholder = (title) => {
  const colors = getThemeCssVars([
    { name: '--color-book-cover-placeholder-one', fallback: '#8A2BE2' },
    { name: '--color-book-cover-placeholder-two', fallback: '#6A0DAD' },
    { name: '--color-book-cover-placeholder-three', fallback: '#9370DB' },
    { name: '--color-book-cover-placeholder-four', fallback: '#BA55D3' },
    { name: '--color-book-cover-placeholder-five', fallback: '#DDA0DD' },
  ])
  const hash = [...String(title || 'Book')].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = String(title || '?').trim()[0]?.toUpperCase() || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="145" font-family="serif" font-size="96" fill="rgba(255,255,255,0.48)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const resolveBookCover = (book) => book.cover || generateCoverPlaceholder(book.title)
const coverFallback = (event, title) => {
  event.target.src = generateCoverPlaceholder(title)
}
</script>

<style scoped>
.playlist-detail-page {
  padding: 0;
}

.playlist-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.back-btn,
.toggle-button {
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-primary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 38px;
  padding: 0 0.85rem;
  border-radius: 8px;
}

.back-btn:hover,
.toggle-button:hover {
  border-color: var(--color-border-focus);
  background: var(--color-surface-active);
  color: var(--color-brand-primary-hover);
}

.playlist-heading h1 {
  margin: 0;
  color: var(--color-brand-primary);
  font-size: 1.5rem;
}

.playlist-heading p {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
}

.view-toggle {
  display: flex;
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  overflow: hidden;
}

.toggle-button {
  width: 42px;
  height: 38px;
  border: none;
  border-radius: 0;
  font-size: 1.1rem;
}

.toggle-button.active {
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 1.25rem;
}

.playlist-book-card {
  height: 205px;
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  background: var(--color-surface-primary);
  cursor: pointer;
  box-shadow: var(--shadow-card-subtle);
  transition: all 0.2s ease;
}

.playlist-book-card:hover,
.playlist-list-row:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-focus);
  background: var(--color-surface-secondary);
}

.playlist-book-card img {
  width: 96px;
  height: 144px;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: var(--shadow-cover);
}

.playlist-book-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.playlist-book-info h2,
.playlist-list-main h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1rem;
  line-height: 1.25;
}

.playlist-book-info p,
.playlist-list-main p {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.playlist-book-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: auto;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.playlist-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.playlist-list-row {
  display: grid;
  grid-template-columns: 54px minmax(200px, 1fr) minmax(160px, 260px) 82px;
  align-items: center;
  gap: 1rem;
  min-height: 92px;
  padding: 0.8rem 1rem;
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  background: var(--color-surface-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.playlist-list-row img {
  width: 54px;
  height: 76px;
  border-radius: 5px;
  object-fit: cover;
  box-shadow: var(--shadow-control-subtle);
}

.playlist-progress div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  margin-bottom: 0.4rem;
}

.playlist-progress strong {
  color: var(--color-text-secondary);
}

.progress-track {
  height: 6px;
  border-radius: 999px;
  background: var(--color-border-subtle);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--gradient-library-progress);
}

.playlist-rating {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.playlist-rating i {
  color: var(--color-status-star);
}

@media (max-width: 760px) {
  .playlist-header,
  .playlist-list-row {
    grid-template-columns: 1fr;
  }

  .view-toggle {
    width: fit-content;
  }
}
</style>
