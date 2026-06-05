<template>
  <div class="series-container">
    <div class="series-header">
      <h1 class="series-title">Series</h1>
    </div>

    <div v-if="seriesList.length > 0" class="series-grid">
      <div
        v-for="(series, idx) in seriesList"
        :key="series.id"
        class="series-card"
        @click="openSeries(series)"
      >
        <!-- Blurred cover background -->
        <div
          class="card-bg"
          :style="{
            backgroundImage: `url(${resolveBookCover(series.books[0])})`,
          }"
        ></div>
        <div class="card-bg-overlay"></div>

        <!-- Series name — top left -->
        <span class="card-name">{{ series.name }}</span>

        <!-- Up to 2 covers — bottom right, angled -->
        <div class="card-covers">
          <img
            v-if="series.books[1]"
            class="card-cover card-cover--back"
            :src="resolveBookCover(series.books[1])"
            :alt="series.books[1].title"
            @error="(e) => coverFallback(e, series.books[1].title)"
          />
          <img
            v-if="series.books[0]"
            class="card-cover card-cover--front"
            :src="resolveBookCover(series.books[0])"
            :alt="series.books[0].title"
            @error="(e) => coverFallback(e, series.books[0].title)"
          />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="No series detected"
      description="Books that share series metadata will automatically group here."
      icon="ri-book-shelf-line"
    >
      <template #action>
        <NuxtLink to="/books" class="add-btn">
          <i class="ri-add-line"></i>
          Explore Library
        </NuxtLink>
      </template>
    </EmptyState>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import EmptyState from "./EmptyState.vue";

const { seriesList } = useBooks();
const router = useRouter();

const openSeries = (series) => {
  router.push(`/serie/${series.id}`);
};

const generateCoverPlaceholder = (title) => {
  const colors = getThemeCssVars([
    { name: "--color-book-cover-placeholder-one", fallback: "#8A2BE2" },
    { name: "--color-book-cover-placeholder-two", fallback: "#6A0DAD" },
    { name: "--color-book-cover-placeholder-three", fallback: "#2f7d62" },
    { name: "--color-book-cover-placeholder-four", fallback: "#b45309" },
  ]);
  const safeTitle = String(title || "Book");
  const hash = [...safeTitle].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = colors[hash % colors.length];
  const initial = safeTitle.trim()[0]?.toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="145" font-family="serif" font-size="96" fill="rgba(255,255,255,0.48)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const resolveBookCover = (book) =>
  book.cover || generateCoverPlaceholder(book.title);

const coverFallback = (event, title) => {
  event.target.src = generateCoverPlaceholder(title);
};
</script>

<style scoped>
.series-container {
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────────────────── */

.series-header {
  margin-bottom: 1.75rem;
}

.series-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

/* ── Grid ────────────────────────────────────────────────────── */

.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

/* ── Card ────────────────────────────────────────────────────── */

.series-card {
  position: relative;
  aspect-ratio: 3 / 2;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  background: #0f0a1a;
  transition:
    transform 0.2s ease,
    filter 0.2s ease;
  user-select: none;
}

.card-bg {
  position: absolute;
  inset: -20px;
  background-size: cover;
  background-position: center;
  filter: blur(25px) saturate(150%);
  transform: scale(1.2);
  z-index: 0;
}

.card-bg-overlay {
  position: absolute;
  inset: 0;
  background: var(--gradient-image-card-overlay);
  z-index: 1;
}

.series-card:hover {
  transform: scale(1.03);
  filter: brightness(1.08);
}

/* ── Name ────────────────────────────────────────────────────── */

.card-name {
  position: absolute;
  top: 2rem;
  left: 1rem;
  right: 50%;
  z-index: 3;
  font-size: 1.15rem;
  font-weight: 600 !important;
  color: #ffffff;
  line-height: 1.25;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55), 0 1px 2px rgba(0, 0, 0, 0.4);
  word-break: break-word;
  hyphens: auto;
}

/* ── Covers ──────────────────────────────────────────────────── */

.card-covers {
  position: absolute;
  bottom: -8px;
  right: -4px;
  width: 55%;
  height: 95%;
  pointer-events: none;
  z-index: 3;
}

.card-cover {
  position: absolute;
  bottom: 0;
  right: 0;
  height: 90%;
  aspect-ratio: 2 / 3;
  border-radius: 5px;
  object-fit: cover;
  box-shadow: -4px 4px 20px rgba(0, 0, 0, 0.45);
}

.card-cover--front {
  right: 14%;
  transform: rotate(15deg);
  z-index: 2;
}

.card-cover--back {
  right: -2%;
  transform: rotate(28deg);
  z-index: 1;
  opacity: 0.85;
}

/* ── Empty state ─────────────────────────────────────────────── */

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand-button-hover);
}
</style>
