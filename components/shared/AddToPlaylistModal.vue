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

      <!-- Creating a playlist is a row in the list, not a mode that replaces it:
           the old modal swapped the whole list out for a text field. -->
      <div class="playlist-list" role="group" aria-label="Your playlists">
        <div v-if="creating" class="new-playlist-row">
          <i class="ri-play-list-add-line"></i>
          <input
            ref="newPlaylistInput"
            v-model="newPlaylistName"
            type="text"
            maxlength="100"
            placeholder="Playlist name"
            @keydown.enter.prevent="save"
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

        <!-- Playlists already containing the book stay visible, marked "Added",
             instead of silently vanishing from the list. -->
        <button
          v-for="playlist in playlists"
          :key="playlist.id"
          type="button"
          class="playlist-row"
          :class="{ selected: selectedIds.has(String(playlist.id)), added: playlist.alreadyHas }"
          :disabled="playlist.alreadyHas"
          :aria-pressed="selectedIds.has(String(playlist.id))"
          @click="toggle(playlist)"
        >
          <span class="row-icon"><i class="ri-play-list-2-line"></i></span>
          <span class="row-copy">
            <strong>{{ playlist.name }}</strong>
            <small>{{ playlist.bookIds?.length || 0 }} books</small>
          </span>
          <span v-if="playlist.alreadyHas" class="row-added">Added</span>
          <span v-else class="row-check"><i class="ri-check-line"></i></span>
        </button>

        <p v-if="!playlists.length && !creating" class="playlist-empty">
          You have no playlists yet. Create your first one above.
        </p>
      </div>

      <footer>
        <button type="button" class="cancel-button" @click="emit('close')">Cancel</button>
        <button type="button" class="save-button" :disabled="!canSave || saving" @click="save">
          <i :class="saving ? 'ri-loader-4-line spin' : 'ri-check-line'"></i>
          {{ saveLabel }}
        </button>
      </footer>
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
const { collections, createPlaylist, addBookToPlaylist } = useBooks()
const { addToast } = useToast()

const selectedIds = ref(new Set())
const creating = ref(false)
const newPlaylistName = ref('')
const newPlaylistInput = ref(null)
const saving = ref(false)

const playlists = computed(() => collections.value.map(playlist => ({
  ...playlist,
  alreadyHas: (playlist.bookIds || []).some(id => String(id) === String(props.book.id)),
})))

const selectedCount = computed(() => selectedIds.value.size)

const canSave = computed(() => (
  creating.value ? newPlaylistName.value.trim().length > 0 : selectedCount.value > 0
))

const saveLabel = computed(() => {
  if (saving.value) return 'Adding…'
  if (creating.value) return 'Create & add'
  if (selectedCount.value > 1) return `Add to ${selectedCount.value} playlists`
  return 'Add book'
})

const toggle = (playlist) => {
  if (playlist.alreadyHas) return
  const id = String(playlist.id)
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

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

const save = async () => {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    const targets = creating.value
      ? [String((await createPlaylist({ name: newPlaylistName.value.trim() })).id)]
      : [...selectedIds.value]

    for (const playlistId of targets) {
      await addBookToPlaylist(playlistId, props.book.id)
    }

    addToast(
      targets.length > 1
        ? `Book added to ${targets.length} playlists`
        : 'Book added to playlist',
      'success',
    )
    emit('saved')
    emit('close')
  } catch (error) {
    console.error('Playlist update failed:', error)
    addToast('Failed to update playlist', 'error')
  } finally {
    saving.value = false
  }
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
  padding: 10px 0 0;
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
  padding: 0 1.1rem 0.4rem;
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

.playlist-row.selected {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
}

.playlist-row.added {
  cursor: default;
  opacity: 0.62;
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

.row-check {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: 7px;
  color: transparent;
}

.playlist-row.selected .row-check {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.row-added {
  flex: 0 0 auto;
  color: var(--color-text-muted);
  font-size: 0.74rem;
  font-weight: 600;
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
  margin: 0.5rem 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  text-align: center;
}

footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 0.7rem;
  padding: 0.8rem 1.1rem calc(0.9rem + env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border-subtle);
}

.cancel-button,
.save-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 48px;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
}

.cancel-button {
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-primary);
  color: var(--color-text-secondary);
}

.save-button {
  border: 0;
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
}

.save-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
