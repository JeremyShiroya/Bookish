<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h2>Edit Book</h2>
        <button class="close-button" @click="closeModal">
          <i class="ri-close-line"></i>
        </button>
      </div>
      
      <form @submit.prevent="saveBook" class="modal-form">
        <div class="form-content">
          <!-- Left side - Book Cover -->
          <div class="cover-section">
            <div class="cover-container" @click="triggerCoverInput">
              <img :src="editedBook.cover" :alt="editedBook.title" class="cover-image" />
              <div class="cover-overlay">
                <i class="ri-camera-line"></i>
                <span>Change Cover</span>
              </div>
              <input 
                type="file" 
                ref="coverInput" 
                @change="handleCoverChange" 
                accept="image/*" 
                style="display: none" 
              />
            </div>
          </div>

          <!-- Right side - Book Details -->
          <div class="details-section">
            <div class="form-group">
              <label for="title">Title *</label>
              <input 
                type="text" 
                id="title" 
                v-model="editedBook.title" 
                required 
                class="form-input"
                placeholder="Enter book title"
              />
            </div>

            <div class="form-group">
              <label for="author">Author *</label>
              <input 
                type="text" 
                id="author" 
                v-model="editedBook.author" 
                required 
                class="form-input"
                placeholder="Enter author name"
              />
            </div>

            <div class="form-group">
              <label for="series">Series</label>
              <input 
                type="text" 
                id="series" 
                v-model="editedBook.series" 
                placeholder="Enter series name (optional)"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="seriesInstallment">Series Number / Installment</label>
              <input 
                type="text" 
                id="seriesInstallment" 
                v-model="editedBook.seriesInstallment" 
                placeholder="Enter series installment"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="blurb">Blurb / Description</label>
              <textarea 
                id="blurb" 
                v-model="editedBook.blurb" 
                class="form-input textarea"
                placeholder="Book description..."
                rows="4"
              ></textarea>
            </div>

            <div class="form-group">
              <label for="publishYear">Publish Year</label>
              <input 
                type="number" 
                id="publishYear" 
                v-model="editedBook.publishYear" 
                placeholder="Enter publish year"
                class="form-input"
              />
            </div>

            <div class="form-group" v-if="editedBook.webReview">
              <label>Web Review</label>
              <div class="readonly-review">
                {{ editedBook.webReview }}
              </div>
            </div>

            <div class="form-group">
              <label>Rating</label>
              <div class="rating-section">
                <div class="star-rating">
                  <i 
                    v-for="n in 10" 
                    :key="n"
                    class="rating-star"
                    :class="{ 
                      'ri-star-fill': n <= editedBook.rating,
                      'ri-star-line': n > editedBook.rating,
                      'active': n <= editedBook.rating 
                    }"
                    @click="setRating(n)"
                    @mouseover="hoverRating = n"
                    @mouseleave="hoverRating = 0"
                  ></i>
                </div>
                <div class="rating-info">
                  <span class="rating-value">{{ editedBook.rating }}/10</span>
                  <span class="rating-label">{{ getRatingLabel(editedBook.rating) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" @click="closeModal" class="cancel-button">
            <i class="ri-close-line"></i>
            Cancel
          </button>
          <button type="submit" class="save-button">
            <i class="ri-save-line"></i>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  book: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'save'])

const editedBook = ref({ ...props.book })
const hoverRating = ref(0)
const coverInput = ref(null)

const triggerCoverInput = () => {
  coverInput.value.click()
}

const handleCoverChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      editedBook.value.cover = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

watch(() => props.book, (newBook) => {
  editedBook.value = { ...newBook }
}, { deep: true })

const closeModal = () => {
  emit('close')
}

const saveBook = () => {
  // Ensure series is null if empty string
  if (!editedBook.value.series || editedBook.value.series.trim() === '') {
    editedBook.value.series = null
  }
  emit('save', editedBook.value)
}

const setRating = (rating) => {
  editedBook.value.rating = rating
}

const getRatingLabel = (rating) => {
  if (rating === 0) return 'Not rated'
  if (rating >= 9) return 'Masterpiece'
  if (rating >= 8) return 'Excellent'
  if (rating >= 7) return 'Very Good'
  if (rating >= 6) return 'Good'
  if (rating === 5) return 'Average'
  if (rating >= 4) return 'Below Average'
  if (rating >= 3) return 'Poor'
  if (rating >= 2) return 'Very Poor'
  return 'Terrible'
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: white;
  border-radius: 1rem;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem 2rem 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 400;
  color: #1f2937;
  margin: 0;
}

.close-button {
  padding: 0.75rem;
  border: none;
  background: #f9fafb;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-form {
  padding: 0 2rem 2rem;
}

.form-content {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 3rem;
  margin-bottom: 2rem;
}

.cover-section {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.cover-container {
  position: relative;
  aspect-ratio: 7/10;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
}

.cover-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
}

.cover-container:hover .cover-overlay {
  opacity: 1;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.cover-overlay i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.cover-overlay span {
  font-size: 0.875rem;
  font-weight: 400;
}

.details-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 400;
  color: #374151;
}

.form-input {
  padding: 0.875rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.2s;
  background: #fafafa;
}

.form-input.textarea {
  resize: vertical;
  min-height: 80px;
}

.form-input:focus {
  outline: none;
  border-color: #8A2BE2;
  background: white;
  box-shadow: 0 0 0 3px rgba(138, 43, 226, 0.1);
}

.readonly-review {
  padding: 0.875rem 1rem;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
  line-height: 1.5;
}

.rating-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.star-rating {
  display: flex;
  gap: 0.25rem;
}

.rating-star {
  font-size: 1.5rem;
  color: #d1d5db;
  cursor: pointer;
  transition: all 0.2s;
}

.rating-star:hover,
.rating-star.active {
  color: #fbbf24;
  transform: scale(1.1);
}

.rating-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.rating-value {
  font-size: 1.125rem;
  font-weight: 400;
  color: #1f2937;
}

.rating-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 400;
  padding: 0.25rem 0.75rem;
  background: #f3f4f6;
  border-radius: 1rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1.5rem;
  border-top: 1px solid #f3f4f6;
}

.cancel-button,
.save-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-button {
  border: 2px solid #e5e7eb;
  background: white;
  color: #6b7280;
}

.cancel-button:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.save-button {
  border: none;
  background: linear-gradient(135deg, #8A2BE2 0%, #6A0DAD 100%);
  color: white;
  box-shadow: 0 4px 6px -1px rgba(138, 43, 226, 0.3);
}

.save-button:hover {
  background: linear-gradient(135deg, #6A0DAD 0%, #590A96 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 8px -1px rgba(138, 43, 226, 0.4);
}

@media (max-width: 768px) {
  .modal-container {
    margin: 0;
    border-radius: 0;
    max-height: 100vh;
  }
  
  .modal-header {
    padding: 1.5rem;
  }
  
  .modal-form {
    padding: 0 1.5rem 1.5rem;
  }
  
  .form-content {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .cancel-button,
  .save-button {
    justify-content: center;
  }
}
</style>
