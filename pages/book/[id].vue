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
      <div class="book-layout desktop-book-layout">
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
              {{ book.author || "Unknown author" }}
              <span v-if="book.publishYear"> &middot; {{ book.publishYear }}</span>
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
            <p>{{ book.blurb || "No description available for this book." }}</p>
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

      <section class="mobile-book-layout">
        <div class="mobile-top">
          <div class="mobile-cover-frame">
            <img
              :src="coverUrl"
              :alt="book.title"
              class="cover-img"
              @error="handleCoverError"
            />
          </div>

          <div class="mobile-info">
            <h1 class="mobile-book-title">{{ book.title }}</h1>
            <p class="mobile-book-author">
              {{ book.author || "Unknown author" }}<span v-if="book.publishYear"> &middot; {{ book.publishYear }}</span>
            </p>
            <p v-if="book.series" class="mobile-book-series">
              {{ book.series }}<span v-if="book.seriesInstallment"> #{{ book.seriesInstallment }}</span>
            </p>

            <div v-if="book.genre" class="mobile-genre-chip">
              <i class="ri-price-tag-3-line"></i>
              <span>{{ book.genre }}</span>
            </div>

            <div class="mobile-progress-row">
              <i class="ri-checkbox-circle-fill"></i>
              <span>{{ progress }}%</span>
            </div>

            <GoodreadsRatingDisplay
              :web-review="book.webReview"
              compact
              class="mobile-detail-rating"
            />

            <div class="mobile-quick-actions">
              <button
                type="button"
                class="mobile-icon-action"
                :class="{ active: book.isFavourite }"
                title="Favourite"
                @click="toggleFavourite(book.id)"
              >
                <i :class="book.isFavourite ? 'ri-heart-fill' : 'ri-heart-line'"></i>
              </button>
              <button type="button" class="mobile-icon-action" title="Series" @click="book.series && router.push(`/serie/${encodeURIComponent(book.series)}`)">
                <i class="ri-stack-line"></i>
              </button>
              <button type="button" class="mobile-icon-action" title="Edit" @click="router.push(`/edit/${book.id}`)">
                <i class="ri-edit-line"></i>
              </button>
              <button type="button" class="mobile-icon-action" title="Library" @click="router.push('/books')">
                <i class="ri-book-shelf-line"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="mobile-book-actions">
          <button type="button" class="mobile-read-btn" @click="router.push(`/reader/${book.id}`)">
            <i class="ri-book-open-line"></i>
            Read
          </button>
          <button type="button" class="mobile-listen-btn" @click="handleListen">
            <i :class="isListening ? 'ri-pause-fill' : 'ri-headphone-line'"></i>
            {{ listenLabel }}
          </button>
        </div>

        <section class="mobile-synopsis-section">
          <h2>Synopsis</h2>
          <p>{{ book.blurb || "No description available for this book." }}</p>
        </section>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import { useTTS } from "~/composables/useTTS";
import GoodreadsRatingDisplay from "~/components/shared/GoodreadsRatingDisplay.vue";

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
  color: var(--color-text-subtle);
  font-size: 2.5rem;
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
  overflow: hidden;
  border-radius: 12px;
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
  color: var(--color-text-primary);
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 600;
  line-height: 1.15;
}

.book-author {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 1rem;
}

.book-series {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
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
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border-card);
}

.book-blurb p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  line-height: 1.7;
}

.book-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.read-btn,
.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.4rem;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
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
  box-shadow: 0 4px 16px rgba(138, 43, 226, 0.35);
  transform: translateY(-1px);
}

.edit-btn {
  border: 1px solid var(--color-border-card);
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}

.edit-btn:hover {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-hover);
  color: var(--color-brand-primary-hover);
  transform: translateY(-1px);
}

.mobile-book-layout {
  display: none;
}

@media (max-width: 768px) {
  .book-detail {
    max-width: none;
  }

  .back-row {
    margin-bottom: 1.25rem;
  }

  .back-btn {
    gap: 0.4rem;
    padding: 0 0.85rem;
    font-size: 0.95rem;
  }

  .back-btn i {
    font-size: 1.2rem;
  }

  .desktop-book-layout {
    display: none;
  }

  .mobile-book-layout {
    display: block;
  }

  .mobile-top {
    display: flex;
    align-items: flex-start;
    gap: 1.1rem;
  }

  .mobile-cover-frame {
    flex: 0 0 auto;
    width: clamp(132px, 40vw, 168px);
    overflow: hidden;
    border-radius: 10px;
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18);
  }

  .mobile-info {
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.4rem;
  }

  .mobile-book-title {
    margin: 0;
    color: var(--color-text-primary);
    font-size: clamp(1.4rem, 5.5vw, 1.7rem);
    font-weight: 500;
    line-height: 1.12;
  }

  .mobile-book-author {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.92rem;
    line-height: 1.3;
  }

  .mobile-book-series {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    line-height: 1.3;
  }

  .mobile-genre-chip {
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

  .mobile-genre-chip span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-progress-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.15rem;
    color: var(--color-text-primary);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .mobile-progress-row i {
    color: var(--color-brand-primary);
    font-size: 1.05rem;
  }

  .mobile-detail-rating {
    margin-top: 0.1rem;
  }

  .mobile-detail-rating :deep(.goodreads-rating) {
    flex-wrap: wrap;
    row-gap: 0.15rem;
  }

  .mobile-quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.4rem;
  }

  .mobile-icon-action {
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

  .mobile-icon-action:hover {
    border-color: var(--color-brand-primary);
    color: var(--color-brand-primary);
  }

  .mobile-icon-action.active {
    border-color: #ef4444;
    color: #ef4444;
  }

  .mobile-book-actions {
    display: flex;
    gap: 0.6rem;
    margin-top: 1.1rem;
  }

  .mobile-read-btn,
  .mobile-listen-btn {
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

  .mobile-read-btn {
    border: none;
    background: var(--color-brand-primary);
    color: #fff;
    box-shadow: 0 6px 16px rgba(138, 43, 226, 0.28);
  }

  .mobile-listen-btn {
    border: 1px solid var(--color-border-card);
    background: var(--color-surface-secondary);
    color: var(--color-text-secondary);
  }

  .mobile-synopsis-section {
    margin-top: 1.6rem;
  }

  .mobile-synopsis-section h2 {
    margin: 0 0 0.6rem;
    color: var(--color-text-primary);
    font-size: 1.25rem;
    font-weight: 500;
  }

  .mobile-synopsis-section p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    line-height: 1.65;
  }
}
</style>
