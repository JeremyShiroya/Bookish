<template>
  <div class="book-detail">
    <div class="back-row">
      <button type="button" class="back-btn" @click="router.back()">
        <i class="ri-arrow-left-line"></i>
        <span>Back</span>
      </button>
    </div>

    <div v-if="loading && !book" class="loading-state">
      <i class="ri-loader-4-line spinner"></i>
    </div>

    <div v-else-if="!book" class="not-found">
      <i class="ri-book-2-line"></i>
      <p>Book not found</p>
    </div>

    <template v-else>
      <div class="book-layout">
        <div class="cover-column">
          <div class="cover-frame">
            <img
              :src="coverUrl"
              :alt="book.title"
              class="cover-img"
              @error="handleCoverError"
            />
          </div>
        </div>

        <div class="detail-column">
          <div class="book-header">
            <h1 class="book-title">{{ book.title }}</h1>
            <p class="book-author">
              {{ book.author || 'Unknown author' }}
              <span v-if="book.publishYear"> · {{ book.publishYear }}</span>
            </p>
            <p v-if="book.series" class="book-series">
              {{ book.series }}<span v-if="book.seriesInstallment"> #{{ book.seriesInstallment }}</span>
            </p>
            <div v-if="book.genre" class="genre-chip">
              <i class="ri-price-tag-3-line"></i>
              {{ book.genre }}
            </div>
          </div>

          <div class="book-blurb">
            <p>{{ book.blurb || 'No description available for this book.' }}</p>
          </div>

          <div class="book-actions">
            <button type="button" class="read-btn" @click="router.push(`/reader/${book.id}`)">
              <i class="ri-book-open-line"></i>
              Read
            </button>
            <button type="button" class="edit-btn" @click="router.push(`/edit/${book.id}`)">
              <i class="ri-edit-line"></i>
              Edit
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBooks } from '~/composables/useBooks'

const route = useRoute()
const router = useRouter()
const { books, loading } = useBooks()

const book = computed(() => books.value.find(b => b.id === route.params.id))

const generateCoverPlaceholder = (title) => {
  const colors = ['#8A2BE2', '#6A0DAD', '#2f7d62', '#b45309']
  const safeTitle = String(title || 'Book')
  const hash = [...safeTitle].reduce((total, c) => total + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = safeTitle.trim()[0]?.toUpperCase() || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="145" font-family="serif" font-size="96" fill="rgba(255,255,255,.48)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const coverUrl = computed(() => book.value?.cover || generateCoverPlaceholder(book.value?.title ?? ''))
const handleCoverError = (event) => {
  event.target.src = generateCoverPlaceholder(book.value?.title ?? '')
}
</script>

<style scoped>
.book-detail {
  width: 100%;
  max-width: 900px;
}

.back-row {
  margin-bottom: 1.5rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 38px;
  padding: 0 0.85rem;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.15s, color 0.15s;
}

.back-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-brand-primary-hover);
}

.loading-state,
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  color: var(--color-text-muted);
  font-size: 1rem;
}

.loading-state i,
.not-found i {
  font-size: 2.5rem;
  color: var(--color-text-subtle);
}

.spinner {
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.book-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 2.5rem;
  align-items: start;
}

.cover-frame {
  width: 220px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.2);
}

.cover-img {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
}

.detail-column {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-top: 0.25rem;
}

.book-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.book-title {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.15;
}

.book-author {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.book-series {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.genre-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  width: fit-content;
  margin-top: 0.1rem;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary-hover);
  font-size: 0.78rem;
}

.book-blurb {
  border-top: 1px solid var(--color-border-card);
  padding-top: 1.25rem;
}

.book-blurb p {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.book-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.read-btn,
.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.4rem;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
}

.read-btn {
  border: none;
  background: var(--color-brand-primary);
  color: #fff;
  box-shadow: 0 2px 10px rgba(138, 43, 226, 0.28);
}

.read-btn:hover {
  background: var(--color-brand-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(138, 43, 226, 0.35);
}

.edit-btn {
  border: 1px solid var(--color-border-card);
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}

.edit-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-brand-primary-hover);
  border-color: var(--color-brand-primary);
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .book-layout {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .cover-column {
    display: flex;
    justify-content: center;
  }

  .cover-frame {
    width: 160px;
  }
}
</style>
