<template>
  <div class="pl-delete-overlay" role="presentation" @click="emit('close')">
    <section
      class="pl-delete-sheet"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pl-delete-title"
      aria-describedby="pl-delete-description"
      @click.stop
    >
      <span class="sheet-grabber" aria-hidden="true"></span>

      <div class="pl-delete-icon" aria-hidden="true">
        <i class="ri-play-list-2-line"></i>
      </div>

      <h2 id="pl-delete-title">
        {{ isBulk ? `Delete these ${count} playlists?` : 'Delete this playlist?' }}
      </h2>
      <p id="pl-delete-description" class="pl-delete-description">
        <strong>{{ isBulk ? `${count} playlists` : playlist.name }}</strong> will be removed. The
        books in {{ isBulk ? 'them' : 'it' }} stay in your library — only the
        {{ isBulk ? 'playlists are' : 'playlist is' }} deleted.
      </p>

      <div class="pl-delete-actions">
        <button type="button" class="pl-delete-cancel" @click="emit('close')">Cancel</button>
        <button type="button" class="pl-delete-confirm" @click="emit('confirm')">
          <i class="ri-delete-bin-line"></i>
          {{ isBulk ? 'Delete playlists' : 'Delete playlist' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  playlist: {
    type: Object,
    required: true,
  },
  // Bulk delete reuses this sheet rather than growing a near-copy of the same
  // warning that would drift from it.
  count: {
    type: Number,
    default: 1,
  },
})

const emit = defineEmits(['close', 'confirm'])

const isBulk = computed(() => props.count > 1)
</script>

<style scoped>
.pl-delete-overlay {
  position: fixed;
  inset: 0;
  z-index: 3400;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  background: rgba(0, 0, 0, 0.5);
}

.pl-delete-sheet {
  width: 100%;
  max-width: 520px;
  padding: 0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
  border-radius: 24px 24px 0 0;
  background: var(--color-surface-primary);
  color: var(--color-text-primary);
  text-align: center;
}

.sheet-grabber {
  display: block;
  width: 40px;
  height: 4px;
  margin: 0 auto 1rem;
  border-radius: 999px;
  background: var(--color-border-subtle);
}

.pl-delete-icon {
  display: grid;
  width: 52px;
  height: 52px;
  margin: 0 auto 0.75rem;
  place-items: center;
  border-radius: 14px;
  background: var(--color-status-danger-faint, rgba(220, 38, 38, 0.12));
  color: var(--color-status-danger-bright, #dc2626);
  font-size: 1.5rem;
}

.pl-delete-sheet h2 {
  margin: 0 0 0.4rem;
  font-size: 1.2rem;
  font-weight: 700;
}

.pl-delete-description {
  margin: 0 0 1.25rem;
  color: var(--color-text-secondary);
  font-size: 0.92rem;
  line-height: 1.5;
}

.pl-delete-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.pl-delete-cancel,
.pl-delete-confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.85rem;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.pl-delete-cancel {
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-input);
  color: var(--color-text-primary);
}

.pl-delete-confirm {
  background: var(--color-status-danger-bright, #dc2626);
  color: #fff;
}
</style>
