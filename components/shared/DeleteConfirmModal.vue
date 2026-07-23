<template>
  <div class="delete-overlay" role="presentation" @click="closeModal">
    <section
      class="delete-sheet"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      @click.stop
    >
      <span class="sheet-grabber" aria-hidden="true"></span>

      <div class="delete-book">
        <img :src="book.cover" :alt="book.title" class="delete-cover" @error="onCoverError($event, book.title)" />
        <div class="delete-book-meta">
          <strong>{{ isBulk ? `${count} books` : book.title }}</strong>
          <span>{{ isBulk ? 'Selected in your library' : (book.author || 'Unknown author') }}</span>
        </div>
      </div>

      <h2 id="delete-title">{{ isBulk ? `Delete these ${count} books?` : 'Delete this book?' }}</h2>
      <p id="delete-description" class="delete-description">
        This permanently removes {{ isBulk ? 'them' : 'the book' }} from Pages. It cannot be undone.
      </p>

      <!-- Spell out exactly what disappears, so "delete" is never mistaken for
           the neighbouring "hide" action. -->
      <ul class="delete-effects">
        <li>
          <i class="ri-book-2-line"></i>
          <span>{{ isBulk ? 'Their' : 'Its' }} place in your library, progress and bookmarks</span>
        </li>
        <li v-if="removesDeviceFile" class="danger">
          <i class="ri-smartphone-line"></i>
          <span class="effect-copy">
            The <strong>{{ formatLabel }} file on your device</strong>
            <em v-if="book.deviceImportPath" :title="book.deviceImportPath">{{ book.deviceImportPath }}</em>
          </span>
        </li>
        <li v-else>
          <i class="ri-file-copy-2-line"></i>
          <span>Its stored copy of the {{ formatLabel }} and cover</span>
        </li>
      </ul>

      <p class="delete-hint">
        Want it out of the way but kept? Close this and choose
        <strong>Hide</strong> instead.
      </p>

      <div class="delete-actions">
        <button type="button" class="delete-cancel" @click="closeModal">Cancel</button>
        <button type="button" class="delete-confirm" @click="confirmDelete">
          <i class="ri-delete-bin-line"></i>
          Delete permanently
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { onCoverError } from '~/composables/useCoverFallback'

const props = defineProps({
  book: {
    type: Object,
    required: true,
  },
  // Bulk delete reuses this sheet with the first selected book as the face of
  // the pile: the warning and its list of consequences are identical, and a
  // second near-copy of them would be the thing that drifts.
  count: {
    type: Number,
    default: 1,
  },
})

const emit = defineEmits(['close', 'confirm'])

const isBulk = computed(() => props.count > 1)

const formatLabel = computed(() => (props.book.format || 'book').toUpperCase())

// Books auto-imported from device storage own the original document on the
// phone; deleting the book deletes that file too.
const removesDeviceFile = computed(() => Boolean(props.book.deviceImport && props.book.deviceImportPath))

const closeModal = () => emit('close')
const confirmDelete = () => emit('confirm')
</script>

<style scoped>
.delete-overlay {
  position: fixed;
  inset: 0;
  z-index: 3400;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--color-background-overlay-soft);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* A bottom sheet: the confirm button lands under the thumb rather than in the
   middle of the screen, and the sheet can never be dismissed by a stray tap on
   a full-width overlay button. */
.delete-sheet {
  width: min(520px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  padding: 10px 20px calc(20px + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: var(--color-surface-modal, var(--color-surface-primary));
  box-shadow: 0 -14px 40px rgba(15, 23, 42, 0.24);
  text-align: left;
}

.sheet-grabber {
  display: block;
  width: 36px;
  height: 4px;
  margin: 0 auto 18px;
  border-radius: 999px;
  background: var(--color-border-strong);
  opacity: 0.5;
}

.delete-book {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.7rem;
  border-radius: 12px;
  background: var(--color-surface-secondary);
}

.delete-cover {
  width: 44px;
  height: 62px;
  flex: 0 0 auto;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: var(--shadow-cover);
}

.delete-book-meta {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.delete-book-meta strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-book-meta span {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.delete-sheet h2 {
  margin: 1.1rem 0 0.3rem;
  color: var(--color-text-primary);
  font-size: 1.2rem;
  font-weight: 600;
}

.delete-description {
  margin: 0 0 1rem;
  color: var(--color-text-secondary);
  font-size: 0.88rem;
  line-height: 1.5;
}

.delete-effects {
  display: grid;
  gap: 0.6rem;
  margin: 0 0 1rem;
  padding: 0.9rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  list-style: none;
}

.delete-effects li {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  min-width: 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  line-height: 1.45;
}

/* The text column must be allowed to shrink below its intrinsic width, or the
   long device path can't wrap and breaks out of the sheet. */
.effect-copy {
  min-width: 0;
  overflow: hidden;
}

.delete-effects i {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--color-text-muted);
  font-size: 1rem;
}

.delete-effects .danger,
.delete-effects .danger i {
  color: var(--color-status-danger);
}

.delete-effects em {
  display: block;
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 0.74rem;
  font-style: normal;
  /* A file path has no spaces to break on — allow mid-string wrapping so it
     stays inside the sheet instead of overflowing. */
  overflow-wrap: anywhere;
  word-break: break-word;
}

.delete-hint {
  margin: 0 0 1.2rem;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.delete-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);
  gap: 0.7rem;
}

.delete-cancel,
.delete-confirm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 48px;
  padding: 0 0.9rem;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
}

.delete-cancel {
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-primary);
  color: var(--color-text-secondary);
}

.delete-confirm {
  border: 0;
  background: var(--color-status-danger);
  color: var(--color-text-on-brand);
}

.delete-confirm:active {
  background: var(--color-status-danger-hover);
}
</style>
