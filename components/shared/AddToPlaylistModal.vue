<template>
  <div class="playlist-overlay" @click="emit('close')">
    <section class="playlist-dialog" role="dialog" aria-modal="true" aria-labelledby="playlist-dialog-title" @click.stop>
      <header>
        <div>
          <span class="eyebrow">Organize your library</span>
          <h2 id="playlist-dialog-title">Add to playlist</h2>
        </div>
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

      <div v-if="availablePlaylists.length" class="playlist-list">
        <label
          v-for="playlist in availablePlaylists"
          :key="playlist.id"
          class="playlist-choice"
          :class="{ selected: selectedPlaylistId === String(playlist.id) }"
        >
          <input v-model="selectedPlaylistId" type="radio" :value="String(playlist.id)" />
          <span class="playlist-icon"><i class="ri-play-list-2-line"></i></span>
          <span class="playlist-copy">
            <strong>{{ playlist.name }}</strong>
            <small>{{ playlist.bookIds?.length || 0 }} books</small>
          </span>
          <span class="choice-check"><i class="ri-check-line"></i></span>
        </label>
      </div>

      <div v-if="creatingPlaylist || !availablePlaylists.length" class="new-playlist">
        <label for="new-playlist-name">New playlist name</label>
        <input
          id="new-playlist-name"
          ref="newPlaylistInput"
          v-model="newPlaylistName"
          type="text"
          maxlength="100"
          placeholder="Weekend reads"
          @keydown.enter.prevent="save"
        />
      </div>

      <button
        v-else
        type="button"
        class="create-toggle"
        @click="startCreating"
      >
        <i class="ri-add-line"></i>
        Create a new playlist
      </button>

      <footer>
        <button
          v-if="creatingPlaylist && availablePlaylists.length"
          type="button"
          class="back-button"
          @click="stopCreating"
        >
          Back to playlists
        </button>
        <span v-else></span>
        <div class="footer-actions">
          <button type="button" class="cancel-button" @click="emit('close')">Cancel</button>
          <button type="button" class="save-button" :disabled="!canSave || saving" @click="save">
            <i :class="saving ? 'ri-loader-4-line spin' : 'ri-play-list-add-line'"></i>
            {{ saving ? 'Adding...' : 'Add book' }}
          </button>
        </div>
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
const selectedPlaylistId = ref('')
const creatingPlaylist = ref(false)
const newPlaylistName = ref('')
const newPlaylistInput = ref(null)
const saving = ref(false)

const availablePlaylists = computed(() => collections.value.filter(
  playlist => !(playlist.bookIds || []).some(id => String(id) === String(props.book.id))
))

if (availablePlaylists.value.length) {
  selectedPlaylistId.value = String(availablePlaylists.value[0].id)
} else {
  creatingPlaylist.value = true
}

const canSave = computed(() => (
  creatingPlaylist.value
    ? newPlaylistName.value.trim().length > 0
    : Boolean(selectedPlaylistId.value)
))

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
  creatingPlaylist.value = true
  newPlaylistName.value = ''
  await nextTick()
  newPlaylistInput.value?.focus()
}

const stopCreating = () => {
  creatingPlaylist.value = false
  newPlaylistName.value = ''
  selectedPlaylistId.value = String(availablePlaylists.value[0]?.id || '')
}

const save = async () => {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    let playlistId = selectedPlaylistId.value
    if (creatingPlaylist.value) {
      const playlist = await createPlaylist({ name: newPlaylistName.value.trim() })
      playlistId = String(playlist.id)
    }
    await addBookToPlaylist(playlistId, props.book.id)
    addToast('Book added to playlist', 'success')
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
  display: grid;
  place-items: center;
  padding: 1rem;
  background: var(--color-background-overlay-soft);
  backdrop-filter: blur(6px);
}

.playlist-dialog {
  width: min(500px, 100%);
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: 18px;
  background: var(--color-surface-modal);
  box-shadow: var(--shadow-modal);
}

header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.4rem;
}

header h2 {
  margin: 0.2rem 0 0;
  color: var(--color-text-primary);
  font-size: 1.25rem;
}

.eyebrow {
  color: var(--color-brand-primary);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.close-button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
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
  gap: 0.85rem;
  margin: 0 1.4rem 1rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: var(--color-brand-primary-faint);
}

.book-preview img {
  width: 42px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: var(--shadow-cover);
}

.book-preview div,
.playlist-copy {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.book-preview strong,
.playlist-copy strong {
  overflow: hidden;
  color: var(--color-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-preview span,
.playlist-copy small {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.playlist-list {
  display: grid;
  gap: 0.55rem;
  max-height: 270px;
  overflow-y: auto;
  padding: 0 1.4rem;
}

.playlist-choice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 11px;
  background: var(--color-surface-input);
  cursor: pointer;
}

.playlist-choice.selected {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
}

.playlist-choice input {
  position: absolute;
  opacity: 0;
}

.playlist-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 10px;
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary);
}

.playlist-copy {
  flex: 1;
}

.choice-check {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
  color: transparent;
}

.selected .choice-check {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary);
  color: white;
}

.create-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: calc(100% - 2.8rem);
  margin: 0.8rem 1.4rem 0;
  padding: 0.75rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: 10px;
  background: transparent;
  color: var(--color-brand-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.new-playlist {
  display: grid;
  gap: 0.45rem;
  padding: 0.4rem 1.4rem 0;
}

.new-playlist label {
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
}

.new-playlist input {
  width: 100%;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  outline: 0;
  background: var(--color-surface-input);
  color: var(--color-text-primary);
  font: inherit;
}

.new-playlist input:focus {
  border-color: var(--color-border-focus);
  box-shadow: var(--shadow-focus-ring);
}

footer {
  margin-top: 1rem;
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-surface-secondary);
}

.footer-actions {
  display: flex;
  gap: 0.65rem;
}

.back-button,
.cancel-button,
.save-button {
  min-height: 40px;
  padding: 0.65rem 0.9rem;
  border-radius: 9px;
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
}

.back-button {
  border: 0;
  background: transparent;
  color: var(--color-brand-primary);
}

.cancel-button {
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-primary);
  color: var(--color-text-secondary);
}

.save-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 0;
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
}

.save-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
