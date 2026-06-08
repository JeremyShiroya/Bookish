<template>
  <div v-if="visible" class="author-image-overlay" @click="$emit('close')">
    <section class="author-image-modal" role="dialog" aria-modal="true" aria-labelledby="author-image-title" @click.stop>
      <header>
        <div>
          <span class="eyebrow">Author profile</span>
          <h2 id="author-image-title">{{ title }}</h2>
          <p>{{ subtitle }}</p>
        </div>
        <button type="button" class="close-button" aria-label="Close" @click="$emit('close')">
          <i class="ri-close-line"></i>
        </button>
      </header>

      <div v-if="stage === 'choice'" class="choice-grid">
        <button type="button" @click="$emit('upload')">
          <i class="ri-upload-2-line"></i>
          <span>
            <strong>Upload image</strong>
            <small>Choose a portrait from this device</small>
          </span>
        </button>
        <button type="button" @click="$emit('search')">
          <i class="ri-global-line"></i>
          <span>
            <strong>Search the web</strong>
            <small>Compare portraits from multiple sources</small>
          </span>
        </button>
      </div>

      <div v-else-if="loading" class="search-progress">
        <MultiStepLoader
          :loading="true"
          :loading-states="loadingStates"
          :duration="1200"
          :loop="false"
          eyebrow="Author image search in progress"
          detail="Results are combined, ranked, and deduplicated before they are shown."
        />
      </div>

      <div v-else-if="images.length" class="image-grid">
        <button
          v-for="image in images"
          :key="image.url"
          type="button"
          class="image-option"
          :title="image.label"
          @click="$emit('select', image)"
        >
          <img :src="image.url" :alt="`${authorName} from ${image.label}`" loading="lazy" @error="$emit('image-error', image)" />
          <span class="image-source">
            <i class="ri-global-line"></i>
            {{ image.label }}
          </span>
          <span class="image-check"><i class="ri-check-line"></i></span>
        </button>
      </div>

      <div v-else class="empty-results">
        <i class="ri-image-line"></i>
        <p>No suitable portraits were found.</p>
        <button type="button" @click="$emit('search')">Search again</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MultiStepLoader from './MultiStepLoader.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  stage: { type: String, default: 'choice' },
  loading: { type: Boolean, default: false },
  authorName: { type: String, default: '' },
  images: { type: Array, default: () => [] },
})

defineEmits(['close', 'upload', 'search', 'select', 'image-error'])

const title = computed(() => (
  props.stage === 'choice' ? 'Change author image' : 'Select an author image'
))
const subtitle = computed(() => {
  if (props.stage === 'choice') return 'Upload your own portrait or search trusted web sources.'
  if (props.loading) return `Searching for ${props.authorName}...`
  return `${props.images.length} source-labelled options for ${props.authorName}`
})

const loadingStates = [
  { text: 'Checking Wikipedia and Wikidata portraits' },
  { text: 'Searching Goodreads and Open Library profiles' },
  { text: 'Searching Google, Bing, and publisher sites' },
  { text: 'Checking Wikimedia Commons and DuckDuckGo' },
  { text: 'Ranking portraits and removing duplicates' },
]
</script>

<style scoped>
.author-image-overlay {
  position: fixed;
  inset: 0;
  z-index: 3300;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: var(--color-background-overlay);
  backdrop-filter: blur(5px);
}

.author-image-modal {
  width: min(820px, 100%);
  max-height: 84vh;
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: 18px;
  background: var(--color-surface-primary);
  box-shadow: var(--shadow-modal);
}

header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

header h2,
header p {
  margin: 0;
}

header h2 {
  margin-top: 0.2rem;
  color: var(--color-text-primary);
  font-size: 1.3rem;
  font-weight: 500;
}

header p {
  margin-top: 0.35rem;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}

.eyebrow {
  color: var(--color-brand-primary);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.close-button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.3rem;
}

.close-button:hover {
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
}

.choice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  padding: 1.5rem;
}

.choice-grid button {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 116px;
  padding: 1.25rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 14px;
  background: var(--color-surface-primary);
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
}

.choice-grid button:hover {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-secondary);
}

.choice-grid button > i {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  border-radius: 12px;
  background: var(--color-surface-active);
  color: var(--color-brand-primary);
  font-size: 1.5rem;
}

.choice-grid strong,
.choice-grid small {
  display: block;
}

.choice-grid small {
  margin-top: 0.25rem;
  color: var(--color-text-muted);
}

.search-progress,
.empty-results {
  padding: 1.5rem;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  max-height: 62vh;
  overflow-y: auto;
  padding: 1.5rem;
}

.image-option {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  background: var(--color-surface-secondary);
  cursor: pointer;
}

.image-option img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-source {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0.55rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.88), rgba(0, 0, 0, 0.25));
  color: white;
  font-size: 0.7rem;
}

.image-check {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--color-background-overlay-soft);
  color: white;
  font-size: 2rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-option:hover .image-check {
  opacity: 1;
}

.empty-results {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  color: var(--color-text-muted);
}

.empty-results > i {
  font-size: 2rem;
}

.empty-results button {
  border: 0;
  border-radius: 9px;
  padding: 0.55rem 0.9rem;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  cursor: pointer;
}

@media (max-width: 620px) {
  .choice-grid {
    grid-template-columns: 1fr;
  }
}
</style>
