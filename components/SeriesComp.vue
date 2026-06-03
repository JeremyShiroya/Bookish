<template>
  <div class="series-container">
    <div class="series-header">
      <h1 class="series-title">
        Series <span class="series-count">({{ seriesList.length }})</span>
      </h1>
    </div>

    <section v-if="selectedSeries" class="series-detail">
      <div class="detail-header">
        <button type="button" class="back-btn" @click="selectedSeriesName = ''">
          <i class="ri-arrow-left-line"></i>
          <span>Back</span>
        </button>
        <div>
          <h2>{{ selectedSeries.name }}</h2>
          <p>{{ selectedSeriesBooks.length }} {{ selectedSeriesBooks.length === 1 ? 'book' : 'books' }}</p>
        </div>
      </div>

      <div class="detail-table">
        <div class="data-header">
          <div>Book</div>
          <div>Status</div>
          <div>Progress</div>
          <div>Rating</div>
        </div>
        <button
          v-for="book in selectedSeriesBooks"
          :key="book.id"
          type="button"
          class="data-row"
          @click="router.push(`/reader/${book.id}`)"
        >
          <div class="book-cell">
            <img :src="resolveBookCover(book)" :alt="book.title" @error="(event) => coverFallback(event, book.title)" />
            <div>
              <strong>{{ book.title }}</strong>
              <span>{{ book.author || 'Unknown author' }}</span>
            </div>
          </div>
          <span class="status-pill" :class="statusBadgeClass(book.status)">{{ book.status || 'Unread' }}</span>
          <div class="progress-cell">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: `${book.progress || 0}%` }"></div>
            </div>
            <span>{{ book.progress || 0 }}%</span>
          </div>
          <span>{{ formatRating(book.rating) }}</span>
        </button>
      </div>
    </section>

    <div v-else-if="seriesList.length > 0" class="series-grid">
      <button
        v-for="series in seriesList"
        :key="series.name"
        type="button"
        class="series-card"
        @click="openSeries(series.name)"
      >
        <div class="stacked-covers">
          <!-- Always render 3 layers -->
          <div 
            v-for="i in 3" 
            :key="i"
            class="cover-item"
            :class="{ 'placeholder-cover': i > series.books.length }"
            :style="getStackStyle(i - 1)"
          >
            <!-- Real book cover if available -->
            <img v-if="i <= series.books.length" :src="series.books[i-1].cover" :alt="series.books[i-1].title" />
            <!-- Placeholder content -->
            <div v-else class="placeholder-content">
              <i class="ri-book-line"></i>
            </div>
          </div>
        </div>
        
        <div class="series-info">
          <h3 class="series-name">{{ series.name }}</h3>
          <p class="series-author">by {{ series.author }}</p>
          <div class="series-meta">
            <span class="book-count">
              <i class="ri-book-3-line"></i>
              {{ series.books.length }} books
            </span>
          </div>
        </div>
      </button>
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
import { computed, ref } from "vue";
import { useBooks } from "~/composables/useBooks";
import EmptyState from "./EmptyState.vue";

const { seriesList } = useBooks();
const router = useRouter();
const selectedSeriesName = ref("");

const selectedSeries = computed(() => (
  seriesList.value.find(series => series.name === selectedSeriesName.value) || null
));

const selectedSeriesBooks = computed(() => (
  [...(selectedSeries.value?.books || [])].sort((a, b) => {
    const aOrder = Number(a.seriesInstallment)
    const bOrder = Number(b.seriesInstallment)
    if (Number.isFinite(aOrder) && Number.isFinite(bOrder)) return aOrder - bOrder
    return String(a.title || '').localeCompare(String(b.title || ''))
  })
));

const openSeries = (name) => {
  selectedSeriesName.value = name;
};

const statusBadgeClass = (status) => {
  if (status === 'Reading') return 'status-reading'
  if (status === 'Read' || status === 'Completed') return 'status-read'
  return 'status-unread'
};

const formatRating = (rating) => {
  const score = Number(rating || 0)
  return score > 0 ? `${score}/10` : '--/10'
};

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
};

const resolveBookCover = (book) => book.cover || generateCoverPlaceholder(book.title);
const coverFallback = (event, title) => {
  event.target.src = generateCoverPlaceholder(title);
};

const getStackStyle = (index) => {
  const offsets = [
    { x: 0, y: 0, rotate: 0, z: 3 },
    { x: 12, y: -8, rotate: 4, z: 2 },
    { x: 24, y: -16, rotate: 8, z: 1 }
  ];
  
  const style = offsets[index] || offsets[0];
  
  return {
    transform: `translate(${style.x}px, ${style.y}px) rotate(${style.rotate}deg)`,
    zIndex: style.z
  };
};
</script>

<style scoped>
.series-container {
  padding: 0rem;
  margin: 0 auto;
}

.series-header {
  margin-bottom: 2.5rem;
}

.series-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

.series-count {
  color: var(--color-text-subtle);
  font-weight: normal;
  font-size: 1.25rem;
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  justify-content: start;
}

.series-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  text-decoration: none;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  font: inherit;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.series-card:hover {
  transform: translateY(-8px);
}

.stacked-covers {
  position: relative;
  width: 168px;
  height: 240px;
  margin-bottom: 1.5rem;
  margin-left: 10px;
}

.cover-item {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: var(--shadow-card-hover);
  background: var(--color-surface-muted);
  transition: all 0.4s ease;
}

.series-card:hover .cover-item:nth-child(2) {
  transform: translate(25px, -15px) rotate(8deg) !important;
}

.series-card:hover .cover-item:nth-child(3) {
  transform: translate(50px, -30px) rotate(16deg) !important;
}

.cover-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.placeholder-cover {
  background: var(--color-surface-secondary);
  border: 2px dashed var(--color-border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
}

.placeholder-content {
  color: var(--color-text-subtle);
  font-size: 2.5rem;
  opacity: 0.5;
}

.series-info {
  margin-top: 0.5rem;
}

.series-name {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-secondary);
  margin: 0 0 0.25rem 0;
}

.series-card:hover .series-name {
  color: var(--color-brand-primary);
}

.series-author {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 1rem 0;
}

.series-meta {
  display: flex;
}

.book-count {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  background: var(--color-surface-active);
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
  border-radius: 0.5rem;
  font-weight: 400;
  text-decoration: none;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px var(--shadow-brand-glow);
}

.series-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.detail-header h2 {
  margin: 0;
  color: var(--color-brand-primary);
  font-size: 1.5rem;
  font-weight: 400;
}

.detail-header p {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}

.back-btn {
  min-height: 38px;
  border: 1px solid var(--color-border-card);
  border-radius: 8px;
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  padding: 0 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
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
  grid-template-columns: minmax(260px, 2fr) 130px minmax(160px, 1fr) 100px;
  gap: 1rem;
  align-items: center;
  width: 100%;
  padding: 0.95rem 1.25rem;
}

.data-header {
  border-bottom: 1px solid var(--color-border-card);
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.data-row {
  border: 0;
  border-bottom: 1px solid var(--color-border-card);
  background: transparent;
  color: var(--color-text-secondary);
  text-align: left;
  cursor: pointer;
}

.data-row:last-child {
  border-bottom: 0;
}

.data-row:hover {
  background: var(--color-surface-hover);
}

.book-cell {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.book-cell img {
  width: 48px;
  height: 70px;
  border-radius: 5px;
  object-fit: cover;
  box-shadow: var(--shadow-control-subtle);
}

.book-cell div {
  min-width: 0;
}

.book-cell strong,
.book-cell span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-cell strong {
  color: var(--color-text-primary);
  font-weight: 500;
}

.book-cell span {
  color: var(--color-text-muted);
  font-size: 0.78rem;
  margin-top: 0.2rem;
}

.status-pill {
  width: fit-content;
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

.progress-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-track {
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

@media (max-width: 760px) {
  .data-header {
    display: none;
  }

  .data-row {
    grid-template-columns: 1fr;
  }
}
</style>
