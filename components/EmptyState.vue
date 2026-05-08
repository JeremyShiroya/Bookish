<template>
  <div class="empty-state">
    <div class="empty-icon-container">
      <div class="icon-blob"></div>
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
  padding: 4rem 2rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(138, 43, 226, 0.1);
  border-radius: 2rem;
  margin: 2rem 0;
}

.empty-icon-container {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2rem;
}

.icon-blob {
  position: absolute;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(138, 43, 226, 0.2) 0%, rgba(172, 211, 255, 0.2) 100%);
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  animation: blob-bounce 8s infinite ease-in-out;
}

@keyframes blob-bounce {
  0%, 100% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: scale(1); }
  33% { border-radius: 50% 50% 33% 67% / 55% 27% 73% 45%; transform: scale(1.1); }
  66% { border-radius: 33% 67% 58% 42% / 63% 68% 32% 37%; transform: scale(0.95); }
}

.empty-icon-container i {
  font-size: 4rem;
  color: #8A2BE2;
  z-index: 1;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: #233447;
  margin: 0 0 0.75rem 0;
}

.empty-description {
  font-size: 1rem;
  color: #6b7280;
  max-width: 400px;
  margin: 0 0 2rem 0;
  line-height: 1.6;
}

.empty-action {
  animation: fade-up 0.5s ease-out;
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
