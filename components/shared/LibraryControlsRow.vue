<template>
  <div class="controls-row">
    <div class="controls-left">
      <div class="filter-dropdown">
        <button
          type="button"
          class="filter-button"
          :class="{ open: filterOpen }"
          @click="filterOpen = !filterOpen"
        >
          <i class="ri-filter-3-line"></i>
          <span class="filter-label-text">Filter</span>
          <span v-if="hasActiveFilter" class="filter-active-dot"></span>
          <i class="ri-arrow-down-s-line dropdown-arrow" :class="{ rotated: filterOpen }"></i>
        </button>

        <div v-show="filterOpen" class="dropdown-menu filter-panel">
          <div v-for="section in resolvedSections" :key="section.key" class="sfp-section">
            <div class="sfp-section-header">
              <i :class="section.icon"></i>
              {{ section.label }}
            </div>
            <div class="sfp-pills">
              <button
                v-for="option in section.options"
                :key="option.value"
                type="button"
                class="sfp-pill"
                :class="{ active: valueFor(section) === option.value }"
                @click="select(section, option.value)"
              >{{ option.label }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="controls-right">
      <!-- Bulk selection takes this corner over: the view toggle is meaningless
           while books are being picked, and the actions belong where the eye
           already is. -->
      <slot name="actions">
      <div v-if="!hideView" class="view-chips">
        <button
          type="button"
          class="view-chip-icon"
          :class="{ active: view === 'grid' }"
          aria-label="Grid view"
          title="Grid view"
          @click="emit('update:view', 'grid')"
        >
          <i class="ri-apps-2-line"></i>
        </button>
        <button
          type="button"
          class="view-chip-icon"
          :class="{ active: view === 'list' }"
          aria-label="List view"
          title="List view"
          @click="emit('update:view', 'list')"
        >
          <i class="ri-list-unordered"></i>
        </button>
      </div>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  FORMAT_FILTER_CHOICES,
  useBookishSettings,
} from '~/composables/useBookishSettings';

const props = defineProps({
  status: {
    type: String,
    default: 'all',
  },
  view: {
    type: String,
    default: 'grid',
  },
  // Extra filter groups, appended after the built-in Status/Format pair:
  //   [{ key, label, icon, options: [{ value, label }], default }]
  // Their current values live in `values`, so a page can name its own filters
  // (Series has "Books collected", Playlists sorts by name) without every page
  // growing its own copy of this control.
  sections: {
    type: Array,
    default: () => [],
  },
  values: {
    type: Object,
    default: () => ({}),
  },
  // Series groups are not books, so the library-wide Status/Format pair does
  // not apply to them.
  builtInFilters: {
    type: Boolean,
    default: true,
  },
  // Series cards have one layout, so there is nothing to toggle between.
  hideView: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:status', 'update:view', 'update:values']);

const { settings, updateSettings } = useBookishSettings();

const readingStatuses = ['Unread', 'Reading', 'Read'];
const formatFilters = FORMAT_FILTER_CHOICES;
const filterOpen = ref(false);

// Format is a library-wide setting, so every Filter panel reads and writes the
// same value rather than keeping its own copy.
const selectedFormat = computed(() => settings.value.formatFilter || 'all');

const STATUS_KEY = '__status';
const FORMAT_KEY = '__format';

const builtInSections = computed(() => (props.builtInFilters
  ? [
    {
      key: STATUS_KEY,
      label: 'Status',
      icon: 'ri-bookmark-line',
      options: [
        { value: 'all', label: 'All' },
        ...readingStatuses.map((option) => ({ value: option, label: option })),
      ],
    },
    {
      key: FORMAT_KEY,
      label: 'Format',
      icon: 'ri-file-list-2-line',
      options: formatFilters.map((format) => ({ value: format.value, label: format.label })),
    },
  ]
  : []));

const resolvedSections = computed(() => [...builtInSections.value, ...props.sections]);

const defaultFor = (section) => section.default ?? section.options?.[0]?.value;

const valueFor = (section) => {
  if (section.key === STATUS_KEY) return props.status;
  if (section.key === FORMAT_KEY) return selectedFormat.value;
  return props.values[section.key] ?? defaultFor(section);
};

const select = (section, value) => {
  if (section.key === STATUS_KEY) emit('update:status', value);
  else if (section.key === FORMAT_KEY) updateSettings({ formatFilter: value });
  else emit('update:values', { ...props.values, [section.key]: value });
  filterOpen.value = false;
};

// The dot means "this list is not showing you everything", so it lights for any
// section sitting away from its default.
const hasActiveFilter = computed(() => resolvedSections.value.some(
  (section) => valueFor(section) !== defaultFor(section),
));

const closeOnOutsideClick = (event) => {
  if (!event.target.closest('.filter-dropdown')) filterOpen.value = false;
};

onMounted(() => document.addEventListener('click', closeOnOutsideClick));
onUnmounted(() => document.removeEventListener('click', closeOnOutsideClick));
</script>

<style scoped>
.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-dropdown {
  position: relative;
}

.filter-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--color-border-card);
  border-radius: var(--mobile-control-radius);
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--mobile-caption-size);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.filter-button.open {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary-faint);
  color: var(--color-text-primary);
}

.filter-button > i:first-child {
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.filter-button.open > i:first-child {
  color: var(--color-brand-primary);
}

.filter-label-text {
  font-weight: 500;
}

.filter-active-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-brand-primary);
}

.filter-button .dropdown-arrow {
  font-size: 1rem;
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}

.filter-button .dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.filter-panel {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  z-index: 50;
  min-width: 240px;
  padding: 0.5rem;
  border: 1px solid var(--color-border-card);
  border-radius: 14px;
  background: var(--color-background-app);
  box-shadow: var(--shadow-modal);
}

.sfp-section {
  padding: 0.6rem 0.5rem;
}

.sfp-section-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.55rem;
  color: var(--color-text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.sfp-section-header i {
  color: var(--color-brand-primary);
  font-size: 0.85rem;
  opacity: 0.75;
}

.sfp-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.sfp-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.32rem 0.8rem;
  border: 1px solid var(--color-border-card);
  border-radius: 20px;
  background: transparent;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--mobile-caption-size);
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.sfp-pill.active {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-hover);
  color: var(--color-brand-primary);
  font-weight: 500;
}

.view-chips {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.view-chip-icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--mobile-control-radius);
  background: rgba(138, 43, 226, 0.07);
  color: var(--color-text-subtle);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.view-chip-icon.active {
  background: var(--color-surface-hover);
  color: var(--color-brand-primary);
}
</style>
