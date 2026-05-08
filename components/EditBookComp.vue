<template>
  <div class="add-book-page">
    <div class="page-header">
      <div>
        <h1>Edit Book</h1>
        <p class="subtitle">Modify the book's metadata, update its cover, or fetch fresh details from the web.</p>
      </div>
      <button class="btn-cancel" @click="goBack">Back to Library</button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <i class="ri-loader-4-line spinner"></i>
      <p>Loading book details...</p>
    </div>

    <template v-else>
      <!-- Metadata Selection Modal -->
      <div v-if="showMetadataModal" class="metadata-modal-overlay" @click="showMetadataModal = false">
        <div class="metadata-modal-container" @click.stop>
          <div class="metadata-modal-header">
            <h2>Select Metadata</h2>
            <button class="close-button" @click="showMetadataModal = false">
              <i class="ri-close-line"></i>
            </button>
          </div>
          <div v-if="isFetchingMetadata" class="metadata-loading">
            <i class="ri-loader-4-line spinner"></i>
            <p>Searching for books...</p>
          </div>
          <div v-else-if="metadataResults.length === 0" class="metadata-empty">
            <p>No results found for "{{ editBook.title }}" by "{{ editBook.author || 'any' }}".</p>
          </div>
          <div v-else class="metadata-results">
            <div 
              v-for="result in metadataResults" 
              :key="result.googleId" 
              class="metadata-card"
              @click="selectMetadata(result)"
            >
              <img :src="result.cover || '/default-cover.png'" alt="Cover" class="metadata-cover" />
              <div class="metadata-info">
                <h4>{{ result.title }}</h4>
                <p class="metadata-author">{{ result.author }}</p>
                <p class="metadata-year" v-if="result.publishYear">{{ result.publishYear }}</p>
                <p class="metadata-series" v-if="result.series">{{ result.series }} <span v-if="result.seriesInstallment">#{{ result.seriesInstallment }}</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form @submit.prevent="handleUpdateBook" class="add-form">
        <!-- Media Section -->
        <div class="media-column">
          <!-- Cover Upload -->
          <div class="cover-container" @click="triggerCoverInput">
            <img v-if="coverPreview || editBook.cover" :src="coverPreview || editBook.cover" alt="Book Cover" class="cover-image" />
            <div v-else class="cover-placeholder">
              <i class="ri-image-add-line"></i>
              <span>Upload Cover</span>
            </div>
            <div class="cover-overlay" :class="{ 'active': coverPreview || editBook.cover }">
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
          
          <div class="info-card">
            <div class="info-item">
              <span class="info-label">Format</span>
              <span class="info-value">{{ editBook.format ? editBook.format.toUpperCase() : 'Unknown' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Current Progress</span>
              <span class="info-value">{{ editBook.progress }}%</span>
            </div>
          </div>
        </div>

        <!-- Details Section -->
        <div class="details-column">
          <!-- Web Fetch CTA -->
          <div class="fetch-metadata-card">
            <div class="fetch-info">
              <svg class="goodreads-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f4f1ea"/><path fill="#382110" d="M13.203 14.341c-2.404 0-3.329-1.22-3.329-3.272c0-2.324 1.21-3.313 3.329-3.313c2.424 0 3.329 1.23 3.329 3.313c0 2.052-.925 3.272-3.329 3.272M13.203 5c-3.134 0-5.46 1.251-5.46 5.424c0 3.518 1.879 5.86 5.46 5.86c1.192 0 2.454-.369 3.329-1.313v1.313c0 2.502-1.128 3.579-3.329 3.579c-2.051 0-3.18-.892-3.344-2.267H7.728c.164 2.462 2.379 4.144 5.475 4.144c4.154 0 5.459-2.195 5.459-5.456V5.215h-2.133v1.1c-.875-.953-2.138-1.315-3.326-1.315z"/></svg>
              <div>
                <strong>Update with Web Metadata</strong>
                <p>Refresh the cover, blurb, and details using search data from the web.</p>
              </div>
            </div>
            <button type="button" class="btn-fetch" @click="fetchMetadata" :disabled="!editBook.title">
              Fetch Metadata
            </button>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="title">Book Title <span class="required">*</span></label>
              <input 
                type="text" 
                id="title" 
                v-model="editBook.title" 
                required 
                class="form-input"
                placeholder="e.g. The Lord of the Rings"
              />
            </div>
            <div class="form-group">
              <label for="author">Author <span class="required">*</span></label>
              <input 
                type="text" 
                id="author" 
                v-model="editBook.author" 
                required 
                class="form-input"
                placeholder="e.g. J.R.R. Tolkien"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="blurb">Blurb / Description</label>
            <textarea 
              id="blurb" 
              v-model="editBook.blurb" 
              class="form-input textarea"
              placeholder="Book description..."
              rows="6"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="series">Series</label>
              <input 
                type="text" 
                id="series" 
                v-model="editBook.series" 
                placeholder="e.g. Middle-earth Universe"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="seriesInstallment">Number / Installment</label>
              <input 
                type="text" 
                id="seriesInstallment" 
                v-model="editBook.seriesInstallment" 
                placeholder="e.g. 1"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="publishYear">Publish Year</label>
              <input 
                type="number" 
                id="publishYear" 
                v-model="editBook.publishYear" 
                placeholder="e.g. 1954"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="status">Reading Status</label>
              <div class="select-wrapper">
                <select id="status" v-model="editBook.status" class="form-input custom-select">
                  <option value="Unread">Unread</option>
                  <option value="Reading">Currently Reading</option>
                  <option value="Read">Finished</option>
                </select>
                <i class="ri-arrow-down-s-line select-icon"></i>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Personal Rating</label>
            <div class="rating-input-container">
              <div class="star-rating">
                <i 
                  v-for="n in 10" 
                  :key="n"
                  class="rating-star"
                  :class="{ 
                    'ri-star-fill': n <= editBook.rating,
                    'ri-star-line': n > editBook.rating,
                    'active': n <= editBook.rating 
                  }"
                  @click="editBook.rating = n"
                ></i>
              </div>
              <span class="rating-display">{{ editBook.rating || 0 }}/10</span>
            </div>
          </div>

          <div class="form-group" v-if="editBook.webReview">
            <label>Web Review</label>
            <div class="readonly-review">
              {{ editBook.webReview }}
            </div>
          </div>

          <div class="page-actions">
            <button type="submit" class="btn-primary" :disabled="isUpdating">
              <i class="ri-save-line" v-if="!isUpdating"></i>
              <i class="ri-loader-4-line spinner" v-else></i>
              {{ isUpdating ? 'Saving Changes...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBooks } from '~/composables/useBooks'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  bookId: {
    type: String,
    required: true
  }
})

const router = useRouter()
const { fetchBookById, updateBook, books } = useBooks()
const { addToast } = useToast()

const editBook = ref({
  title: '',
  author: '',
  blurb: '',
  series: '',
  seriesInstallment: '',
  publishYear: null,
  webReview: '',
  format: '',
  pages: 0,
  rating: 0,
  progress: 0,
  status: 'Unread',
  isFavourite: false,
  genres: []
})

const isLoading = ref(true)
const isUpdating = ref(false)
const coverPreview = ref(null)
const coverInput = ref(null)

const showMetadataModal = ref(false)
const isFetchingMetadata = ref(false)
const metadataResults = ref([])

const triggerCoverInput = () => coverInput.value.click()

const goBack = () => {
  router.push('/books')
}

onMounted(async () => {
  try {
    // Find book in already loaded books first for instant feel
    const existing = books.value.find(b => b.id.toString() === props.bookId.toString())
    if (existing) {
      editBook.value = JSON.parse(JSON.stringify(existing))
    } else {
      // Fallback to fetch if not found
      const fetched = await fetchBookById(props.bookId)
      if (fetched) {
        editBook.value = fetched
      } else {
        addToast('Book not found', 'error')
        router.push('/books')
      }
    }
  } catch (err) {
    console.error('Error loading book:', err)
    addToast('Failed to load book details', 'error')
  } finally {
    isLoading.value = false
  }
})

const handleCoverChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => { 
      coverPreview.value = e.target.result 
      editBook.value.cover = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const fetchMetadata = async () => {
  if (!editBook.value.title) return;
  
  isFetchingMetadata.value = true;
  showMetadataModal.value = true;
  metadataResults.value = [];

  try {
    const query = new URLSearchParams();
    query.append('title', editBook.value.title);
    if (editBook.value.author) {
      query.append('author', editBook.value.author);
    }
    
    const response = await fetch(`/api/books/metadata?${query.toString()}`);
    const data = await response.json();
    
    if (data.results) {
      metadataResults.value = data.results;
    }
  } catch (error) {
    console.error('Failed to fetch metadata:', error);
    addToast('Failed to fetch metadata from the web.', 'error');
    showMetadataModal.value = false;
  } finally {
    isFetchingMetadata.value = false;
  }
}

const selectMetadata = (result) => {
  editBook.value.title = result.title || editBook.value.title;
  editBook.value.author = result.author || editBook.value.author;
  editBook.value.blurb = result.blurb || editBook.value.blurb;
  editBook.value.publishYear = result.publishYear || editBook.value.publishYear;
  editBook.value.series = result.series || editBook.value.series;
  editBook.value.seriesInstallment = result.seriesInstallment || editBook.value.seriesInstallment;
  editBook.value.webReview = result.webReview || editBook.value.webReview;
  
  if (result.cover) {
    editBook.value.cover = result.cover;
    coverPreview.value = result.cover;
  }
  
  showMetadataModal.value = false;
  addToast('Metadata applied successfully', 'success');
}

const handleUpdateBook = async () => {
  if (isUpdating.value) return
  
  isUpdating.value = true;

  const bookToUpdate = {
    ...editBook.value
  }
  
  if (!bookToUpdate.series || bookToUpdate.series.trim() === '') {
    bookToUpdate.series = null
  }
  
  try {
    await updateBook(bookToUpdate);
    addToast('Book updated successfully', 'success');
    router.push('/books');
  } catch (error) {
    console.error('Update error:', error);
    addToast('Failed to update book', 'error');
  } finally {
    isUpdating.value = false;
  }
}
</script>

<style scoped>
.add-book-page {
  padding: 0rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 400;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1rem;
  color: #64748b;
  margin: 0;
}

.btn-cancel {
  padding: 0.75rem 1.5rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #0f172a;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #f8fafc;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem;
  gap: 1rem;
  color: #64748b;
}

.spinner {
  font-size: 2rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.add-form {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 3rem;
  background: #ffffff;
  padding: 2.5rem;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
}

.media-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.cover-container {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  background: #f8fafc;
  border: 2px dashed #e2e8f0;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-container:hover {
  border-color: #8A2BE2;
  background: #f3e8ff;
}

.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #64748b;
}

.cover-placeholder i {
  font-size: 2.5rem;
}

.cover-placeholder span {
  font-size: 0.95rem;
  font-weight: 400;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  transition: opacity 0.2s;
  gap: 0.5rem;
}

.cover-container:hover .cover-overlay.active {
  opacity: 1;
}

.cover-overlay i {
  font-size: 2rem;
}

.info-card {
  padding: 1.25rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  font-weight: 400;
}

.info-value {
  font-size: 0.95rem;
  color: #0f172a;
}

.details-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.fetch-metadata-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  background: linear-gradient(to right, #f3e8ff, #ffffff);
  border: 1px solid #8A2BE2;
  border-radius: 12px;
  margin-bottom: 0.5rem;
}

.fetch-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.fetch-info i {
  font-size: 2rem;
  color: #8A2BE2;
}

.fetch-info .goodreads-svg {
  width: 40px;
  height: 40px;
}

.fetch-info strong {
  display: block;
  font-size: 1rem;
  color: #0f172a;
}

.fetch-info p {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}

.btn-fetch {
  padding: 0.75rem 1.5rem;
  background: #8A2BE2;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px -1px rgba(138, 43, 226, 0.3);
}

.btn-fetch:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 10px -1px rgba(138, 43, 226, 0.3);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 400;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.required {
  color: #ef4444;
}

.form-input {
  width: 100%;
  padding: 0.85rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.95rem;
  color: #0f172a;
  transition: all 0.2s;
  font-family: inherit;
}

.form-input.textarea {
  resize: vertical;
  min-height: 120px;
}

.form-input:focus {
  outline: none;
  background: #ffffff;
  border-color: #8A2BE2;
  box-shadow: 0 0 0 3px #f3e8ff;
}

.select-wrapper {
  position: relative;
}

.custom-select {
  appearance: none;
  cursor: pointer;
  padding-right: 2.5rem;
}

.select-icon {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  pointer-events: none;
}

.rating-input-container {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.5rem 0;
}

.star-rating {
  display: flex;
  gap: 0.25rem;
}

.rating-star {
  font-size: 1.75rem;
  color: #d1d5db;
  cursor: pointer;
  transition: all 0.2s;
}

.rating-star:hover,
.rating-star.active {
  color: #fbbf24;
  transform: scale(1.1);
}

.rating-display {
  font-size: 1.1rem;
  color: #475569;
  font-weight: 400;
  background: #f1f5f9;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
}

.readonly-review {
  padding: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.95rem;
  color: #334155;
  line-height: 1.5;
}

.page-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 2rem;
  background: linear-gradient(135deg, #8A2BE2 0%, #6A0DAD 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-weight: 400;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(138, 43, 226, 0.3);
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 12px -1px rgba(138, 43, 226, 0.3);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Metadata Modal Styles (Reused from AddBookComp) */
.metadata-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.metadata-modal-container {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.metadata-modal-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  background: white;
  z-index: 1;
}

.metadata-modal-header h2 {
  font-size: 1.25rem;
  margin: 0;
  font-weight: 400;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
}

.metadata-results {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.metadata-card {
  display: flex;
  gap: 1.5rem;
  padding: 1rem;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.metadata-card:hover {
  background: #f8fafc;
  border-color: #8A2BE2;
}

.metadata-cover {
  width: 80px;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
}

.metadata-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.metadata-author {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0 0 0.25rem 0;
}

.metadata-year {
  font-size: 0.85rem;
  color: #94a3b8;
}

.metadata-loading, .metadata-empty {
  padding: 4rem 2rem;
  text-align: center;
  color: #64748b;
}

@media (max-width: 768px) {
  .add-form {
    grid-template-columns: 1fr;
    padding: 1.5rem;
  }
  
  .media-column {
    max-width: 300px;
    margin: 0 auto;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .page-actions {
    flex-direction: column;
  }
  
  .btn-primary {
    width: 100%;
    justify-content: center;
  }
}
</style>
