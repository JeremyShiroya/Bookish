<template>
  <div class="detail-page">
    <header class="detail-header">
      <button class="back-btn" @click="router.push('/series')">
        <i class="ri-arrow-left-line"></i>
        <span>Back</span>
      </button>

      <div class="detail-heading">
        <h1>{{ seriesName }}</h1>
        <p>{{ seriesBooks.length }} {{ seriesBooks.length === 1 ? 'book' : 'books' }}</p>
      </div>
    </header>

    <EmptyState
      v-if="!seriesBooks.length"
      title="Series not found"
      description="Books with matching series metadata will appear here."
      icon="ri-book-shelf-line"
    />

    <section v-else class="detail-table" aria-label="Series books">
      <div class="data-header">
        <div class="col-book">Book</div>
        <div class="col-status">Status</div>
        <div class="col-progress">Progress</div>
        <div class="col-rating">Personal Rating</div>
        <div class="col-actions"></div>
      </div>

      <article
        v-for="book in seriesBooks"
        :key="book.id"
        class="data-row"
        @click="router.push(`/reader/${book.id}`)"
      >
        <div class="col-book book-cell">
          <img :src="resolveBookCover(book)" :alt="book.title" class="cell-cover" @error="(e) => coverFallback(e, book.title)" />
          <div class="cell-book-info">
            <div class="cell-title-row">
              <h2 :title="book.title">{{ truncateWords(book.title, 9) }}</h2>
              <span>{{ book.format ? book.format.toUpperCase() : 'BOOK' }}</span>
            </div>
            <p>{{ book.author || 'Unknown author' }}<template v-if="book.publishYear"> &bull; {{ book.publishYear }}</template></p>
            <div class="cell-tags">
              <span v-if="book.genre"><i class="ri-price-tag-3-line"></i>{{ book.genre }}</span>
              <span v-if="book.pages">{{ book.pages }} pages</span>
            </div>
          </div>
        </div>

        <div class="col-status">
          <span class="status-pill" :class="statusBadgeClass(book.status)">{{ book.status || 'Unread' }}</span>
        </div>

        <div class="col-progress">
          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${book.progress || 0}%` }"></div>
            </div>
            <span>{{ book.progress || 0 }}%</span>
          </div>
        </div>

        <div class="col-rating">
          <i class="ri-star-fill"></i>
          <span>{{ formatPersonalRating(book.rating) }}</span>
        </div>

        <div class="col-actions" @click.stop>
          <button class="row-action-btn" title="Read aloud" @click="playTTS(book)">
            <i class="ri-play-fill"></i>
          </button>
          <button class="row-action-btn" title="Open reader" @click="router.push(`/reader/${book.id}`)">
            <i class="ri-book-open-line"></i>
          </button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import EmptyState from '~/components/EmptyState.vue'
import { useBooks } from '~/composables/useBooks'
import { useTTS } from '~/composables/useTTS'

const route = useRoute()
const router = useRouter()
const { books } = useBooks()
const { play: playTTS } = useTTS()

const seriesName = computed(() => {
  try {
    return decodeURIComponent(String(route.params.id || 'Series'))
  } catch {
    return String(route.params.id || 'Series')
  }
})

const seriesBooks = computed(() => (
  books.value
    .filter((book) => String(book.series || '') === seriesName.value)
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
))

const truncateWords = (value, limit = 7) => {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= limit) return words.join(' ')
  return `${words.slice(0, limit).join(' ')}...`
}

const formatPersonalRating = (rating) => {
  const score = Number(rating || 0)
  return score > 0 ? `${score}/10` : '--/10'
}

const statusBadgeClass = (status) => {
  if (status === 'Reading') return 'status-reading'
  if (status === 'Read' || status === 'Completed') return 'status-read'
  return 'status-unread'
}

const generateCoverPlaceholder = (title) => {
  const colors = getThemeCssVars([
    { name: '--color-book-cover-placeholder-one', fallback: '#8A2BE2' },
    { name: '--color-book-cover-placeholder-two', fallback: '#6A0DAD' },
    { name: '--color-book-cover-placeholder-three', fallback: '#2f7d62' },
    { name: '--color-book-cover-placeholder-four', fallback: '#b45309' },
  ])
  const safeTitle = String(title || 'Book')
  const hash = [...safeTitle].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = safeTitle.trim()[0]?.toUpperCase() || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="145" font-family="serif" font-size="96" fill="rgba(255,255,255,0.48)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const resolveBookCover = (book) => book.cover || generateCoverPlaceholder(book.title)
const coverFallback = (event, title) => {
  event.target.src = generateCoverPlaceholder(title)
}
</script>

<style scoped>
.detail-page {
  width: 100%;
  min-width: 0;
}

.detail-header {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.25rem;
}

.back-btn,
.row-action-btn {
  border: 1px solid var(--color-border-card);
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.back-btn {
  min-height: 38px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.85rem;
}

.back-btn:hover,
.row-action-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-brand-primary-hover);
}

.detail-heading h1 {
  margin: 0;
  color: var(--color-brand-primary);
  font-size: 1.5rem;
  font-weight: 400;
}

.detail-heading p {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}

.detail-table {
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-card);
  overflow: hidden;
}

.data-header,
.data-row {
  display: grid;
  grid-template-columns: minmax(260px, 2.2fr) 130px minmax(160px, 1fr) 140px 90px;
  gap: 1rem;
  align-items: center;
  padding: 0.95rem 1.25rem;
}

.data-header {
  border-bottom: 1px solid var(--color-border-card);
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 500;
}

.data-row {
  border-bottom: 1px solid var(--color-border-card);
  cursor: pointer;
  transition: background 0.15s ease;
}

.data-row:last-child {
  border-bottom: none;
}

.data-row:hover {
  background: var(--color-surface-hover);
}

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
  box-shadow: var(--shadow-control-subtle);
  flex-shrink: 0;
}

.cell-book-info {
  min-width: 0;
}

.cell-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.cell-title-row h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 0.95rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-title-row span,
.cell-tags span {
  border: 1px solid var(--color-border-card);
  border-radius: 5px;
  padding: 0.15rem 0.45rem;
  color: var(--color-brand-primary-hover);
  background: var(--color-brand-primary-faint);
  font-size: 0.66rem;
  flex-shrink: 0;
}

.cell-book-info p {
  margin: 0.2rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.cell-tags {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.35rem;
  min-width: 0;
}

.cell-tags span {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  max-width: 160px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  background: transparent;
  color: var(--color-text-secondary);
}

.col-status,
.col-progress,
.col-rating {
  display: flex;
  justify-content: center;
}

.status-pill {
  border-radius: 999px;
  padding: 0.25rem 0.8rem;
  font-size: 0.75rem;
  white-space: nowrap;
}

.status-reading {
  background: rgba(245, 158, 11, 0.14);
  color: rgb(180, 83, 9);
}

.status-read {
  background: var(--color-surface-hover);
  color: var(--color-brand-primary);
}

.status-unread {
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
  background: var(--color-border-subtle);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--gradient-library-progress);
}

.progress-wrap span,
.col-rating {
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}

.col-rating {
  gap: 0.3rem;
}

.col-rating i {
  color: var(--color-status-star);
}

.col-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.2rem;
}

.row-action-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

@media (max-width: 900px) {
  .data-header {
    display: none;
  }

  .data-row,
  .detail-header {
    grid-template-columns: 1fr;
  }

  .col-status,
  .col-progress,
  .col-rating,
  .col-actions {
    justify-content: flex-start;
  }
}
</style>
