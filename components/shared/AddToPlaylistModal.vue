<template>
  <div class="playlist-overlay" role="presentation" @click="emit('close')">
    <section
      class="playlist-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="playlist-sheet-title"
      @click.stop
    >
      <span class="sheet-grabber" aria-hidden="true"></span>

      <header>
        <h2 id="playlist-sheet-title">Add to playlist</h2>
        <button type="button" class="close-button" aria-label="Close" @click="emit('close')">
          <i class="ri-close-line"></i>
        </button>
      </header>

      <div class="book-preview">
        <img :src="coverUrl" :alt="book.title" @error="handleCoverError" />
        <div>
          <strong>{{ book.title }}</strong>
          <span>{{ book.author || 'Unknown author' }}</span>
        </div>
      </div>

      <!-- Tap a playlist to toggle the book in or out; the sheet stays open so
           one book can be filed into several playlists in a row. The book was
           already chosen to open this sheet — there is never a second step to
           re-pick it. Done (or the X) closes. -->
      <div class="playlist-list" role="group" aria-label="Your playlists">
        <!-- No separate Create button: typing a name and pressing Done (or the
             keyboard's enter) creates the playlist with this book in it. -->
        <div v-if="creating" class="new-playlist-row">
          <i class="ri-play-list-add-line"></i>
          <input
            ref="newPlaylistInput"
            :value="newPlaylistName"
            type="text"
            maxlength="100"
            placeholder="Playlist name"
            enterkeyhint="done"
            @input="newPlaylistName = $event.target.value"
            @keydown.enter.prevent="createAndAdd"
            @keydown.esc="cancelCreating"
          />
          <button type="button" class="row-ghost" aria-label="Cancel new playlist" @click="cancelCreating">
            <i class="ri-close-line"></i>
          </button>
        </div>

        <button v-else type="button" class="new-playlist-toggle" @click="startCreating">
          <span class="row-icon accent"><i class="ri-add-line"></i></span>
          <span class="row-copy"><strong>New playlist</strong></span>
        </button>

        <button
          v-for="playlist in playlists"
          :key="playlist.id"
          type="button"
          class="playlist-row"
          :class="{ added: playlist.alreadyHas }"
          :disabled="saving"
          :aria-pressed="playlist.alreadyHas"
          @click="togglePlaylist(playlist)"
        >
          <span class="row-icon"><i :class="playlist.alreadyHas ? 'ri-play-list-fill' : 'ri-play-list-2-line'"></i></span>
          <span class="row-copy">
            <strong>{{ playlist.name }}</strong>
            <small>{{ playlist.bookIds?.length || 0 }} books</small>
          </span>
          <span v-if="playlist.alreadyHas" class="row-check" aria-hidden="true"><i class="ri-check-line"></i></span>
          <span v-else class="row-add" aria-hidden="true"><i class="ri-add-line"></i></span>
        </button>

        <p v-if="!playlists.length && !creating" class="playlist-empty">
          You have no playlists yet. Create your first one above.
        </p>
      </div>

      <button type="button" class="playlist-done" :disabled="saving" @click="finish">
        {{ creating && newPlaylistName.trim() ? 'Create & done' : 'Done' }}
      </button>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { useBooks } from '~/composables/useBooks'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  book: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'saved'])
const { collections, createPlaylist, addBookToPlaylist, removeBookFromPlaylist } = useBooks()
const { addToast } = useToast()

const creating = ref(false)
const newPlaylistName = ref('')
const newPlaylistInput = ref(null)
const saving = ref(false)

const playlists = computed(() => collections.value.map(playlist => ({
  ...playlist,
  alreadyHas: (playlist.bookIds || []).some(id => String(id) === String(props.book.id)),
})))

const generateCoverPlaceholder = (title) => {
  const safeTitle = String(title || 'Book')
  const initial = safeTitle.trim()[0]?.toUpperCase() || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#6A0DAD"/><text x="100" y="145" font-family="serif" font-size="96" fill="rgba(255,255,255,.48)" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const coverUrl = computed(() => props.book.cover || generateCoverPlaceholder(props.book.title))
const handleCoverError = (event) => {
  event.target.src = generateCoverPlaceholder(props.book.title)
}

const startCreating = async () => {
  creating.value = true
  newPlaylistName.value = ''
  await nextTick()
  newPlaylistInput.value?.focus()
}

const cancelCreating = () => {
  creating.value = false
  newPlaylistName.value = ''
}

// Tap toggles membership and leaves the sheet open, so the book can be filed
// into several playlists (or pulled back out) without reopening.
const togglePlaylist = async (playlist) => {
  if (saving.value) return
  saving.value = true
  try {
    if (playlist.alreadyHas) {
      await removeBookFromPlaylist(playlist.id, props.book.id)
      addToast(`Removed from "${playlist.name}"`, 'success')
    } else {
      await addBookToPlaylist(playlist.id, props.book.id)
      addToast(`Added to "${playlist.name}"`, 'success')
    }
    emit('saved')
  } catch (error) {
    console.error('Playlist update failed:', error)
    addToast('Failed to update playlist', 'error')
  } finally {
    saving.value = false
  }
}

const createAndAdd = async () => {
  const name = newPlaylistName.value.trim()
  if (!name || saving.value) return false
  saving.value = true
  try {
    const playlist = await createPlaylist({ name })
    await addBookToPlaylist(playlist.id, props.book.id)
    addToast(`Added to "${name}"`, 'success')
    emit('saved')
    // Back to the playlist list (now including the new one) rather than
    // closing, so more playlists can be picked in the same pass.
    creating.value = false
    newPlaylistName.value = ''
    return true
  } catch (error) {
    console.error('Playlist create failed:', error)
    addToast('Failed to create playlist', 'error')
    return false
  } finally {
    saving.value = false
  }
}

// The single Done button: if a new playlist name is pending, create it (with
// this book in it) as part of finishing — no separate Create step.
const finish = async () => {
  if (creating.value && newPlaylistName.value.trim()) {
    const created = await createAndAdd()
    if (!created) return // keep the sheet open so the name isn't lost
  }
  emit('close')
}
</script>

<style scoped>
.playlist-overlay {
  position: fixed;
  inset: 0;
  z-index: 3300;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--color-background-overlay-soft);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* Bottom sheet: reachable with one thumb, and the list scrolls under a pinned
   header/footer instead of the whole dialog growing off-screen. */
.playlist-sheet {
  display: flex;
  width: min(520px, 100%);
  max-height: 86vh;
  flex-direction: column;
  /* Bottom padding clears the gesture bar so the Done footer is never cut off. */
  padding: 10px 0 calc(0.9rem + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: var(--color-surface-modal, var(--color-surface-primary));
  box-shadow: 0 -14px 40px rgba(15, 23, 42, 0.24);
}

.sheet-grabber {
  width: 36px;
  height: 4px;
  margin: 0 auto 14px;
  border-radius: 999px;
  background: var(--color-border-strong);
  opacity: 0.5;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.1rem 0.6rem;
}

header h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.15rem;
  font-weight: 600;
}

.close-button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: var(--color-surface-secondary);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.15rem;
}

.book-preview {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin: 0 1.1rem 0.8rem;
  padding: 0.7rem;
  border-radius: 12px;
  background: var(--color-brand-primary-faint);
}

.book-preview img {
  width: 40px;
  height: 56px;
  flex: 0 0 auto;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: var(--shadow-cover);
}

.book-preview div {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.book-preview strong {
  overflow: hidden;
  color: var(--color-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-preview span {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.playlist-list {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  gap: 0.5rem;
  min-height: 0;
  overflow-y: auto;
  padding: 0 1.1rem 0.5rem;
}

.playlist-row,
.new-playlist-toggle,
.new-playlist-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  min-height: 60px;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  background: var(--color-surface-input);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.playlist-row:active {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
}

/* "Added" is a selected state now, not a disabled one — the row can be tapped
   again to pull the book back out, so it reads as active rather than dimmed. */
.playlist-row.added {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
}

.row-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary);
}

.row-icon.accent {
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.row-copy {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 0.1rem;
}

.row-copy strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-copy small {
  color: var(--color-text-muted);
  font-size: 0.76rem;
}

/* The single-tap "add" affordance on each row. */
.row-add {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary);
  font-size: 1.1rem;
}

/* Filled check on a playlist the book is already in. */
.row-check {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  font-size: 1.05rem;
}

/* Fixed footer inside the sheet — never scrolls with the list, and the sheet's
   safe-area padding below keeps it fully visible above the gesture bar. */
.playlist-done {
  flex: 0 0 auto;
  margin: 0.5rem 1.1rem 0;
  padding: 0.85rem;
  border: 0;
  border-radius: 12px;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.playlist-done:disabled {
  opacity: 0.6;
}

.new-playlist-row {
  cursor: default;
}

.new-playlist-row > i {
  color: var(--color-brand-primary);
  font-size: 1.2rem;
}

.new-playlist-row input {
  width: 100%;
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
}

.row-ghost {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.playlist-empty {
  margin: 0.5rem 0 1rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  text-align: center;
}
</style>
