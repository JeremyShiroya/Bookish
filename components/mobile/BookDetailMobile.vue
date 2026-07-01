<template>
  <div class="book-detail-page">
    <MobileSettingsNav :title="book?.title || 'Book'" back-to="/books" aria-label="Book navigation" />

    <div v-if="loading && !book" class="state-panel">
      <i class="ri-loader-4-line spinner"></i>
    </div>

    <div v-else-if="!book" class="state-panel">
      <i class="ri-book-2-line"></i>
      <p>Book not found</p>
    </div>

    <section v-else class="detail-shell">
      <div class="book-top">
        <div class="cover-frame">
          <img
            :src="coverUrl"
            :alt="book.title"
            class="cover-img"
            @error="handleCoverError"
          />
        </div>

        <div class="book-info">
          <h1 class="book-title">{{ book.title }}</h1>
          <p class="book-author">
            {{ book.author || "Unknown author" }}<span v-if="book.publishYear"> &middot; {{ book.publishYear }}</span>
          </p>
          <p v-if="book.series" class="book-series">
            {{ book.series }}<span v-if="book.seriesInstallment"> #{{ book.seriesInstallment }}</span>
          </p>

          <div v-if="book.genre" class="genre-chip">
            <i class="ri-price-tag-3-line"></i>
            <span>{{ book.genre }}</span>
          </div>

          <div class="progress-row">
            <i class="ri-checkbox-circle-fill"></i>
            <span>{{ progress }}%</span>
          </div>

          <GoodreadsRatingDisplay
            :web-review="book.webReview"
            compact
            class="detail-rating"
          />

          <div class="quick-actions">
            <button
              type="button"
              class="icon-action"
              :class="{ active: book.isFavourite }"
              title="Favourite"
              @click="toggleFavourite(book.id)"
            >
              <i :class="book.isFavourite ? 'ri-heart-fill' : 'ri-heart-line'"></i>
            </button>
            <button type="button" class="icon-action" title="Series" @click="book.series && router.push(`/serie/${encodeURIComponent(book.series)}`)">
              <i class="ri-stack-line"></i>
            </button>
            <button type="button" class="icon-action" title="Edit" @click="router.push(`/edit/${book.id}`)">
              <i class="ri-edit-line"></i>
            </button>
            <button type="button" class="icon-action" title="Library" @click="router.push('/books')">
              <i class="ri-book-shelf-line"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="book-actions">
        <button type="button" class="read-btn" @click="router.push(`/reader/${book.id}`)">
          <i class="ri-book-open-line"></i>
          Read
        </button>
        <button type="button" class="listen-btn" @click="handleListen">
          <i :class="isListening ? 'ri-pause-fill' : 'ri-headphone-line'"></i>
          {{ listenLabel }}
        </button>
      </div>

      <section class="synopsis-section">
        <h2>Synopsis</h2>
        <p>{{ book.blurb || "No description available for this book." }}</p>
      </section>
    </section>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import { useTTS } from "~/composables/useTTS";
import GoodreadsRatingDisplay from "~/components/shared/GoodreadsRatingDisplay.vue";
import MobileSettingsNav from "./MobileSettingsNav.vue";

const route = useRoute();
const router = useRouter();
const { books, loading, toggleFavourite } = useBooks();
const { play: playTTS, togglePlay: toggleTTS, ttsBook, ttsStatus } = useTTS();

const book = computed(() => books.value.find((b) => String(b.id) === String(route.params.id)));
const progress = computed(() => Math.max(0, Math.min(100, Math.round(Number(book.value?.progress) || 0))));
const isListening = computed(() => ttsBook.value?.id === book.value?.id && ttsStatus.value === "playing");
const listenLabel = computed(() => (isListening.value ? "Pause" : "Listen"));

const generateCoverPlaceholder = (title) => {
  const colors = ["#8A2BE2", "#6A0DAD", "#2f7d62", "#b45309"];
  const safeTitle = String(title || "Book");
  const hash = [...safeTitle].reduce((total, c) => total + c.charCodeAt(0), 0);
  const color = colors[hash % colors.length];
  const initial = safeTitle.trim()[0]?.toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="145" font-family="serif" font-size="96" fill="rgba(255,255,255,.48)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const coverUrl = computed(() => book.value?.cover || generateCoverPlaceholder(book.value?.title ?? ""));
const handleCoverError = (event) => {
  event.target.src = generateCoverPlaceholder(book.value?.title ?? "");
};

const handleListen = () => {
  if (!book.value) return;
  if (ttsBook.value?.id === book.value.id && ttsStatus.value !== "idle") {
    toggleTTS();
    return;
  }
  playTTS(book.value);
};
</script>

<style scoped>
.book-detail-page {
  width: 100%;
}

.state-panel {
  display: flex;
  min-height: 45vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--color-text-muted);
  font-size: 1rem;
}

.state-panel i {
  color: var(--color-text-subtle);
  font-size: 2.5rem;
}

.spinner {
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.detail-shell {
  padding: 0 var(--mobile-page-padding-inline) calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
}

.book-top {
  display: flex;
  align-items: flex-start;
  gap: 1.1rem;
}

.cover-frame {
  flex: 0 0 auto;
  width: clamp(132px, 40vw, 168px);
  overflow: hidden;
  border-radius: 10px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18);
}

.cover-img {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
}

.book-info {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 0.4rem;
}

.book-title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: clamp(1.4rem, 5.5vw, 1.7rem);
  font-weight: 500;
  line-height: 1.12;
}

.book-author,
.book-series {
  margin: 0;
  line-height: 1.3;
}

.book-author {
  color: var(--color-text-secondary);
  font-size: 0.92rem;
}

.book-series {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.genre-chip {
  display: inline-flex;
  max-width: 100%;
  align-self: flex-start;
  align-items: center;
  gap: 0.32rem;
  margin-top: 0.15rem;
  padding: 0.28rem 0.62rem;
  border: 1px solid var(--color-brand-primary);
  border-radius: 999px;
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary);
  font-size: 0.74rem;
  line-height: 1.1;
}

.genre-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.15rem;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-weight: 600;
}

.progress-row i {
  color: var(--color-brand-primary);
  font-size: 1.05rem;
}

.detail-rating {
  margin-top: 0.1rem;
}

.detail-rating :deep(.goodreads-rating) {
  flex-wrap: wrap;
  row-gap: 0.15rem;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.4rem;
}

.icon-action {
  display: inline-grid;
  width: 38px;
  height: 34px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 1.05rem;
  transition: border-color 0.15s, color 0.15s;
}

.icon-action:hover {
  border-color: var(--color-brand-primary);
  color: var(--color-brand-primary);
}

.icon-action.active {
  border-color: #ef4444;
  color: #ef4444;
}

.book-actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 1.1rem;
}

.read-btn,
.listen-btn {
  display: inline-flex;
  flex: 1 1 0;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0 1rem;
  border-radius: 11px;
  cursor: pointer;
  font-size: 0.98rem;
  font-weight: 500;
}

.read-btn {
  border: none;
  background: var(--color-brand-primary);
  color: #fff;
  box-shadow: 0 6px 16px rgba(138, 43, 226, 0.28);
}

.listen-btn {
  border: 1px solid var(--color-border-card);
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}

.synopsis-section {
  margin-top: 1.6rem;
}

.synopsis-section h2 {
  margin: 0 0 0.6rem;
  color: var(--color-text-primary);
  font-size: 1.25rem;
  font-weight: 500;
}

.synopsis-section p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  line-height: 1.65;
}
</style>
