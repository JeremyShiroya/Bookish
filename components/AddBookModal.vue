<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h2>Add New Book</h2>
        <button class="close-button" @click="closeModal">
          <i class="ri-close-line"></i>
        </button>
      </div>
      
      <form @submit.prevent="saveBook" class="modal-form">
        <div class="form-content">
          <!-- Left side - Book Cover -->
          <div class="cover-section">
            <div class="cover-container" @click="triggerCoverInput">
              <img :src="coverPreview || '/placeholder-book.jpg'" alt="Book Cover" class="cover-image" />
              <div class="cover-overlay">
                <i class="ri-camera-line"></i>
                <span>{{ coverPreview ? 'Change Cover' : 'Upload Cover' }}</span>
              </div>
              <input 
                type="file" 
                ref="coverInput" 
                @change="handleCoverChange" 
                accept="image/*" 
                style="display: none" 
              />
            </div>
            <p class="cover-hint">Click to upload cover image</p>

            <!-- Document Upload -->
            <div class="document-upload-section">
              <label>Book Document *</label>
              <div 
                class="document-dropzone" 
                :class="{ 'has-file': documentFile }"
                @click="triggerDocumentInput"
              >
                <i :class="documentFile ? 'ri-file-text-line' : 'ri-upload-2-line'"></i>
                <div class="doc-info">
                  <span class="doc-name">{{ documentFile ? documentFile.name : 'Upload .epub, .pdf, .mobi' }}</span>
                  <span class="doc-size" v-if="documentFile">{{ formatFileSize(documentFile.size) }}</span>
                </div>
              </div>
              <input
                type="file"
                ref="documentInput"
                @change="handleDocumentChange"
                accept=".epub,.pdf,.mobi,.azw3,.txt"
                style="display: none"
                required
              />
              <p v-if="extractionError" class="extraction-error">{{ extractionError }}</p>
            </div>
          </div>

          <!-- Right side - Book Details -->
          <div class="details-section">
            <div class="form-group">
              <label for="title">Title *</label>
              <input 
                type="text" 
                id="title" 
                v-model="newBook.title" 
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
                v-model="newBook.author" 
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
                v-model="newBook.series" 
                placeholder="Enter series name (optional)"
                class="form-input"
              />
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" @click="closeModal" class="cancel-button">
            <i class="ri-close-line"></i>
            Cancel
          </button>
          <button type="submit" class="save-button" :disabled="!documentFile || isProcessing || !!extractionError">
            <i class="ri-add-line" v-if="!isProcessing"></i>
            <i class="ri-loader-4-line spinner" v-else></i>
            {{ isProcessing ? 'Processing...' : 'Add Book' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['close', 'add'])

const newBook = ref({
  title: '',
  author: '',
  series: '',
  format: '',
  rating: 0, // Default to 0, but not shown in UI
  progress: 0,
  status: 'Unread',
  isFavourite: false,
  genres: []
})

const coverPreview = ref(null)
const documentFile = ref(null)
const coverInput = ref(null)
const documentInput = ref(null)
const isProcessing = ref(false)
const extractionError = ref(null)

const triggerCoverInput = () => {
  coverInput.value.click()
}

const triggerDocumentInput = () => {
  documentInput.value.click()
}

const handleCoverChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    coverPreview.value = URL.createObjectURL(file)
  }
}

const handleDocumentChange = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  extractionError.value = null
  documentFile.value = file
  const extension = file.name.split('.').pop().toLowerCase()
  newBook.value.format = extension

  if (!newBook.value.title) {
    newBook.value.title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
  }

  if (extension === 'txt' || extension === 'html' || extension === 'htm') {
    isProcessing.value = true
    const reader = new FileReader()
    reader.onload = (e) => {
      newBook.value.content = e.target.result
      isProcessing.value = false
    }
    reader.onerror = () => {
      extractionError.value = 'Could not read file.'
      isProcessing.value = false
    }
    reader.readAsText(file)

  } else if (extension === 'epub') {
    isProcessing.value = true
    try {
      const { extractEpub } = await import('~/composables/useEpubExtractor.js')
      newBook.value.content = await extractEpub(file)
    } catch (err) {
      extractionError.value = `EPUB error: ${err.message}`
      newBook.value.content = null
    } finally {
      isProcessing.value = false
    }

  } else if (extension === 'pdf') {
    isProcessing.value = true
    const reader = new FileReader()
    reader.onload = (e) => {
      newBook.value.content = e.target.result
      isProcessing.value = false
    }
    reader.onerror = () => {
      extractionError.value = 'Could not read PDF file.'
      isProcessing.value = false
    }
    reader.readAsDataURL(file)

  } else {
    newBook.value.content = null
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const closeModal = () => {
  emit('close')
}

const saveBook = () => {
  if (!documentFile.value || isProcessing.value) return

  const bookToSave = {
    ...newBook.value,
    cover: coverPreview.value || '/Images/The Boyfriend.jpg'
  }
  
  if (!bookToSave.series || bookToSave.series.trim() === '') {
    bookToSave.series = null
  }
  
  emit('add', bookToSave)
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
  font-weight: 700;
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
  margin-top: 1.5rem;
  margin-bottom: 2rem;
}

.cover-section {
  display: flex;
  flex-direction: column;
}

.cover-container {
  position: relative;
  aspect-ratio: 7/10;
  width: 100%;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f3f4f6;
  border: 2px dashed #d1d5db;
}

.cover-container:hover {
  transform: translateY(-2px);
  border-color: #6C97B1;
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
  background: rgba(0, 0, 0, 0.5);
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

.cover-hint {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.75rem;
  text-align: center;
  margin-bottom: 1.5rem;
}

.document-upload-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.document-upload-section label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.document-dropzone {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border: 2px dashed #d1d5db;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.document-dropzone:hover {
  border-color: #6C97B1;
  background: #f0f7ff;
}

.document-dropzone.has-file {
  border-color: #10b981;
  background: #f0fdf4;
}

.document-dropzone i {
  font-size: 1.5rem;
  color: #6b7280;
}

.document-dropzone.has-file i {
  color: #10b981;
}

.doc-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.doc-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-size {
  font-size: 0.7rem;
  color: #6b7280;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
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

.form-input:focus {
  outline: none;
  border-color: #6C97B1;
  background: white;
  box-shadow: 0 0 0 3px rgba(108, 151, 177, 0.1);
}

.details-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
  font-weight: 600;
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
  background: linear-gradient(135deg, #6C97B1 0%, #5a8299 100%);
  color: white;
  box-shadow: 0 4px 6px -1px rgba(108, 151, 177, 0.3);
}

.save-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #5a8299 0%, #4a6f85 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 8px -1px rgba(108, 151, 177, 0.4);
}

.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  filter: grayscale(0.5);
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .modal-container {
    margin: 0;
    border-radius: 0;
    max-height: 100vh;
  }

  .form-content {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

.extraction-error {
  font-size: 0.75rem;
  color: #ef4444;
  margin-top: 0.4rem;
}
</style>
