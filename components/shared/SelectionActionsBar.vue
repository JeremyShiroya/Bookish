<template>
  <div class="selection-actions" role="toolbar" :aria-label="`${count} selected`">
    <span class="selection-count">{{ count }}</span>

    <button
      v-for="action in actions"
      :key="action.key"
      type="button"
      class="selection-action"
      :class="{ danger: action.danger }"
      :aria-label="action.label"
      :title="action.label"
      @click="emit('action', action.key)"
    >
      <i :class="action.icon"></i>
    </button>

    <button
      type="button"
      class="selection-action clear"
      aria-label="Clear selection"
      title="Clear selection"
      @click="emit('clear')"
    >
      <i class="ri-close-line"></i>
    </button>
  </div>
</template>

<script setup>
// The bulk-action row that takes over a page's toolbar while items are
// selected. It renders whatever actions the page hands it, so Books offers
// favourite/playlist/hide/delete and Playlists offers its own set.
defineProps({
  count: { type: Number, default: 0 },
  // [{ key, icon, label, danger }]
  actions: { type: Array, default: () => [] },
})

const emit = defineEmits(['action', 'clear'])
</script>

<style scoped>
.selection-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.selection-count {
  min-width: 22px;
  margin-right: 2px;
  color: var(--color-brand-primary);
  font-size: var(--mobile-caption-size, 0.78rem);
  font-weight: 700;
  text-align: center;
}

/* Same footprint as the view chips they replace, so the toolbar does not jump
   when selection mode opens. */
.selection-action {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--mobile-control-radius);
  background: rgba(138, 43, 226, 0.07);
  color: var(--color-brand-primary);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.selection-action.danger {
  color: var(--color-status-danger-bright, #dc2626);
}

.selection-action.clear {
  background: transparent;
  color: var(--color-text-muted);
}
</style>
