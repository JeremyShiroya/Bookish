<template>
  <div v-if="visible" class="cover-modal-overlay" @click="$emit('close')">
    <div class="cover-modal" @click.stop>
      <div class="cover-modal-header">
        <div>
          <h3>{{ mode === 'picker' ? 'Select Book Cover' : 'Change Book Cover' }}</h3>
          <p v-if="mode === 'picker' && !loading">Found {{ visibleImages.length }} cover options</p>
          <p v-else-if="mode === 'picker'">Searching the web for covers...</p>
          <p v-else>Choose how you want to update the cover</p>
        </div>
        <button class="cover-modal-close" type="button" @click="$emit('close')">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <div v-if="mode === 'choice'" class="cover-choice-grid">
        <button class="cover-choice-btn" type="button" @click="$emit('upload')">
          <i class="ri-upload-2-line"></i>
          <span>
            <strong>Upload Cover</strong>
            <small>Choose an image from this device</small>
          </span>
        </button>
        <button class="cover-choice-btn" type="button" @click="$emit('search')">
          <i class="ri-global-line"></i>
          <span>
            <strong>Search Web</strong>
            <small>Find covers using book metadata</small>
          </span>
        </button>
      </div>

      <div v-else>
        <div v-if="loading" class="cover-picker-loading">
          <SkeletonLoader variant="favourites-grid" :count="6" />
        </div>

        <div v-else-if="visibleImages.length" class="cover-picker-grid">
          <button
            v-for="image in visibleImages"
            :key="image"
            class="cover-picker-item"
            type="button"
            @click="$emit('select', image)"
          >
            <img :src="image" alt="Book cover option" loading="lazy" @error="markImageFailed(image)" />
            <span class="cover-picker-check">
              <i class="ri-check-line"></i>
            </span>
          </button>
        </div>

        <div v-else class="cover-empty">
          No cover options found.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'choice' },
  loading: { type: Boolean, default: false },
  images: { type: Array, default: () => [] },
})

const failedImages = ref(new Set())
const visibleImages = computed(() => props.images.filter((image) => !failedImages.value.has(image)))

watch(() => props.images, () => {
  failedImages.value = new Set()
})

const markImageFailed = (image) => {
  const next = new Set(failedImages.value)
  next.add(image)
  failedImages.value = next
}

defineEmits(['close', 'upload', 'search', 'select'])
</script>

<style scoped>
.cover-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-background-overlay);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3200;
  padding: 1rem;
}

.cover-modal {
  width: min(100%, 760px);
  max-height: 82vh;
  overflow: hidden;
  background: var(--color-surface-primary);
  border-radius: 16px;
  box-shadow: var(--shadow-modal);
  display: flex;
  flex-direction: column;
}

.cover-modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.cover-modal-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.2rem;
  font-weight: 400;
}

.cover-modal-header p {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.cover-modal-close {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.35rem;
}

.cover-modal-close:hover {
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
}

.cover-choice-grid {
  padding: 1.5rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.cover-choice-btn {
  min-height: 110px;
  padding: 1.25rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  background: var(--color-surface-primary);
  display: flex;
  align-items: center;
  gap: 1rem;
  text-align: left;
  cursor: pointer;
}

.cover-choice-btn:hover {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-secondary);
}

.cover-choice-btn i {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-active);
  color: var(--color-brand-primary);
  font-size: 1.5rem;
}

.cover-choice-btn strong,
.cover-choice-btn small {
  display: block;
}

.cover-choice-btn strong {
  color: var(--color-text-primary);
  font-size: 1rem;
  font-weight: 400;
}

.cover-choice-btn small {
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}

.cover-picker-loading,
.cover-empty {
  padding: 1.5rem;
}

.cover-empty {
  color: var(--color-text-muted);
}

.cover-picker-grid {
  padding: 1.5rem;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 1rem;
}

.cover-picker-item {
  position: relative;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  padding: 0;
  background: var(--color-surface-secondary);
  aspect-ratio: 2 / 3;
  overflow: hidden;
  cursor: pointer;
}

.cover-picker-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-picker-check {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--color-background-overlay-soft);
  color: var(--color-text-on-brand);
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 1.5rem;
}

.cover-picker-item:hover .cover-picker-check {
  opacity: 1;
}

@media (max-width: 640px) {
  .cover-choice-grid {
    grid-template-columns: 1fr;
  }
}
</style>
