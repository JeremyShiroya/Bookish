<template>
  <div v-if="loading" class="multi-step-loader" role="status" aria-live="polite">
    <div class="loader-orbit" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>

    <div class="loader-copy">
      <p class="loader-eyebrow">{{ eyebrow }}</p>
      <h3>{{ activeText }}</h3>
      <p v-if="detail" class="loader-detail">{{ detail }}</p>
    </div>

    <div class="loader-steps">
      <div
        v-for="(state, index) in normalizedStates"
        :key="state.id || state.text"
        class="loader-step"
        :class="stepClass(state, index)"
      >
        <span class="step-marker">
          <i v-if="stepStatus(state, index) === 'success'" class="ri-check-line"></i>
          <i v-else-if="stepStatus(state, index) === 'error'" class="ri-close-line"></i>
          <i v-else-if="stepStatus(state, index) === 'skipped'" class="ri-subtract-line"></i>
          <i v-else-if="stepStatus(state, index) === 'active'" class="ri-loader-4-line"></i>
          <span v-else>{{ index + 1 }}</span>
        </span>
        <span class="step-body">
          <span class="step-text">{{ state.text }}</span>
          <span v-if="state.detail" class="step-detail">{{ state.detail }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  loadingStates: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  duration: {
    type: Number,
    default: 1600,
  },
  loop: {
    type: Boolean,
    default: true,
  },
  value: {
    type: Number,
    default: null,
  },
  eyebrow: {
    type: String,
    default: 'Working through the search',
  },
  detail: {
    type: String,
    default: '',
  },
})

const currentIndex = ref(0)
let intervalId = null

const normalizedStates = computed(() => props.loadingStates
  .map((state) => (typeof state === 'string' ? { text: state } : state))
  .filter((state) => state?.text))

const hasControlledStatuses = computed(() => normalizedStates.value.some((state) => state.status))

const activeIndex = computed(() => {
  const max = Math.max(normalizedStates.value.length - 1, 0)
  if (typeof props.value === 'number') {
    return Math.min(Math.max(props.value, 0), max)
  }
  if (hasControlledStatuses.value) {
    const active = normalizedStates.value.findIndex((state) => state.status === 'active')
    if (active !== -1) return active
    const failed = normalizedStates.value.findIndex((state) => state.status === 'error')
    if (failed !== -1) return failed
    const firstPending = normalizedStates.value.findIndex((state) => !state.status || state.status === 'pending')
    if (firstPending !== -1) return firstPending
    return max
  }
  return Math.min(currentIndex.value, max)
})

const activeText = computed(() => normalizedStates.value[activeIndex.value]?.text || 'Searching...')

const stepStatus = (state, index) => {
  if (state.status) return state.status
  if (typeof props.value === 'number' || !hasControlledStatuses.value) {
    if (index < activeIndex.value) return 'success'
    if (index === activeIndex.value) return 'active'
  }
  return 'pending'
}

const stepClass = (state, index) => {
  const status = stepStatus(state, index)
  return {
    done: status === 'success',
    active: status === 'active',
    failed: status === 'error',
    skipped: status === 'skipped',
  }
}

const stopTimer = () => {
  if (!intervalId) return
  clearInterval(intervalId)
  intervalId = null
}

const startTimer = () => {
  stopTimer()
  currentIndex.value = 0
  if (!props.loading || typeof props.value === 'number' || hasControlledStatuses.value || normalizedStates.value.length <= 1) return

  intervalId = setInterval(() => {
    const lastIndex = normalizedStates.value.length - 1
    if (currentIndex.value >= lastIndex) {
      currentIndex.value = props.loop ? 0 : lastIndex
      if (!props.loop) stopTimer()
      return
    }

    currentIndex.value += 1
  }, props.duration)
}

watch(
  () => [props.loading, props.duration, props.value, normalizedStates.value.length, props.loop],
  startTimer,
  { immediate: true },
)

onBeforeUnmount(stopTimer)
</script>

<style scoped>
.multi-step-loader {
  padding: 1.5rem;
  color: var(--color-text-primary);
}

.loader-orbit {
  position: relative;
  width: 58px;
  height: 58px;
  margin: 0 auto 1rem;
}

.loader-orbit span {
  position: absolute;
  inset: 0;
  border: 1px solid var(--color-brand-primary);
  border-radius: 999px;
  opacity: 0.25;
  animation: loader-ring 1.9s ease-in-out infinite;
}

.loader-orbit span:nth-child(2) {
  animation-delay: 0.25s;
  transform: scale(0.72);
}

.loader-orbit span:nth-child(3) {
  animation-delay: 0.5s;
  transform: scale(0.44);
  background: var(--color-brand-primary-faint);
}

.loader-copy {
  text-align: center;
  margin-bottom: 1.25rem;
}

.loader-eyebrow {
  margin: 0 0 0.3rem;
  color: var(--color-brand-primary);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.loader-copy h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1rem;
  line-height: 1.35;
}

.loader-detail {
  margin: 0.5rem auto 0;
  max-width: 420px;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1.45;
}

.loader-steps {
  display: grid;
  gap: 0.55rem;
}

.loader-step {
  display: grid;
  grid-template-columns: 30px 1fr;
  align-items: center;
  gap: 0.65rem;
  min-height: 30px;
  color: var(--color-text-muted);
  opacity: 0.68;
}

.loader-step.done,
.loader-step.active,
.loader-step.failed,
.loader-step.skipped {
  opacity: 1;
}

.step-marker {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-subtle);
  border-radius: 999px;
  background: var(--color-surface-secondary);
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.loader-step.done .step-marker {
  border-color: var(--color-status-success-border);
  background: var(--color-status-success-soft);
  color: var(--color-status-success);
}

.loader-step.active .step-marker {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-primary-faint);
  color: var(--color-brand-primary);
}

.loader-step.failed .step-marker {
  border-color: var(--color-status-danger-border);
  background: var(--color-status-danger-soft);
  color: var(--color-status-danger);
}

.loader-step.skipped .step-marker {
  border-color: var(--color-status-warning-border);
  background: var(--color-status-warning-soft);
  color: var(--color-status-warning);
}

.loader-step.active .step-marker i {
  animation: spin 0.85s linear infinite;
}

.step-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.step-text {
  color: currentColor;
  font-size: 0.9rem;
  line-height: 1.35;
}

.loader-step.active .step-text {
  color: var(--color-text-primary);
}

.loader-step.failed .step-text {
  color: var(--color-status-danger);
}

.loader-step.done .step-text {
  color: var(--color-text-primary);
}

.step-detail {
  color: var(--color-text-subtle);
  font-size: 0.76rem;
  line-height: 1.3;
}

@keyframes loader-ring {
  0%, 100% {
    transform: scale(0.5);
    opacity: 0.22;
  }
  50% {
    transform: scale(1);
    opacity: 0.75;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
