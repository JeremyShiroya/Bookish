<template>
  <button class="home-book-card" type="button" @click="$emit('open', book)">
    <span class="home-book-cover-wrap">
      <img
        v-if="book.cover"
        class="home-book-cover"
        :src="book.cover"
        :alt="book.title"
        @error="onCoverError($event, book.title)"
      />
      <span v-else class="home-book-cover fallback-cover">
        {{ bookInitial }}
      </span>
    </span>
    <span class="home-book-title">{{ book.title }}</span>
    <span class="home-book-author">{{ book.author || "Unknown author" }}</span>
  </button>
</template>

<script setup>
import { computed } from "vue";
import { onCoverError } from "~/composables/useCoverFallback";

const props = defineProps({
  book: {
    type: Object,
    required: true,
  },
});

defineEmits(["open"]);

const bookInitial = computed(() => props.book.title?.trim()?.charAt(0)?.toUpperCase() || "?");
</script>

<style scoped>
.home-book-card {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.home-book-cover-wrap {
  display: block;
  width: 100%;
  aspect-ratio: 96 / 145;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-surface-primary);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.home-book-cover {
  display: flex;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fallback-cover {
  align-items: center;
  justify-content: center;
  background: var(--color-brand-primary-soft);
  color: var(--color-brand-primary);
  font-size: 2rem;
}

.home-book-title,
.home-book-author {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-book-title {
  margin-top: 8px;
  color: var(--color-text-primary);
  font-size: var(--mobile-caption-size);
  line-height: 1.2;
}

.home-book-author {
  margin-top: 3px;
  color: var(--color-text-muted);
  font-size: var(--mobile-tiny-size);
  line-height: 1.2;
}
</style>
