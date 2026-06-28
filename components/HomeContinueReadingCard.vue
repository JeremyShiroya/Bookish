<template>
  <button class="continue-card" type="button" @click="$emit('open', book)">
    <span class="continue-card-bg-container">
      <span
        class="continue-bg"
        :style="book.cover ? { backgroundImage: `url(${book.cover})` } : {}"
      ></span>
      <span class="continue-overlay"></span>
    </span>
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
      <span class="continue-meta">{{ totalPagesLabel }} Pages - {{ bookFormat }}</span>
    </span>
    <span class="continue-play" title="Listen" aria-hidden="true">
      <i class="ri-play-line"></i>
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

const totalPagesLabel = computed(() => props.book.pages || "-");
const bookFormat = computed(() => props.book.format || "EPUB");
const bookInitial = computed(() => props.book.title?.trim()?.charAt(0)?.toUpperCase() || "?");
</script>

<style scoped>
.continue-card {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: 130px;
  margin-top: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: var(--color-text-on-brand);
  text-align: left;
  cursor: pointer;
  box-shadow: none;
  z-index: 1;
}

.continue-card-bg-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 16px;
  z-index: -1;
}

.continue-bg,
.continue-overlay {
  position: absolute;
}

.continue-bg {
  top: -20px;
  left: -20px;
  right: -20px;
  bottom: -20px;
  background: linear-gradient(100deg, #5b5965 0%, #7e475f 54%, #8a8990 100%);
  background-size: cover;
  background-position: center;
  filter: blur(25px) saturate(150%);
  transform: scale(1.2);
}

.continue-overlay {
  inset: 0;
  background:
    linear-gradient(
      135deg,
      var(--color-background-overlay-strong) 0%,
      var(--color-background-overlay-faint) 100%
    ),
    rgba(73, 69, 80, 0.18);
}

.continue-cover-wrap {
  position: absolute;
  top: 10px;
  left: 15px;
  z-index: 1;
  width: 72px;
  height: 110px;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: none;
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
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  margin-left: 104px;
  padding-right: 50px;
}

.continue-title,
.continue-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.continue-title {
  display: -webkit-box;
  margin: 0 0 0.5rem;
  overflow: hidden;
  color: var(--color-text-on-brand);
  font-size: 1.1rem;
  line-height: 1.3;
  text-shadow: var(--shadow-text-on-image);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
}

.continue-meta {
  margin: 0;
  color: var(--color-text-on-image-secondary);
  font-size: 0.8rem;
  font-weight: 400;
}

.continue-play {
  position: absolute;
  top: 50%;
  right: 15px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-border-on-image-strong);
  border-radius: 50%;
  background: var(--color-surface-on-image-soft);
  color: var(--color-text-on-brand);
  font-size: 1rem;
  transform: translateY(-50%);
  transition: all 0.3s ease;
}

.continue-card:hover .continue-play {
  background: var(--color-surface-on-image-hover);
  border-color: var(--color-text-on-image-secondary);
  transform: translateY(-50%) scale(1.05);
}

@media (max-width: 360px) {
  .continue-card {
    height: 124px;
  }

  .continue-cover-wrap {
    top: 10px;
    left: 13px;
    width: 68px;
    height: 104px;
  }

  .continue-info {
    margin-left: 94px;
    padding-right: 46px;
  }

  .continue-title {
    font-size: 1rem;
  }
}
</style>
