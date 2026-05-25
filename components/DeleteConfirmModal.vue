<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <div class="warning-icon">
          <i class="ri-error-warning-line"></i>
        </div>
        <h2>Delete Book</h2>
      </div>
      
      <div class="modal-content">
        <p class="confirmation-text">
          Are you sure you want to delete <strong>"{{ book.title }}"</strong> by {{ book.author }}?
        </p>
        <p class="warning-text">
          This action cannot be undone.
        </p>
        
        <div class="book-preview">
          <img :src="book.cover" :alt="book.title" class="book-thumbnail" />
          <div class="book-details">
            <h3>{{ book.title }}</h3>
            <p>{{ book.author }}</p>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button @click="closeModal" class="cancel-button">
          Cancel
        </button>
        <button @click="confirmDelete" class="delete-button">
          <i class="ri-delete-bin-line"></i>
          Delete Book
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  book: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'confirm'])

const closeModal = () => {
  emit('close')
}

const confirmDelete = () => {
  emit('confirm')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-background-overlay-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: var(--color-surface-primary);
  border-radius: 0.75rem;
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-modal);
}

.modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1.5rem 1rem;
  text-align: center;
}

.warning-icon {
  width: 4rem;
  height: 4rem;
  background: var(--color-status-danger-soft);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.warning-icon i {
  font-size: 2rem;
  color: var(--color-status-danger);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-primary);
  margin: 0;
}

.modal-content {
  padding: 0 1.5rem 1rem;
  text-align: center;
}

.confirmation-text {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.warning-text {
  font-size: 0.75rem;
  color: var(--color-status-danger);
  margin-bottom: 1.5rem;
}

.book-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-surface-secondary);
  border-radius: 0.5rem;
  text-align: left;
}

.book-thumbnail {
  width: 50px;
  height: 70px;
  object-fit: cover;
  border-radius: 0.25rem;
}

.book-details h3 {
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem 0;
}

.book-details p {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.5rem 1.5rem;
}

.cancel-button,
.delete-button {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.cancel-button {
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-primary);
  color: var(--color-text-secondary);
}

.cancel-button:hover {
  background: var(--color-surface-secondary);
}

.delete-button {
  border: none;
  background: var(--color-status-danger);
  color: var(--color-text-on-brand);
}

.delete-button:hover {
  background: var(--color-status-danger-hover);
}

@media (max-width: 640px) {
  .modal-actions {
    flex-direction: column;
  }
}
</style>
