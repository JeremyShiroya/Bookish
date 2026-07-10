<template>
  <div class="empty-state">
    <img v-if="image" class="empty-image" :src="image" alt="" />
    <div v-else class="empty-icon-wrap">
      <i :class="icon"></i>
    </div>
    <h2 class="empty-title">{{ title }}</h2>
    <p class="empty-description">{{ description }}</p>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action"></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  icon: {
    type: String,
    default: "ri-inbox-line"
  },
  // When set, an illustration replaces the icon badge entirely.
  image: {
    type: String,
    default: ""
  }
});
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 2rem;
  text-align: center;
}

.empty-image {
  width: min(200px, 62%);
  height: auto;
  margin-bottom: 1.5rem;
  object-fit: contain;
}

.empty-icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--color-brand-primary-faint);
  border: 1px solid var(--color-brand-primary-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.75rem;
}

.empty-icon-wrap i {
  font-size: 2.25rem;
  color: var(--color-brand-primary);
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-brand-primary);
  margin: 0 0 0.5rem 0;
}

.empty-description {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  max-width: 340px;
  margin: 0 0 1.75rem 0;
  line-height: 1.65;
}
</style>
