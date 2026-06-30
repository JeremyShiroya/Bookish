<template>
  <div class="playlist-editor-overlay" @click="emit('close')">
    <div class="playlist-editor" role="dialog" aria-modal="true" aria-labelledby="playlist-editor-title" @click.stop>
      <div class="playlist-editor-header">
        <div>
          <span class="playlist-editor-eyebrow">Playlist details</span>
          <h2 id="playlist-editor-title">Edit playlist</h2>
          <p>Choose a clear name for this playlist.</p>
        </div>
        <button type="button" class="playlist-editor-close" aria-label="Close" @click="emit('close')">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <form class="playlist-editor-form" @submit.prevent="save">
        <label>
          <span>Name</span>
          <input ref="nameInput" v-model="name" type="text" maxlength="100" placeholder="Playlist name" />
        </label>
        <div class="playlist-editor-actions">
          <button type="button" class="playlist-editor-cancel" @click="emit('close')">Cancel</button>
          <button type="submit" class="playlist-editor-save" :disabled="!canSave || saving">
            <i :class="saving ? 'ri-loader-4-line spin' : 'ri-save-line'"></i>
            {{ saving ? 'Saving...' : 'Save changes' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps({
  playlist: {
    type: Object,
    required: true,
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'save'])
const name = ref('')
const nameInput = ref(null)

const syncPlaylist = () => {
  name.value = props.playlist?.name || ''
}

watch(() => props.playlist, syncPlaylist, { immediate: true })

const canSave = computed(() => name.value.trim().length > 0)

const save = () => {
  if (!canSave.value || props.saving) return
  emit('save', {
    id: props.playlist.id,
    name: name.value.trim(),
  })
}

onMounted(async () => {
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
})
</script>

<style scoped>
.playlist-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: var(--color-background-overlay-soft);
  backdrop-filter: blur(6px);
}

.playlist-editor {
  width: min(480px, 100%);
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: 16px;
  background: var(--color-surface-modal);
  box-shadow: var(--shadow-modal);
}

.playlist-editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem 1.5rem 1.15rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.playlist-editor-eyebrow {
  color: var(--color-brand-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.playlist-editor-header h2 {
  margin: 0.25rem 0 0;
  color: var(--color-text-primary);
  font-size: 1.25rem;
  font-weight: 600;
}

.playlist-editor-header p {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.playlist-editor-close {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.2rem;
}

.playlist-editor-close:hover {
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
}

.playlist-editor-form {
  display: grid;
  gap: 1rem;
  padding: 1.25rem 1.5rem 1.5rem;
}

.playlist-editor-form label {
  display: grid;
  gap: 0.45rem;
  color: var(--color-text-secondary);
  font-size: 0.84rem;
  font-weight: 600;
}

.playlist-editor-form input {
  width: 100%;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  background: var(--color-surface-input);
  color: var(--color-text-primary);
  font: inherit;
  font-weight: 400;
  padding: 0.78rem 0.85rem;
}

.playlist-editor-form input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: var(--shadow-focus-ring);
}

.playlist-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
  padding-top: 0.25rem;
}

.playlist-editor-actions button {
  min-height: 40px;
  padding: 0.65rem 1rem;
  border-radius: 9px;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
}

.playlist-editor-cancel {
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}

.playlist-editor-save {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 0;
  background: var(--gradient-brand-primary);
  color: var(--color-text-on-brand);
}

.playlist-editor-save:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
