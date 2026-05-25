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
          <i v-if="toast.type === 'success'" class="ri-checkbox-circle-fill"></i>
          <i v-if="toast.type === 'error'" class="ri-error-warning-fill"></i>
        </div>
        <div class="toast-content">
          <p class="toast-message">{{ toast.message }}</p>
        </div>
        <button class="toast-close" @click="removeToast(toast.id)">
          <i class="ri-close-line"></i>
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
  top: 2rem;
  right: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 9999;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--color-surface-glass);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: var(--shadow-toast);
  min-width: 300px;
  max-width: 450px;
}

.toast.success {
  border-left: 4px solid var(--color-status-success-strong);
}

.toast.error {
  border-left: 4px solid var(--color-status-danger-bright);
}

.toast-icon {
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast.success .toast-icon {
  color: var(--color-status-success-strong);
}

.toast.error .toast-icon {
  color: var(--color-status-danger-bright);
}

.toast-content {
  flex: 1;
}

.toast-message {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  font-weight: 500;
}

.toast-close {
  background: transparent;
  border: none;
  color: var(--color-text-subtle);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.toast-close:hover {
  background: var(--color-surface-tertiary);
  color: var(--color-text-secondary);
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}
</style>
