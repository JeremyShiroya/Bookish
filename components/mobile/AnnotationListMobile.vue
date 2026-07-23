<template>
  <div class="annotations-page">
    <MobileSettingsNav :title="pageTitle" :back-to="`/book/${bookId}`" aria-label="Annotations navigation" />

    <div class="annotations-body">
      <p v-if="items.length" class="annotations-count">
        {{ items.length }} {{ mode === 'notes' ? 'note' : 'highlight' }}{{ items.length === 1 ? '' : 's' }}
        <span v-if="book"> in {{ book.title }}</span>
      </p>

      <ul v-if="items.length" class="annotation-cards">
        <li v-for="item in items" :key="item.id" class="annotation-card">
          <div class="card-top">
            <span class="where">{{ locationLabel(item) }}</span>
            <span
              v-if="mode !== 'notes'"
              class="swatch"
              :style="{ backgroundColor: colorValue(item.color) }"
              aria-hidden="true"
            ></span>
          </div>

          <blockquote class="quote">{{ item.text }}</blockquote>

          <p v-if="item.note" class="note-body">{{ item.note }}</p>

          <div class="card-actions">
            <button type="button" class="card-btn" @click="openInBook(item)">
              <i class="ri-book-open-line"></i>
              Open in book
            </button>
            <button v-if="mode === 'notes'" type="button" class="card-btn" @click="startEdit(item)">
              <i class="ri-edit-line"></i>
              Edit
            </button>
            <button type="button" class="card-btn danger" @click="confirmDelete = item">
              <i class="ri-delete-bin-line"></i>
              Delete
            </button>
          </div>
        </li>
      </ul>

      <EmptyState
        v-else-if="!loading"
        :title="mode === 'notes' ? 'No notes yet' : 'No highlights yet'"
        :description="mode === 'notes'
          ? 'Long-press any passage while reading and choose Make note.'
          : 'Long-press any passage while reading and choose Highlight.'"
        :icon="mode === 'notes' ? 'ri-sticky-note-line' : 'ri-mark-pen-line'"
      />
    </div>

    <ReaderNoteEditor
      v-if="editing"
      :quote="editing.text"
      :initial="editing.note"
      existing
      @close="editing = null"
      @save="saveEdit"
      @delete="deleteEditing"
    />

    <!-- Deleting a highlight cannot be undone, so it asks first. -->
    <div v-if="confirmDelete" class="confirm-overlay" role="presentation" @click="confirmDelete = null">
      <section class="confirm-sheet" role="alertdialog" aria-modal="true" @click.stop>
        <h2>Delete this {{ mode === 'notes' ? 'note' : 'highlight' }}?</h2>
        <p>{{ mode === 'notes' ? 'The note and its highlight are removed.' : 'The passage stays; only the highlight goes.' }}</p>
        <div class="confirm-actions">
          <button type="button" class="confirm-cancel" @click="confirmDelete = null">Cancel</button>
          <button type="button" class="confirm-delete" @click="removeItem">Delete</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '~/components/shared/EmptyState.vue'
import {
  colorValue,
  deleteAnnotation,
  loadAnnotations,
  saveAnnotation,
  useAnnotations,
} from '~/composables/useAnnotations'
import { useBooks } from '~/composables/useBooks'
import { useToast } from '~/composables/useToast'
import MobileSettingsNav from './MobileSettingsNav.vue'
import ReaderNoteEditor from './ReaderNoteEditor.vue'

const props = defineProps({
  // 'highlights' | 'notes'
  mode: { type: String, default: 'highlights' },
})

const route = useRoute()
const router = useRouter()
const { books } = useBooks()
const { highlights, notes } = useAnnotations()
const { addToast } = useToast()

const bookId = computed(() => String(route.params.id || ''))
const book = computed(() => books.value.find((b) => String(b.id) === bookId.value))
const loading = ref(true)
const editing = ref(null)
const confirmDelete = ref(null)

const pageTitle = computed(() => (props.mode === 'notes' ? 'Notes' : 'Highlights'))

const items = computed(() => {
  const source = props.mode === 'notes' ? notes.value : highlights.value
  return source.filter((a) => String(a.bookId) === bookId.value)
})

// Chapter is the useful anchor for a reader; the chunk index is not. TOC
// titles are stored on the book, and section counts let a chunk be mapped
// back to the section that owns it.
const sectionForChunk = (chunkIndex) => {
  const counts = book.value?.sectionCounts || []
  let offset = 0
  for (let i = 0; i < counts.length; i += 1) {
    const count = Number(counts[i]) || 0
    if (chunkIndex < offset + count) return i
    offset += count
  }
  return -1
}

const locationLabel = (item) => {
  const titles = book.value?.tocTitles || []
  const section = sectionForChunk(item.startChunk)
  const chapter = section >= 0 ? titles[section] : null
  if (chapter) return chapter
  if (section >= 0) return `Chapter ${section + 1}`
  return 'In this book'
}

const openInBook = (item) => {
  // Reading position is expressed in chunks, so the reader can land exactly
  // on the sentence the annotation starts at.
  router.push(`/reader/${bookId.value}?mode=read&chunk=${item.startChunk}`)
}

const startEdit = (item) => { editing.value = { ...item } }

const saveEdit = async (text) => {
  const target = editing.value
  editing.value = null
  if (!target) return
  await saveAnnotation({ ...target, note: text })
  addToast('Note updated.', 'success')
}

const deleteEditing = async () => {
  const target = editing.value
  editing.value = null
  if (target) {
    await deleteAnnotation(target.id)
    addToast('Note deleted.', 'info')
  }
}

const removeItem = async () => {
  const target = confirmDelete.value
  confirmDelete.value = null
  if (!target) return
  await deleteAnnotation(target.id)
  addToast(props.mode === 'notes' ? 'Note deleted.' : 'Highlight removed.', 'info')
}

onMounted(async () => {
  try {
    await loadAnnotations(bookId.value)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.annotations-page {
  width: 100%;
}

.annotations-body {
  padding: 0 var(--mobile-page-padding-inline)
    calc(var(--mobile-bottom-nav-height, 72px) + env(safe-area-inset-bottom));
}

.annotations-count {
  margin: 0 0 12px;
  color: var(--color-text-muted);
  font-size: var(--mobile-subtext-size, 0.85rem);
}

.annotation-cards {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 12px;
  list-style: none;
}

.annotation-card {
  padding: 14px;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--mobile-card-radius, 16px);
  background: var(--color-surface-card, var(--color-surface-primary));
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.where {
  color: var(--color-brand-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

.swatch {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 50%;
}

/* The passage itself carries the meaning, so it leads visually. */
.quote {
  margin: 0;
  padding-left: 10px;
  border-left: 3px solid var(--color-border-subtle);
  color: var(--color-text-primary);
  font-size: 0.95rem;
  line-height: 1.5;
}

.note-body {
  margin: 10px 0 0;
  padding: 10px;
  border-radius: 10px;
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.card-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}

.card-btn.danger {
  border-color: var(--color-status-danger-border, #f3c2c2);
  color: var(--color-status-danger-bright, #dc2626);
}

.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 3400;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.confirm-sheet {
  width: 100%;
  max-width: 520px;
  padding: 1.25rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: var(--color-surface-primary);
}

.confirm-sheet h2 {
  margin: 0 0 0.35rem;
  color: var(--color-text-primary);
  font-size: 1.05rem;
  font-weight: 600;
}

.confirm-sheet p {
  margin: 0 0 1rem;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}

.confirm-actions {
  display: flex;
  gap: 0.5rem;
}

.confirm-cancel,
.confirm-delete {
  flex: 1 1 0;
  padding: 0.8rem;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.confirm-cancel {
  border: 1px solid var(--color-border-subtle);
  background: transparent;
  color: var(--color-text-primary);
}

.confirm-delete {
  background: var(--color-status-danger-bright, #dc2626);
  color: #fff;
}
</style>
