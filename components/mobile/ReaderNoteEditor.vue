<template>
  <div class="note-overlay" role="presentation" @click="$emit('close')">
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
        rows="5"
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
import { nextTick, onMounted, ref } from 'vue'

const props = defineProps({
  quote: { type: String, default: '' },
  initial: { type: String, default: '' },
  existing: { type: Boolean, default: false },
})

defineEmits(['close', 'save', 'delete'])

const draft = ref(props.initial || '')
const inputRef = ref(null)

onMounted(async () => {
  await nextTick()
  inputRef.value?.focus()
})
</script>

<style scoped>
.note-overlay {
  position: fixed;
  inset: 0;
  z-index: 3500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.note-sheet {
  width: 100%;
  max-width: 520px;
  padding: 0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
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
