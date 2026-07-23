<template>
  <div class="sel-menu" :style="positionStyle" @click.stop @mousedown.prevent @touchstart.stop>
    <!-- Colour row replaces the actions once Highlight is chosen, so the menu
         never grows tall enough to cover the text being acted on. -->
    <div v-if="mode === 'colors'" class="sel-colors">
      <button
        v-for="color in colors"
        :key="color.id"
        type="button"
        class="sel-swatch"
        :class="{ active: activeColor === color.id }"
        :style="{ backgroundColor: color.value }"
        :aria-label="color.label"
        @click="$emit('highlight', color.id)"
      ></button>
      <button
        v-if="canRemove"
        type="button"
        class="sel-swatch remove"
        aria-label="Remove highlight"
        @click="$emit('remove')"
      >
        <i class="ri-delete-bin-line"></i>
      </button>
    </div>

    <div v-else class="sel-actions">
      <button type="button" @click="$emit('read')">
        <i class="ri-play-circle-line"></i>
        <span>Read from here</span>
      </button>
      <button type="button" @click="$emit('copy')">
        <i class="ri-file-copy-line"></i>
        <span>Copy</span>
      </button>
      <button type="button" @click="mode = 'colors'">
        <i class="ri-mark-pen-line"></i>
        <span>Highlight</span>
      </button>
      <button type="button" @click="$emit('dictionary')">
        <i class="ri-book-2-line"></i>
        <span>Dictionary</span>
      </button>
      <button type="button" @click="$emit('note')">
        <i class="ri-sticky-note-line"></i>
        <span>{{ hasNote ? 'Edit note' : 'Make note' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { HIGHLIGHT_COLORS } from '~/composables/useAnnotations'

const props = defineProps({
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  activeColor: { type: String, default: '' },
  canRemove: { type: Boolean, default: false },
  hasNote: { type: Boolean, default: false },
  // Opening straight onto the colours when re-tapping an existing highlight
  // saves a step, since changing or removing it is the likely intent.
  startOnColors: { type: Boolean, default: false },
})

defineEmits(['read', 'copy', 'highlight', 'dictionary', 'note', 'remove'])

const colors = HIGHLIGHT_COLORS
const mode = ref(props.startOnColors ? 'colors' : 'actions')

watch(() => props.startOnColors, (value) => { mode.value = value ? 'colors' : 'actions' })

const MENU_WIDTH = 300

const positionStyle = computed(() => {
  const maxLeft = (typeof window !== 'undefined' ? window.innerWidth : 360) - MENU_WIDTH - 12
  return {
    left: `${Math.max(12, Math.min(props.x - MENU_WIDTH / 2, Math.max(12, maxLeft)))}px`,
    top: `${Math.max(64, props.y)}px`,
  }
})
</script>

<style scoped>
.sel-menu {
  position: fixed;
  z-index: 3200;
  width: 300px;
  padding: 6px;
  border-radius: 14px;
  background: var(--mobile-reader-surface, #fff);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.28);
}

.sel-actions {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;
}

.sel-actions button {
  display: grid;
  gap: 3px;
  justify-items: center;
  padding: 8px 2px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--mobile-reader-text, #222);
  cursor: pointer;
  font: inherit;
}

.sel-actions button i {
  font-size: 18px;
}

.sel-actions button span {
  font-size: 10px;
  line-height: 1.15;
  text-align: center;
}

.sel-actions button:active {
  background: color-mix(in srgb, var(--mobile-reader-text, #222) 10%, transparent);
}

.sel-colors {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 6px;
  padding: 6px 4px;
}

.sel-swatch {
  width: 34px;
  height: 34px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
}

.sel-swatch.active {
  border-color: var(--mobile-reader-text, #222);
}

.sel-swatch.remove {
  display: grid;
  place-items: center;
  border-color: color-mix(in srgb, var(--mobile-reader-text, #222) 25%, transparent);
  background: transparent;
  color: var(--mobile-reader-text, #222);
  font-size: 16px;
}
</style>
