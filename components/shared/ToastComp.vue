<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="toast.type"
      >
        <div class="toast-icon">
          <i v-if="toast.type === 'success'" class="ri-checkbox-circle-line"></i>
          <i v-else-if="toast.type === 'error'" class="ri-alert-line"></i>
          <i v-else class="ri-information-line"></i>
        </div>
        <p class="toast-message">{{ toast.message }}</p>
        <button class="toast-close" aria-label="Dismiss" @click="removeToast(toast.id)">
          <i class="ri-close-circle-line"></i>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useToast } from '~/composables/useToast';

const { toasts, removeToast } = useToast();
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 16px);
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  z-index: 9999;
  pointer-events: none;
}

/* Soft alert-bar style: pale tinted pill with matching border, text, and icons. */
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 300px;
  max-width: 450px;
  padding: 0.8rem 0.9rem;
  border: 1px solid;
  border-radius: 10px;
  font-weight: 500;
}

.toast.error {
  background: #fdecec;
  border-color: #f3c1c5;
  color: #c04552;
}

.toast.success {
  background: #e9f7ee;
  border-color: #b5e0c4;
  color: #2f9e5f;
}

.toast.info {
  background: #fff8e6;
  border-color: #f4dfa2;
  color: #c19a2e;
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  margin: 0;
  color: inherit;
  font-size: 0.9rem;
  line-height: 1.35;
}

.toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0.15rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 1.15rem;
  opacity: 0.75;
  transition: opacity 0.2s;
}

.toast-close:hover {
  opacity: 1;
}

/* Transitions — slide in from the top. */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-18px) scale(0.96);
}

@media (max-width: 768px) {
  .toast-container {
    top: calc(env(safe-area-inset-top) + 12px);
    right: 1rem;
    left: 1rem;
    align-items: stretch;
    gap: 0.55rem;
  }

  .toast {
    width: 100%;
    min-width: 0;
    max-width: none;
    padding: 0.75rem 0.8rem;
  }

  .toast-message {
    font-size: 0.86rem;
  }
}
</style>
