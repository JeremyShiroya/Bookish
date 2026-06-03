<template>
  <div class="playlists-container">
    <div class="playlists-header">
      <h1 class="playlists-title">
        Playlists <span class="playlists-count">({{ collections.length }})</span>
      </h1>
    </div>

    <div v-if="playlistsWithBooks.length > 0" class="playlists-grid">
      <div
        v-for="playlist in playlistsWithBooks"
        :key="playlist.id"
        class="playlist-card"
        @click="openPlaylist(playlist)"
      >
        <div class="stacked-covers">
          <div 
            v-for="i in 3" 
            :key="i" 
            class="cover-item"
            :class="{ 'placeholder-cover': i > playlist.previewBooks.length }"
            :style="getStackStyle(i - 1)"
          >
            <img v-if="i <= playlist.previewBooks.length" :src="playlist.previewBooks[i-1].cover" :alt="playlist.previewBooks[i-1].title" />
            <div v-else class="placeholder-content">
              <i class="ri-book-line"></i>
            </div>
          </div>
        </div>
        
        <div class="playlist-info">
          <h3 class="playlist-name">{{ playlist.name }}</h3>
          <p class="playlist-description">{{ playlist.description }}</p>
          <div class="playlist-meta">
            <span class="book-count">
              <i class="ri-book-3-line"></i>
              {{ playlist.bookCount }} books
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="No playlists yet"
      description="Organize your library by creating playlists for favorites, moods, genres, or reading plans."
      icon="ri-play-list-2-line"
    >
      <template #action>
        <button type="button" class="add-btn">
          <i class="ri-add-line"></i>
          Create Playlist
        </button>
      </template>
    </EmptyState>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import EmptyState from "./EmptyState.vue";

const { collections, books } = useBooks();
const router = useRouter();

const openPlaylist = (playlist) => {
  router.push(`/playlist/${playlist.id}`);
};

const playlistsWithBooks = computed(() => {
  return collections.value.map(playlist => {
    const bookIds = playlist.bookIds || []
    const previewBooks = books.value
      .filter(b => bookIds.slice(0, 3).includes(b.id))
      .sort((a, b) => {
          // Keep the order of bookIds if possible for the stack
          return bookIds.indexOf(a.id) - bookIds.indexOf(b.id);
      });
    return {
      ...playlist,
      bookCount: bookIds.length,
      previewBooks
    };
  });
});


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
.playlists-container {
  padding: 0rem;
  margin: 0 auto;
}

.playlists-header {
  margin-bottom: 2.5rem;
}

.playlists-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

.playlists-count {
  color: var(--color-text-subtle);
  font-weight: normal;
  font-size: 1.25rem;
}

.playlists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  justify-content: start;
}

.playlist-card {
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

.playlist-card:hover {
  transform: translateY(-8px);
}

.stacked-covers {
  position: relative;
  width: 175px;
  height: 250px;
  margin-bottom: 1.5rem;
  margin-left: 10px; /* Offset for the stack spread */
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

.playlist-card:hover .cover-item:nth-child(2) {
  transform: translate(25px, -15px) rotate(8deg) !important;
}

.playlist-card:hover .cover-item:nth-child(3) {
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

.playlist-info {
  margin-top: 0.5rem;
}

.playlist-name {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-secondary);
  margin: 0 0 0.5rem 0;
  transition: color 0.3s ease;
}

.playlist-card:hover .playlist-name {
  color: var(--color-brand-primary);
}

.playlist-description {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 1rem 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.playlist-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
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

@media (max-width: 640px) {
  .playlists-grid {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
  
  .stacked-covers {
      margin: 0 auto 1.5rem auto;
  }
  
  .playlist-info {
      text-align: center;
  }
  
  .playlist-meta {
      justify-content: center;
  }
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
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px var(--shadow-brand-glow);
}

.collection-detail {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.detail-back-row {
  display: flex;
  align-items: center;
  min-height: 38px;
}

.detail-hero {
  display: grid;
  grid-template-columns: 285px minmax(0, 1fr);
  gap: 3rem;
  align-items: center;
  min-height: 210px;
  margin-bottom: 1.75rem;
}

.detail-cover-stack {
  position: relative;
  width: 285px;
  height: 190px;
}

.detail-cover-item {
  position: absolute;
  top: 0;
  left: 0;
  width: 104px;
  height: 156px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-surface-muted);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.18);
  transform-origin: center bottom;
}

.detail-cover-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.detail-copy {
  min-width: 0;
}

.detail-kicker {
  margin: 0 0 0.25rem;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}

.detail-copy h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: clamp(2rem, 4vw, 3.1rem);
  font-weight: 500;
  line-height: 1.05;
}

.detail-copy p:not(.detail-kicker) {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
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
  grid-template-columns: minmax(260px, 2.2fr) 130px minmax(160px, 1fr) 120px minmax(160px, 1.1fr) 150px;
  gap: 1rem;
  align-items: center;
  width: 100%;
  padding: 0.95rem 1.25rem;
}

.data-header {
  background: transparent;
  border-bottom: 1px solid var(--color-border-card);
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0;
}

.data-row {
  border-bottom: 1px solid var(--color-border-card);
  background: transparent;
  color: var(--color-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.data-row:last-child {
  border-bottom: 0;
}

.data-row:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: -2px;
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

.cell-cover {
  width: 48px;
  height: 70px;
  border-radius: 5px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: var(--shadow-control-subtle);
}

.cell-book-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.cell-book-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.cell-book-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-format {
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--color-brand-primary);
  background: var(--color-brand-primary-faint);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.cell-book-author {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-book-tags {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.3rem;
  min-width: 0;
}

.cell-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  max-width: 150px;
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
  background: transparent;
  border: 1px solid var(--color-border-card);
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-chip.standalone {
  color: var(--color-text-muted);
}

.cell-chip.genre {
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary-hover);
  border-color: transparent;
}

.data-header .col-status,
.data-header .col-progress,
.data-header .col-personal,
.data-header .col-goodreads {
  text-align: center;
}

.col-status,
.col-progress,
.col-personal,
.col-goodreads {
  display: flex;
  justify-content: center;
  min-width: 0;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.25rem 0.8rem;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.status-pill.status-reading {
  background: rgba(245, 158, 11, 0.14);
  color: rgb(180, 83, 9);
}

.status-pill.status-read {
  background: var(--color-surface-hover);
  color: var(--color-brand-primary);
}

.status-pill.status-unread {
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
  background: rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--gradient-library-progress);
  transition: width 0.3s ease;
}

.progress-text {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  min-width: 34px;
  text-align: right;
}

.progress-complete-icon {
  color: var(--color-brand-primary);
  font-size: 1.1rem;
}

.progress-complete-text {
  color: var(--color-brand-primary);
  font-size: 0.82rem;
  font-weight: 500;
}

.rating-wrap,
.goodreads-wrap {
  display: flex;
  align-items: center;
  min-width: 0;
}

.rating-wrap {
  gap: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.list-star {
  color: #f6a400;
}

.goodreads-wrap {
  position: relative;
}

.data-row .goodreads-wrap :deep(.goodreads-count) {
  display: none;
}

.data-row .goodreads-wrap[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  padding: 0.4rem 0.65rem;
  border-radius: 6px;
  background: var(--color-text-primary);
  color: var(--color-surface-primary);
  box-shadow: var(--shadow-card-hover);
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
}

.data-row .goodreads-wrap[data-tooltip]:hover::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  border: 5px solid transparent;
  border-top-color: var(--color-text-primary);
  pointer-events: none;
}

.rating-empty {
  color: var(--color-text-subtle);
  font-size: 0.85rem;
}

.col-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.15rem;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.data-row:hover .col-actions,
.data-row:focus-within .col-actions {
  opacity: 1;
}

.row-action-btn {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all 0.15s;
}

.row-action-btn:hover {
  background: var(--color-surface-muted);
  color: var(--color-brand-primary-hover);
}

.row-action-btn.active i {
  color: var(--color-status-danger-bright);
}

.row-action-btn.delete:hover {
  background: var(--color-status-danger-soft);
  color: var(--color-status-danger);
}

.row-action-btn.muted {
  cursor: default;
  opacity: 0.55;
}

.row-action-btn.muted:hover {
  background: transparent;
  color: var(--color-text-subtle);
}

@media (max-width: 760px) {
  .detail-hero {
    grid-template-columns: 1fr;
    gap: 1rem;
    min-height: 0;
    margin-bottom: 1rem;
  }

  .detail-cover-stack {
    width: 245px;
    height: 178px;
    margin: 0 auto;
    transform: scale(0.86);
    transform-origin: center;
  }

  .detail-copy {
    text-align: center;
  }

  .detail-copy h2 {
    font-size: 2rem;
  }

  .data-header {
    display: none;
  }

  .data-row {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .col-status,
  .col-progress,
  .col-personal,
  .col-goodreads,
  .col-actions {
    justify-content: flex-start;
  }

  .col-actions {
    opacity: 1;
  }
}
</style>
