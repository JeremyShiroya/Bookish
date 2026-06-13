<template>
  <article class="library-book-card" @click="emit('open', book)">
    <div class="card-background" :style="{ backgroundImage: `url(${coverUrl})` }"></div>
    <div class="card-overlay"></div>

    <div class="card-cover">
      <img :src="coverUrl" :alt="book.title" @error="handleCoverError" />
      <div class="cover-actions">
        <button
          type="button"
          class="play-button"
          :class="{ active: active }"
          title="Read aloud"
          @click.stop="emit('play', book)"
        >
          <i :class="active ? 'ri-pause-fill' : 'ri-play-fill'"></i>
        </button>
      </div>
    </div>

    <div class="card-info">
      <h3 :title="book.title">{{ truncateWords(book.title, 7) }}</h3>
      <p class="card-author">
        {{ book.author || 'Unknown author' }}
        <span v-if="book.publishYear">&bull; {{ book.publishYear }}</span>
      </p>
      <p class="card-series" :class="{ standalone: !book.series }">
        {{ book.series || 'Standalone' }}
      </p>

      <div v-if="book.genre" class="card-genre" :title="`Genre: ${book.genre}`">
        <i class="ri-price-tag-3-line"></i>
        <span>{{ book.genre }}</span>
      </div>

      <div class="card-progress" title="Reading progress">
        <template v-if="progress >= 100">
          <i class="ri-checkbox-circle-fill complete-icon"></i>
          <span class="complete-text">100%</span>
        </template>
        <template v-else>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
          </div>
          <span>{{ progress }}%</span>
        </template>
      </div>

      <div v-if="getGoodreadsRating(book)" class="goodreads-row" title="Goodreads rating">
        <GoodreadsIcon />
        <GoodreadsRatingDisplay :web-review="book.webReview" compact />
      </div>

      <div class="personal-rating" title="Personal rating">
        <span class="rating-label">Personal Rating</span>
        <i class="ri-star-fill"></i>
        <span>{{ formatPersonalRating(book.rating) }}</span>
      </div>

      <div class="card-actions">
        <button
          type="button"
          class="action-button"
          :class="{ active: book.isFavourite }"
          title="Favourite"
          @click.stop="emit('favourite', book)"
        >
          <i :class="book.isFavourite ? 'ri-heart-fill' : 'ri-heart-line'"></i>
        </button>
        <button type="button" class="action-button" title="Add to playlist" @click.stop="emit('playlist', book)">
          <i class="ri-play-list-2-line"></i>
        </button>
        <button type="button" class="action-button" title="Edit book" @click.stop="emit('edit', book)">
          <i class="ri-edit-line"></i>
        </button>
        <button type="button" class="action-button delete" title="Delete book" @click.stop="emit('delete', book)">
          <i class="ri-delete-bin-line"></i>
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import GoodreadsIcon from './GoodreadsIcon.vue'
import GoodreadsRatingDisplay from './GoodreadsRatingDisplay.vue'
import { getGoodreadsRating } from '~/composables/useGoodreadsRating'

const props = defineProps({
  book: {
    type: Object,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['open', 'play', 'favourite', 'playlist', 'edit', 'delete'])
const progress = computed(() => Math.max(0, Math.min(100, Number(props.book.progress) || 0)))

const generateCoverPlaceholder = (title) => {
  const safeTitle = String(title || 'Book')
  const colors = getThemeCssVars([
    { name: '--color-book-cover-placeholder-one', fallback: '#8A2BE2' },
    { name: '--color-book-cover-placeholder-two', fallback: '#6A0DAD' },
    { name: '--color-book-cover-placeholder-three', fallback: '#9370DB' },
    { name: '--color-book-cover-placeholder-four', fallback: '#BA55D3' },
    { name: '--color-book-cover-placeholder-five', fallback: '#DDA0DD' },
  ])
  const hash = [...safeTitle].reduce((total, character) => total + character.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = safeTitle.trim()[0]?.toUpperCase() || '?'
  const softText = getThemeCssVar('--color-book-cover-placeholder-text-soft', 'rgba(255,255,255,0.25)')
  const strongText = getThemeCssVar('--color-book-cover-placeholder-text-strong', 'rgba(255,255,255,0.65)')
  const displayTitle = safeTitle.length > 18 ? `${safeTitle.substring(0, 18)}...` : safeTitle
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="130" font-family="serif" font-size="100" fill="${softText}" text-anchor="middle" dominant-baseline="middle">${initial}</text><text x="100" y="230" font-family="sans-serif" font-size="11" fill="${strongText}" text-anchor="middle">${displayTitle}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const coverUrl = computed(() => props.book.cover || generateCoverPlaceholder(props.book.title))
const handleCoverError = (event) => {
  event.target.src = generateCoverPlaceholder(props.book.title)
}

const truncateWords = (value, limit) => {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  return words.length > limit ? `${words.slice(0, limit).join(' ')}...` : words.join(' ')
}

const formatPersonalRating = (rating) => {
  const score = Number(rating || 0)
  return score > 0 ? `${score}/10` : '--/10'
}
</script>

<style scoped>
.library-book-card {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  width: 100%;
  min-height: 276px;
  height: 100%;
  overflow: hidden;
  padding: 1.25rem;
  border: 1px solid var(--color-border-on-image);
  border-radius: 16px;
  color: var(--color-text-on-brand);
  cursor: pointer;
  transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.library-book-card:hover {
  z-index: 2;
  transform: translateY(-4px);
  border-color: var(--color-border-on-image-strong);
  box-shadow: var(--shadow-card-hover);
}

.card-background,
.card-overlay {
  position: absolute;
  inset: 0;
  z-index: -2;
}

.card-background {
  inset: -20px;
  background-position: center;
  background-size: cover;
  filter: blur(25px) saturate(150%);
  transform: scale(1.2);
}

.card-overlay {
  z-index: -1;
  background: var(--gradient-image-card-overlay);
}

.card-cover {
  position: relative;
  width: 110px;
  height: 165px;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: var(--shadow-cover);
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.library-book-card:hover .card-cover img {
  transform: scale(1.05);
}

.cover-actions {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  opacity: 0;
  background: var(--gradient-cover-action-overlay);
  transition: opacity 0.2s ease;
}

.library-book-card:hover .cover-actions {
  opacity: 1;
}

.play-button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--color-border-on-image-strong);
  border-radius: 50%;
  background: var(--color-surface-on-image-hover);
  color: var(--color-text-on-brand);
  cursor: pointer;
  font-size: 1.25rem;
}

.play-button.active,
.play-button:hover {
  background: var(--color-brand-primary);
  border-color: var(--color-brand-primary);
}

.card-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  padding: 0.15rem 0;
}

.card-info h3 {
  display: -webkit-box;
  overflow: hidden;
  margin: 0 0 0.25rem;
  color: var(--color-text-on-image-primary);
  font-size: 1.15rem;
  font-weight: 500;
  line-height: 1.22;
  text-shadow: var(--shadow-text-on-image);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card-author,
.card-series {
  overflow: hidden;
  margin: 0 0 0.25rem;
  color: var(--color-text-on-image-secondary);
  font-size: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-series {
  font-size: 0.8rem;
}

.card-series.standalone {
  opacity: 0.8;
}

.card-genre {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  width: fit-content;
  max-width: 100%;
  margin-bottom: 0.45rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: var(--color-border-on-image);
  color: var(--color-text-on-image-muted);
  font-size: 0.7rem;
}

.card-progress {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  margin-bottom: 0.45rem;
  color: var(--color-text-on-image-secondary);
  font-size: 0.78rem;
}

.progress-track {
  flex: 1;
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-border-on-image);
  box-shadow: inset 0 0 0 1px var(--color-border-on-image);
}

.progress-fill {
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
  background: var(--gradient-library-progress);
}

.complete-icon {
  color: var(--color-brand-primary);
  font-size: 1rem;
}

.complete-text {
  color: var(--color-text-on-image-primary);
  font-weight: 600;
}

.goodreads-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  margin: 0.35rem 0 0.45rem;
}

.goodreads-row :deep(.goodreads-rating) {
  color: var(--color-text-on-image-secondary);
  flex-wrap: wrap;
}

.goodreads-row :deep(.goodreads-score) {
  color: var(--color-text-on-image-primary);
}

.goodreads-row :deep(.goodreads-count) {
  color: var(--color-text-on-image-secondary);
}

.personal-rating {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text-on-image-secondary);
  font-size: 0.78rem;
}

.personal-rating i {
  color: var(--color-status-star);
}

.rating-label {
  color: var(--color-text-on-image-muted);
  font-weight: 500;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border-on-image);
}

.action-button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border-on-image);
  border-radius: 8px;
  background: var(--color-border-on-image);
  color: var(--color-text-on-image-secondary);
  cursor: pointer;
}

.action-button:hover {
  border-color: var(--color-border-on-image-strong);
  background: var(--color-surface-on-image-hover);
  color: var(--color-text-on-image-primary);
}

.action-button.active,
.action-button.active i {
  color: var(--color-status-danger-bright);
}

.action-button.delete:hover {
  border-color: var(--color-status-danger-border);
  background: var(--color-status-danger-soft);
  color: var(--color-status-danger);
}

@media (max-width: 560px) {
  .library-book-card {
    gap: 0.9rem;
    padding: 1rem;
  }

  .card-cover {
    width: 90px;
    height: 135px;
  }
}
</style>
