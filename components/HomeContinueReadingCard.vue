<template>
  <button class="continue-card" type="button" @click="$emit('open', book)">
    <span
      class="continue-bg"
      :style="book.cover ? { backgroundImage: `url(${book.cover})` } : {}"
    ></span>
    <span class="continue-overlay"></span>
    <span class="continue-cover-wrap">
      <img
        v-if="book.cover"
        class="continue-cover"
        :src="book.cover"
        :alt="book.title"
      />
      <span v-else class="continue-cover fallback-cover">{{ bookInitial }}</span>
    </span>
    <span class="continue-info">
      <span class="continue-title">{{ book.title }}</span>
      <span class="continue-meta">{{ book.author || "Unknown author" }} · {{ bookYear }}</span>
      <span class="continue-progress-track">
        <span class="continue-progress-fill" :style="{ width: `${progress}%` }"></span>
      </span>
      <span class="continue-stats">
        <span>{{ progress }}% complete</span>
        <span>Page {{ currentPage }} of {{ totalPages }}</span>
      </span>
    </span>
  </button>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  book: {
    type: Object,
    required: true,
  },
});

defineEmits(["open"]);

const progress = computed(() => Math.max(0, Math.min(100, Math.round(Number(props.book.progress) || 0))));
const totalPages = computed(() => Math.max(1, Math.round(Number(props.book.pages) || 1)));
const currentPage = computed(() => Math.max(1, Math.min(totalPages.value, Math.round((progress.value / 100) * totalPages.value) || 1)));
const bookYear = computed(() => props.book.publishYear || props.book.publish_year || "2020");
const bookInitial = computed(() => props.book.title?.trim()?.charAt(0)?.toUpperCase() || "?");
</script>

<style scoped>
.continue-card {
  position: relative;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  width: 100%;
  min-width: 0;
  height: 94px;
  padding: 11px 16px 11px 12px;
  overflow: hidden;
  border: 0;
  border-radius: 15px;
  color: var(--color-text-on-brand);
  text-align: left;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.13);
}

.continue-bg,
.continue-overlay {
  position: absolute;
  inset: 0;
}

.continue-bg {
  background: #233647;
  background-size: cover;
  background-position: center;
  filter: blur(18px) saturate(1.25);
  transform: scale(1.2);
}

.continue-overlay {
  background:
    linear-gradient(90deg, rgba(13, 27, 38, 0.9), rgba(28, 47, 60, 0.64)),
    rgba(13, 27, 38, 0.5);
}

.continue-cover-wrap {
  position: relative;
  z-index: 1;
  width: 56px;
  height: 70px;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.continue-cover {
  display: flex;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fallback-cover {
  align-items: center;
  justify-content: center;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  font-size: 1.4rem;
}

.continue-info {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.continue-title,
.continue-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.continue-title {
  font-size: 1rem;
  line-height: 1.1;
}

.continue-meta {
  margin-top: 4px;
  color: var(--color-text-on-image-secondary);
  font-size: 0.72rem;
}

.continue-progress-track {
  display: block;
  height: 5px;
  margin-top: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
}

.continue-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--gradient-library-progress);
}

.continue-stats {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
  color: var(--color-text-on-image-secondary);
  font-size: 0.68rem;
  line-height: 1;
  white-space: nowrap;
}
</style>
