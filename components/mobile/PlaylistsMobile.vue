<template>
  <div class="playlists-container">
    <MobileTopNav />


    <div v-if="showSkeleton" class="playlists-loading">
      <MobileSkeleton page="playlists" :count="4" />
    </div>

    <!-- Playlists render through the SAME card as series (SeriesCollageCard),
         so they stay identical in styling and honour the playlist-card
         Preferences. Long-press / right-click opens the edit menu. -->
    <div v-else-if="playlistsWithBooks.length > 0" class="series-grid">
      <SeriesCollageCard
        v-for="playlist in playlistsWithBooks"
        :key="playlist.id"
        variant="playlist"
        :series="playlist"
        @open="openPlaylist(playlist)"
        @contextmenu="(e) => openContextMenu(e, playlist)"
      />
    </div>

    <div
      v-if="contextMenu.playlist"
      class="playlist-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <button type="button" @click="openEditor(contextMenu.playlist)">
        <i class="ri-edit-line"></i>
        Edit
      </button>
      <button type="button" class="danger" @click="confirmDelete(contextMenu.playlist)">
        <i class="ri-delete-bin-line"></i>
        Delete
      </button>
    </div>

    <PlaylistEditModal
      v-if="editingPlaylist"
      :playlist="editingPlaylist"
      :saving="savingPlaylist"
      @close="closeEditor"
      @save="savePlaylist"
    />

    <PlaylistDeleteModal
      v-if="playlistToDelete"
      :playlist="playlistToDelete"
      @close="playlistToDelete = null"
      @confirm="performDelete"
    />

    <!-- Empty State -->
    <EmptyState
      v-if="playlistsWithBooks.length === 0 && !showSkeleton"
      illustration="playlists"
      title="No playlists yet"
      description="Gather books into playlists for moods, genres or a ready-to-listen queue."
    >
      <template #action>
        <button type="button" class="add-btn">
          <i class="ri-add-line"></i>
          Create Playlist
        </button>
      </template>
    </EmptyState>

    <MobileBottomNav />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useBooks } from "~/composables/useBooks";
import { useToast } from "~/composables/useToast";
import EmptyState from "../shared/EmptyState.vue";
import PlaylistDeleteModal from "../shared/PlaylistDeleteModal.vue";
import PlaylistEditModal from "../shared/PlaylistEditModal.vue";
import SeriesCollageCard from "../shared/SeriesCollageCard.vue";
import MobileBottomNav from "./MobileBottomNav.vue";
import MobileSkeleton from "./MobileSkeleton.vue";
import MobileTopNav from "./MobileTopNav.vue";

const { collections, books, updatePlaylist, deletePlaylist, loading, initialized } = useBooks();
const showSkeleton = computed(() => loading.value && !initialized.value);
const { addToast } = useToast();
const router = useRouter();
const editingPlaylist = ref(null);
const savingPlaylist = ref(false);
const playlistToDelete = ref(null);
const contextMenu = reactive({ playlist: null, x: 0, y: 0 });

const openPlaylist = (playlist) => {
  closeContextMenu();
  router.push(`/playlist/${playlist.id}`);
};

const closeContextMenu = () => {
  contextMenu.playlist = null;
};

const openContextMenu = (event, playlist) => {
  const menuWidth = 170;
  const menuHeight = 92;
  contextMenu.playlist = playlist;
  contextMenu.x = Math.min(event.clientX, window.innerWidth - menuWidth - 12);
  contextMenu.y = Math.min(event.clientY, window.innerHeight - menuHeight - 12);
};

const openEditor = (playlist) => {
  editingPlaylist.value = playlist;
  closeContextMenu();
};

const closeEditor = () => {
  editingPlaylist.value = null;
  savingPlaylist.value = false;
};

const savePlaylist = async (playlist) => {
  savingPlaylist.value = true;
  try {
    await updatePlaylist(playlist);
    addToast('Playlist updated', 'success');
    closeEditor();
  } catch {
    addToast('Could not update playlist', 'error');
    savingPlaylist.value = false;
  }
};

const confirmDelete = (playlist) => {
  closeContextMenu();
  playlistToDelete.value = playlist;
};

const performDelete = async () => {
  const playlist = playlistToDelete.value;
  if (!playlist) return;
  playlistToDelete.value = null;
  try {
    await deletePlaylist(playlist.id);
    addToast('Playlist deleted', 'success');
  } catch {
    addToast('Could not delete playlist', 'error');
  }
};

const handleWindowKeydown = (event) => {
  if (event.key !== 'Escape') return;
  closeContextMenu();
  closeEditor();
};

onMounted(() => {
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('keydown', handleWindowKeydown);
});

onUnmounted(() => {
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('keydown', handleWindowKeydown);
});

const playlistsWithBooks = computed(() => {
  return collections.value.map((playlist) => {
    const bookIds = playlist.bookIds || [];
    const hasBook = (bookId) => bookIds.some(id => String(id) === String(bookId));
    const allBooks = books.value.filter((book) => hasBook(book.id));
    const previewBooks = allBooks
      .filter((book) => bookIds.slice(0, 3).some(id => String(id) === String(book.id)))
      .sort((a, b) => (
        bookIds.findIndex(id => String(id) === String(a.id))
        - bookIds.findIndex(id => String(id) === String(b.id))
      ));
    return {
      ...playlist,
      bookCount: bookIds.length,
      // `books` is what SeriesCollageCard reads for its cover stack; a playlist
      // supplies its first few books here.
      books: previewBooks,
      previewBooks,
    };
  });
});
</script>

<style scoped>
/* Playlists mirror the Series page: identical container, grid, and (via
   SeriesCollageCard) card. Only the context menu + edit affordances are extra. */
.playlists-container {
  margin: 0 auto;
  padding-top: calc(4.85rem + env(safe-area-inset-top));
  padding-bottom: calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
}

.playlists-loading {
  padding: 0.5rem 0;
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}

.playlist-context-menu {
  position: fixed;
  z-index: 3100;
  width: 160px;
  padding: 0.35rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 11px;
  background: var(--color-surface-glass);
  box-shadow: var(--shadow-modal);
  backdrop-filter: blur(12px);
}

.playlist-context-menu button {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.65rem 0.7rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 0.84rem;
  text-align: left;
  cursor: pointer;
}

.playlist-context-menu button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.playlist-context-menu button.danger {
  color: var(--color-status-danger);
}

.playlist-context-menu button.danger:hover {
  background: var(--color-status-danger-soft);
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand-button-hover);
}

@media (max-width: 640px) {
  .series-grid {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 0 var(--mobile-page-padding-inline);
  }

  .add-btn {
    min-height: var(--mobile-touch-target);
    border-radius: var(--mobile-control-radius);
    font-size: var(--mobile-subtext-size);
  }
}
</style>
