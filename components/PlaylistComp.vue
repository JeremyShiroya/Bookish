<template>
  <div class="playlists-container">

    <div class="playlists-header">
      <h1 class="playlists-title">Playlists</h1>
    </div>

    <div v-if="playlistsWithBooks.length > 0" class="playlists-grid">
      <div
        v-for="playlist in playlistsWithBooks"
        :key="playlist.id"
        class="playlist-card"
        @click="openPlaylist(playlist)"
      >
        <!-- Blurred cover background -->
        <div
          class="card-bg"
          :style="{ backgroundImage: playlist.previewBooks[0] ? `url(${resolveBookCover(playlist.previewBooks[0])})` : 'none' }"
        ></div>
        <div class="card-bg-overlay"></div>

        <!-- Playlist name — top left -->
        <span class="card-name">{{ playlist.name }}</span>

        <!-- Up to 2 covers — bottom right, angled -->
        <div class="card-covers">
          <img
            v-if="playlist.previewBooks[1]"
            class="card-cover card-cover--back"
            :src="resolveBookCover(playlist.previewBooks[1])"
            :alt="playlist.previewBooks[1].title"
            @error="(e) => coverFallback(e, playlist.previewBooks[1].title)"
          />
          <img
            v-if="playlist.previewBooks[0]"
            class="card-cover card-cover--front"
            :src="resolveBookCover(playlist.previewBooks[0])"
            :alt="playlist.previewBooks[0].title"
            @error="(e) => coverFallback(e, playlist.previewBooks[0].title)"
          />
        </div>

        <!-- Book count badge — expands on hover -->
        <div class="card-badge">
          <i class="ri-book-open-line"></i>
          <span>{{ playlist.bookCount }} {{ playlist.bookCount === 1 ? 'book' : 'books' }}</span>
          <span class="badge-details">
            <span class="badge-sep">·</span>
            <span>{{ playlist.unreadCount }} unread</span>
            <span class="badge-sep">·</span>
            <span>{{ playlist.readingCount }} reading</span>
            <span class="badge-sep">·</span>
            <span>{{ playlist.readCount }} read</span>
          </span>
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
  return collections.value.map((playlist) => {
    const bookIds = playlist.bookIds || [];
    const allBooks = books.value.filter((b) => bookIds.includes(b.id));
    const previewBooks = allBooks
      .filter((b) => bookIds.slice(0, 3).includes(b.id))
      .sort((a, b) => bookIds.indexOf(a.id) - bookIds.indexOf(b.id));
    return {
      ...playlist,
      bookCount: bookIds.length,
      previewBooks,
      unreadCount:  allBooks.filter(b => !b.status || b.status === 'Unread').length,
      readingCount: allBooks.filter(b => b.status === 'Reading').length,
      readCount:    allBooks.filter(b => b.status === 'Read').length,
    };
  });
});

const generateCoverPlaceholder = (title) => {
  const colors = getThemeCssVars([
    { name: "--color-book-cover-placeholder-one",   fallback: "#8A2BE2" },
    { name: "--color-book-cover-placeholder-two",   fallback: "#6A0DAD" },
    { name: "--color-book-cover-placeholder-three", fallback: "#2f7d62" },
    { name: "--color-book-cover-placeholder-four",  fallback: "#b45309" },
  ]);
  const safeTitle = String(title || "Book");
  const hash = [...safeTitle].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = colors[hash % colors.length];
  const initial = safeTitle.trim()[0]?.toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="145" font-family="serif" font-size="96" fill="rgba(255,255,255,0.48)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const resolveBookCover = (book) => book.cover || generateCoverPlaceholder(book.title);

const coverFallback = (event, title) => {
  event.target.src = generateCoverPlaceholder(title);
};
</script>

<style scoped>
.playlists-container {
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────────────────── */

.playlists-header {
  margin-bottom: 1.75rem;
}

.playlists-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-brand-primary);
  margin: 0;
}

/* ── Grid ────────────────────────────────────────────────────── */

.playlists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

/* ── Card ────────────────────────────────────────────────────── */

.playlist-card {
  position: relative;
  aspect-ratio: 3 / 2;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  background: #0f0a1a;
  transition: transform 0.2s ease;
  user-select: none;
}

.playlist-card::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  background: transparent;
  transition: background 0.2s ease;
  pointer-events: none;
}

.playlist-card:hover::after {
  background: rgba(255, 255, 255, 0.07);
}

.playlist-card:hover {
  transform: scale(1.03);
}

/* ── Blurred background ──────────────────────────────────────── */

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

/* ── Badge ───────────────────────────────────────────────────── */

.card-badge {
  position: absolute;
  bottom: 10px;
  left: 12px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.22rem 0.65rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.88);
  font-size: 0.7rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  transition: background 0.25s ease, border-color 0.25s ease;
}

.card-badge i {
  font-size: 0.8rem;
  flex-shrink: 0;
}

.badge-details {
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition:
    max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s ease;
}

.badge-sep {
  opacity: 0.45;
}

.playlist-card:hover .card-badge {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.32);
}

.playlist-card:hover .badge-details {
  max-width: 220px;
  opacity: 1;
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
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand-button-hover);
}
</style>
