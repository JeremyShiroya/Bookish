<template>
  <div class="note-overlay" :style="overlayStyle" role="presentation" @click="$emit('close')">
    <section
      class="note-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-title"
      @click.stop
    >
      <span class="sheet-grabber" aria-hidden="true"></span>
      <h2 id="note-title">{{ existing ? 'Edit note' : 'Make a note' }}</h2>

      <!-- The passage stays in view: a note written against text you can no
           longer see is easy to get wrong. -->
      <blockquote v-if="quote" class="note-quote">{{ quote }}</blockquote>

      <textarea
        ref="inputRef"
        v-model="draft"
        class="note-input"
        rows="4"
        placeholder="What did you want to remember about this?"
      ></textarea>

      <div class="note-actions">
        <button
          v-if="existing"
          type="button"
          class="note-delete"
          @click="$emit('delete')"
        >
          <i class="ri-delete-bin-line"></i>
          Delete
        </button>
        <button type="button" class="note-cancel" @click="$emit('close')">Cancel</button>
        <button
          type="button"
          class="note-save"
          :disabled="!draft.trim()"
          @click="$emit('save', draft.trim())"
        >
          Save
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  quote: { type: String, default: '' },
  initial: { type: String, default: '' },
  existing: { type: Boolean, default: false },
})

defineEmits(['close', 'save', 'delete'])

const draft = ref(props.initial || '')
const inputRef = ref(null)

// The sheet is anchored to the VISUAL viewport, not the layout viewport.
//
// `position: fixed; inset: 0` resolves against the layout viewport, which the
// Android WebView does not always shrink when the keyboard opens — so the sheet
// either sat behind the keyboard or, once the keyboard closed before the
// WebView re-expanded, left a dead grey band under itself. visualViewport is
// the only thing that reports the rectangle actually on screen.
const viewport = ref({ top: 0, height: 0 })

const overlayStyle = computed(() => (
  viewport.value.height
    ? { top: `${viewport.value.top}px`, height: `${viewport.value.height}px` }
    : {}
))

const syncViewport = () => {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  if (!vv) return
  viewport.value = { top: vv.offsetTop, height: vv.height }
}

onMounted(async () => {
  syncViewport()
  window.visualViewport?.addEventListener('resize', syncViewport)
  window.visualViewport?.addEventListener('scroll', syncViewport)
  await nextTick()
  inputRef.value?.focus()
})

onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', syncViewport)
  window.visualViewport?.removeEventListener('scroll', syncViewport)
})
</script>

<style scoped>
/* top/height come from the visual viewport (see syncViewport); the fallback
   below is what a browser without visualViewport gets. */
.note-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  height: auto;
  z-index: 3500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.note-sheet {
  width: 100%;
  max-width: 520px;
  /* Never taller than the space the keyboard leaves: the actions must stay
     reachable even on a short landscape viewport. */
  max-height: 100%;
  overflow-y: auto;
  padding: 0.75rem 1.25rem calc(1rem + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: var(--mobile-reader-surface, #fff);
  color: var(--mobile-reader-text, #222);
}

.sheet-grabber {
  display: block;
  width: 36px;
  height: 4px;
  margin: 0 auto 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--mobile-reader-text, #222) 20%, transparent);
}

.note-sheet h2 {
  margin: 0 0 0.6rem;
  font-size: 1.05rem;
  font-weight: 600;
}

.note-quote {
  margin: 0 0 0.75rem;
  padding: 0.6rem 0.75rem;
  border-left: 3px solid var(--color-brand-primary);
  border-radius: 0 8px 8px 0;
  background: color-mix(in srgb, var(--mobile-reader-text, #222) 6%, transparent);
  color: color-mix(in srgb, var(--mobile-reader-text, #222) 75%, transparent);
  font-size: 0.85rem;
  line-height: 1.45;
  max-height: 6.5rem;
  overflow-y: auto;
}

.note-input {
  width: 100%;
  padding: 0.7rem;
  border: 1px solid color-mix(in srgb, var(--mobile-reader-text, #222) 18%, transparent);
  border-radius: 12px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.95rem;
  line-height: 1.5;
  resize: vertical;
}

.note-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.85rem;
}

.note-delete,
.note-cancel,
.note-save {
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.note-delete {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-right: auto;
  background: transparent;
  color: var(--color-status-danger-bright, #dc2626);
}

.note-cancel {
  border: 1px solid color-mix(in srgb, var(--mobile-reader-text, #222) 20%, transparent);
  background: transparent;
  color: inherit;
}

.note-save {
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
}

.note-save:disabled {
  opacity: 0.5;
}
</style>
