<template>
  <div class="empty-state">
    <div class="empty-icon-wrap">
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

.empty-icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(138, 43, 226, 0.08);
  border: 1px solid rgba(138, 43, 226, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.75rem;
}

.empty-icon-wrap i {
  font-size: 2.25rem;
  color: #8A2BE2;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a2332;
  margin: 0 0 0.5rem 0;
}

.empty-description {
  font-size: 0.9375rem;
  color: #6b7280;
  max-width: 340px;
  margin: 0 0 1.75rem 0;
  line-height: 1.65;
}
</style>
