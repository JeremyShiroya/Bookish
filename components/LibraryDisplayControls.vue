<template>
  <div class="library-display-controls">
    <div
      ref="statusChipsRef"
      class="status-chips"
      @mouseleave="statusHoverIndex = -1"
    >
      <div
        class="chip-highlight"
        :class="{ 'is-active': statusHighlightActive }"
        :style="statusHighlightStyle"
      ></div>
      <button
        v-for="(option, index) in statusOptions"
        :key="option.value"
        type="button"
        class="status-chip"
        :class="{ active: status === option.value }"
        @click="$emit('update:status', option.value)"
        @mouseenter="statusHoverIndex = index"
      >
        {{ option.label }}
      </button>
    </div>

    <div
      ref="viewChipsRef"
      class="view-chips"
      @mouseleave="viewHoverIndex = -1"
    >
      <div
        class="chip-highlight"
        :class="{ 'is-active': viewHighlightActive }"
        :style="viewHighlightStyle"
      ></div>
      <button
        v-for="(option, index) in viewOptions"
        :key="option.value"
        type="button"
        class="status-chip view-chip-icon"
        :class="{ active: view === option.value }"
        :aria-label="`${option.label} view`"
        :title="`${option.label} view`"
        @click="$emit('update:view', option.value)"
        @mouseenter="viewHoverIndex = index"
      >
        <i :class="option.icon"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  status: { type: String, default: 'all' },
  view: { type: String, default: 'table' },
})

defineEmits(['update:status', 'update:view'])

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'Unread', label: 'Unread' },
  { value: 'Reading', label: 'Reading' },
  { value: 'Read', label: 'Read' },
]
const viewOptions = [
  { value: 'grid', label: 'Grid', icon: 'ri-apps-2-line' },
  { value: 'table', label: 'Table', icon: 'ri-list-unordered' },
]

const statusChipsRef = ref(null)
const viewChipsRef = ref(null)
const statusHoverIndex = ref(-1)
const viewHoverIndex = ref(-1)
const statusHighlightStyle = ref({ left: '0px', width: '0px', opacity: 0 })
const viewHighlightStyle = ref({ left: '0px', width: '0px', opacity: 0 })
const statusHighlightActive = ref(false)
const viewHighlightActive = ref(false)

const activeStatusIndex = computed(() => Math.max(
  0,
  statusOptions.findIndex(option => option.value === props.status),
))
const activeViewIndex = computed(() => Math.max(
  0,
  viewOptions.findIndex(option => option.value === props.view),
))

const updateHighlight = async (elementRef, hoverIndex, activeIndex, styleRef, activeRef) => {
  await nextTick()
  if (!elementRef.value) return
  const targetIndex = hoverIndex.value === -1 ? activeIndex.value : hoverIndex.value
  activeRef.value = hoverIndex.value === -1 || targetIndex === activeIndex.value
  const target = elementRef.value.querySelectorAll('.status-chip')[targetIndex]
  if (!target) return
  styleRef.value = {
    left: `${target.offsetLeft}px`,
    width: `${target.offsetWidth}px`,
    opacity: 1,
  }
}

const updateStatusHighlight = () => updateHighlight(
  statusChipsRef,
  statusHoverIndex,
  activeStatusIndex,
  statusHighlightStyle,
  statusHighlightActive,
)
const updateViewHighlight = () => updateHighlight(
  viewChipsRef,
  viewHoverIndex,
  activeViewIndex,
  viewHighlightStyle,
  viewHighlightActive,
)
const updateAllHighlights = () => {
  updateStatusHighlight()
  updateViewHighlight()
}

watch([activeStatusIndex, statusHoverIndex], updateStatusHighlight)
watch([activeViewIndex, viewHoverIndex], updateViewHighlight)
onMounted(() => {
  updateAllHighlights()
  window.addEventListener('resize', updateAllHighlights)
})
onUnmounted(() => window.removeEventListener('resize', updateAllHighlights))
</script>

<style scoped>
.library-display-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1rem 1.25rem;
}

.status-chips,
.view-chips {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
}

.view-chips {
  border-color: var(--color-border-subtle);
}

.chip-highlight {
  position: absolute;
  top: 4px;
  bottom: 4px;
  z-index: 0;
  border-radius: 8px;
  background: var(--color-surface-hover);
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.chip-highlight.is-active {
  background: var(--purple-li-active);
}

.status-chip {
  position: relative;
  z-index: 1;
  padding: 0.4rem 0.9rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition: color 0.3s ease;
}

.status-chip.active {
  color: var(--color-brand-primary);
  font-weight: 500;
}

.view-chip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.65rem;
  font-size: 1.05rem;
  line-height: 1;
}

.view-chip-icon i {
  display: inline-flex;
}
</style>
