<template>
  <div ref="rootRef" class="bookish-listbox" :class="{ compact, open: isOpen, disabled }">
    <button
      :id="resolvedId"
      type="button"
      class="bookish-listbox-trigger"
      role="combobox"
      :aria-expanded="isOpen"
      :aria-controls="`${resolvedId}-options`"
      aria-haspopup="listbox"
      :disabled="disabled"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="bookish-listbox-value">{{ selectedOption?.label || placeholder }}</span>
      <i class="ri-arrow-down-s-line bookish-listbox-arrow"></i>
    </button>

    <ul
      v-if="isOpen"
      :id="`${resolvedId}-options`"
      ref="menuRef"
      class="bookish-listbox-menu"
      role="listbox"
      :aria-labelledby="resolvedId"
      tabindex="-1"
      @keydown="onMenuKeydown"
    >
      <li
        v-for="(option, index) in normalizedOptions"
        :key="String(option.value)"
        class="bookish-listbox-option"
        :class="{
          selected: option.value === modelValue,
          highlighted: index === highlightedIndex,
          disabled: option.disabled,
        }"
        role="option"
        :aria-selected="option.value === modelValue"
        :aria-disabled="option.disabled"
        @mouseenter="highlightedIndex = index"
        @mousedown.prevent
        @click="selectOption(option)"
      >
        <span>{{ option.label }}</span>
        <i v-if="option.value === modelValue" class="ri-check-line"></i>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { nextEnabledOptionIndex, normalizeSelectOptions } from '~/composables/useSelectOptions'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select an option' },
  disabled: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  inputId: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'change'])
const id = `bookish-select-${useId()}`
const resolvedId = computed(() => props.inputId || id)
const rootRef = ref(null)
const menuRef = ref(null)
const isOpen = ref(false)
const highlightedIndex = ref(-1)
const normalizedOptions = computed(() => normalizeSelectOptions(props.options))
const selectedIndex = computed(() => normalizedOptions.value.findIndex(option => option.value === props.modelValue))
const selectedOption = computed(() => normalizedOptions.value[selectedIndex.value] || null)

function open() {
  if (props.disabled) return
  isOpen.value = true
  highlightedIndex.value = selectedIndex.value >= 0
    ? selectedIndex.value
    : nextEnabledOptionIndex(normalizedOptions.value, -1, 1)
  nextTick(() => menuRef.value?.focus?.())
}

function close() {
  isOpen.value = false
}

function toggle() {
  if (isOpen.value) close()
  else open()
}

function move(direction) {
  highlightedIndex.value = nextEnabledOptionIndex(
    normalizedOptions.value,
    highlightedIndex.value,
    direction,
  )
}

function selectOption(option) {
  if (!option || option.disabled) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  close()
  nextTick(() => rootRef.value?.querySelector('button')?.focus())
}

function onTriggerKeydown(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!isOpen.value) open()
    else move(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggle()
  } else if (event.key === 'Escape') {
    close()
  }
}

function onMenuKeydown(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectOption(normalizedOptions.value[highlightedIndex.value])
  } else if (event.key === 'Escape' || event.key === 'Tab') {
    close()
  }
}

function onDocumentPointerDown(event) {
  if (!rootRef.value?.contains(event.target)) close()
}

watch(() => props.disabled, value => {
  if (value) close()
})

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onUnmounted(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>

<style scoped>
.bookish-listbox {
  position: relative;
  width: 100%;
  min-width: 0;
}

.bookish-listbox-trigger {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem 0.65rem 0.9rem;
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  background: var(--color-surface-input);
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.16s, background 0.16s, box-shadow 0.16s;
}

.bookish-listbox-trigger:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  background: var(--color-surface-input-focus);
}

.bookish-listbox-trigger:focus-visible,
.open .bookish-listbox-trigger {
  outline: none;
  border-color: var(--color-brand-primary);
  box-shadow: var(--shadow-focus-ring);
}

.bookish-listbox-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookish-listbox-arrow {
  flex: 0 0 auto;
  color: var(--color-brand-primary);
  transition: transform 0.16s;
}

.open .bookish-listbox-arrow {
  transform: rotate(180deg);
}

.bookish-listbox-menu {
  position: absolute;
  z-index: 1000;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: min(320px, 45vh);
  overflow-y: auto;
  margin: 0;
  padding: 0.35rem;
  list-style: none;
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  background: var(--color-surface-modal);
  box-shadow: var(--shadow-modal);
}

.bookish-listbox-option {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  border-radius: 7px;
  color: var(--color-text-primary);
  cursor: pointer;
}

.bookish-listbox-option.highlighted {
  background: var(--color-surface-hover);
}

.bookish-listbox-option.selected {
  color: var(--color-brand-primary);
  background: var(--color-brand-primary-faint);
}

.bookish-listbox-option.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.compact {
  width: min(190px, 24vw);
}

.compact .bookish-listbox-trigger {
  min-height: 32px;
  padding: 0.35rem 0.55rem 0.35rem 0.65rem;
  border-radius: 7px;
  font-size: 0.76rem;
}

.compact .bookish-listbox-menu {
  top: auto;
  bottom: calc(100% + 6px);
  min-width: 190px;
}

.disabled {
  opacity: 0.55;
}
</style>
