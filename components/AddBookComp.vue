<template>
  <div class="add-book-page">
    <div class="page-header">
      <div>
        <h1>Add New Book</h1>
        <p class="subtitle">Upload a document and fill in the details below, or fetch metadata from the web.</p>
      </div>
      <button class="btn-cancel" @click="goBack">Back to Library</button>
    </div>

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
          <SkeletonLoader variant="metadata" />
        </div>
        <div v-else-if="metadataResults.length === 0" class="metadata-empty">
          <p>No results found for "{{ newBook.title }}" by "{{ newBook.author || 'any' }}".</p>
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
              <p class="metadata-year" v-if="result.publishYear">{{ result.publishYear }} <span v-if="result.genre">• {{ result.genre }}</span></p>
              <p class="metadata-series" v-if="result.series">{{ result.series }} <span v-if="result.seriesInstallment">#{{ result.seriesInstallment }}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <CoverImageModal
      :visible="showCoverModal"
      :mode="coverModalMode"
      :loading="isSearchingCovers"
      :images="coverOptions"
      @close="closeCoverModal"
      @upload="triggerCoverInput"
      @search="searchBookCovers"
      @select="selectBookCover"
    />

    <form @submit.prevent="saveBook" class="add-form">
      <!-- Media Section -->
      <div class="media-column">
        <!-- Cover Upload -->
        <div class="cover-container" @click="openCoverModal">
          <img v-if="coverPreview" :src="coverPreview" alt="Book Cover" class="cover-image" />
          <div v-else class="cover-placeholder">
            <i class="ri-image-add-line"></i>
            <span>Upload Cover</span>
          </div>
          <div class="cover-overlay" :class="{ 'active': coverPreview }">
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

        <!-- Document Upload -->
        <div class="document-section">
          <div 
            class="document-dropzone" 
            :class="{ 'has-file': documentFile, 'is-processing': isProcessing }"
            @click="triggerDocumentInput"
          >
            <div class="dropzone-icon">
              <i v-if="isProcessing" class="ri-loader-4-line spinner"></i>
              <i v-else-if="documentFile" class="ri-file-text-fill text-success"></i>
              <i v-else class="ri-upload-cloud-2-line"></i>
            </div>
            <div class="doc-info">
              <span class="doc-title">{{ isProcessing ? 'Processing File...' : (documentFile ? documentFile.name : 'Select Book Document') }}</span>
              <span class="doc-subtitle">{{ documentFile && !isProcessing ? formatFileSize(documentFile.size) : 'Supports .epub, .pdf, .txt' }}</span>
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
          <p v-if="extractionError" class="error-message">
            <i class="ri-error-warning-line"></i> {{ extractionError }}
          </p>
        </div>
      </div>

      <!-- Details Section -->
      <div class="details-column">
        <!-- Web Fetch CTA -->
        <div class="fetch-metadata-card">
          <div class="fetch-info">
            <i class="ri-file-search-line"></i>
            <div>
              <strong>Auto-fill Details</strong>
              <p>Search the web to automatically fetch book covers, blurbs, and details.</p>
            </div>
          </div>
          <button type="button" class="btn-fetch" @click="fetchMetadata" :disabled="!newBook.title">
            Fetch Metadata
          </button>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="title">Book Title <span class="required">*</span></label>
            <input 
              type="text" 
              id="title" 
              v-model="newBook.title" 
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
              v-model="newBook.author" 
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
            v-model="newBook.blurb" 
            class="form-input textarea"
            placeholder="Book description..."
            rows="4"
          ></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="series">Series</label>
            <input 
              type="text" 
              id="series" 
              v-model="newBook.series" 
              placeholder="e.g. Middle-earth Universe"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="seriesInstallment">Number / Installment</label>
            <input 
              type="text" 
              id="seriesInstallment" 
              v-model="newBook.seriesInstallment" 
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
              v-model="newBook.publishYear" 
              placeholder="e.g. 1954"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="genre">Genre</label>
            <input 
              type="text" 
              id="genre" 
              v-model="newBook.genre" 
              placeholder="e.g. Fantasy, Adventure"
              class="form-input"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="status">Reading Status</label>
            <div class="select-wrapper">
              <select id="status" v-model="newBook.status" class="form-input custom-select">
                <option value="Unread">Unread</option>
                <option value="Reading">Currently Reading</option>
                <option value="Read">Finished</option>
              </select>
              <i class="ri-arrow-down-s-line select-icon"></i>
            </div>
          </div>
        </div>

        <div class="form-group" v-if="newBook.webReview">
          <label class="web-review-label">
            <svg class="goodreads-svg-inline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f4f1ea"/><path fill="#382110" d="M13.203 14.341c-2.404 0-3.329-1.22-3.329-3.272c0-2.324 1.21-3.313 3.329-3.313c2.424 0 3.329 1.23 3.329 3.313c0 2.052-.925 3.272-3.329 3.272M13.203 5c-3.134 0-5.46 1.251-5.46 5.424c0 3.518 1.879 5.86 5.46 5.86c1.192 0 2.454-.369 3.329-1.313v1.313c0 2.502-1.128 3.579-3.329 3.579c-2.051 0-3.18-.892-3.344-2.267H7.728c.164 2.462 2.379 4.144 5.475 4.144c4.154 0 5.459-2.195 5.459-5.456V5.215h-2.133v1.1c-.875-.953-2.138-1.315-3.326-1.315z"/></svg>
            Web Review
          </label>
          <div class="readonly-review">
            {{ newBook.webReview }}
          </div>
        </div>

        <div class="page-actions">
          <button type="submit" class="btn-primary" :disabled="!documentFile || isProcessing">
            <i class="ri-add-line" v-if="!isProcessing"></i>
            <i class="ri-loader-4-line spinner" v-else></i>
            {{ isProcessing ? 'Adding Book...' : 'Add Book to Library' }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBooks } from '~/composables/useBooks'
import { useToast } from '~/composables/useToast'
import { useBookStorage } from '~/composables/useBookStorage'
import { useCoverImageCache } from '~/composables/useCoverImageCache'
import CoverImageModal from './CoverImageModal.vue'

const router = useRouter()
const { addBook } = useBooks()
const { addToast } = useToast()
const { saveBookContent } = useBookStorage()
const { cacheCoverImage } = useCoverImageCache()
const extractedContent = ref(null)
const extractedTocTitles = ref([])
const extractedSource = ref(null)
const extractedTocItems = ref([])

const newBook = ref({
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
  genre: ''
})

const coverPreview = ref(null)
const documentFile = ref(null)
const coverInput = ref(null)
const documentInput = ref(null)
const isProcessing = ref(false)
const extractionError = ref(null)

const showMetadataModal = ref(false)
const isFetchingMetadata = ref(false)
const metadataResults = ref([])
const showCoverModal = ref(false)
const coverModalMode = ref('choice')
const isSearchingCovers = ref(false)
const coverOptions = ref([])

const openCoverModal = () => {
  coverModalMode.value = 'choice'
  showCoverModal.value = true
}

const closeCoverModal = () => {
  showCoverModal.value = false
  coverModalMode.value = 'choice'
}

const triggerCoverInput = () => {
  closeCoverModal()
  coverInput.value?.click()
}
const triggerDocumentInput = () => documentInput.value.click()

const goBack = () => {
  router.push('/books')
}

const handleCoverChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => { coverPreview.value = e.target.result }
    reader.readAsDataURL(file)
  }
}

const searchBookCovers = async () => {
  if (!newBook.value.title) {
    addToast('Enter a title before searching for covers.', 'error')
    return
  }

  coverModalMode.value = 'picker'
  isSearchingCovers.value = true
  coverOptions.value = []

  try {
    const query = new URLSearchParams()
    query.append('title', newBook.value.title)
    if (newBook.value.author) query.append('author', newBook.value.author)

    const response = await fetch(`/api/books/search-covers?${query.toString()}`)
    const data = await response.json()
    coverOptions.value = data.images || []
    if (!coverOptions.value.length) {
      addToast('No cover images found on the web.', 'error')
    }
  } catch (error) {
    console.error('Failed to search covers:', error)
    addToast('Failed to search for cover images.', 'error')
  } finally {
    isSearchingCovers.value = false
  }
}

const selectBookCover = async (imageUrl) => {
  coverPreview.value = await cacheCoverImage(imageUrl)
  closeCoverModal()
}

const generateCoverPlaceholder = (title) => {
  const colors = getThemeCssVars([
    { name: '--color-book-cover-placeholder-one', fallback: '#8A2BE2' },
    { name: '--color-book-cover-placeholder-two', fallback: '#6A0DAD' },
    { name: '--color-book-cover-placeholder-three', fallback: '#9370DB' },
    { name: '--color-book-cover-placeholder-four', fallback: '#BA55D3' },
    { name: '--color-book-cover-placeholder-five', fallback: '#DDA0DD' },
  ])
  const hash = [...title].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  const initial = title.trim()[0]?.toUpperCase() || '?'
  const displayTitle = title.length > 18 ? `${title.substring(0, 18)}...` : title
  const softText = getThemeCssVar('--color-book-cover-placeholder-text-soft', 'rgba(255,255,255,0.25)')
  const strongText = getThemeCssVar('--color-book-cover-placeholder-text-strong', 'rgba(255,255,255,0.65)')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="${color}"/><text x="100" y="130" font-family="serif" font-size="100" fill="${softText}" text-anchor="middle" dominant-baseline="middle">${initial}</text><text x="100" y="230" font-family="sans-serif" font-size="11" fill="${strongText}" text-anchor="middle">${displayTitle}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const handleDocumentChange = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  extractionError.value = null
  documentFile.value = file
  extractedContent.value = null
  extractedTocTitles.value = []
  extractedSource.value = null
  extractedTocItems.value = []
  const extension = file.name.split('.').pop().toLowerCase()
  newBook.value.format = extension

  if (!newBook.value.title) {
    newBook.value.title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
  }

  if (['txt', 'html', 'htm'].includes(extension)) {
    isProcessing.value = true
    const reader = new FileReader()
    reader.onload = (e) => {
      extractedContent.value = e.target.result
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
      const result = await extractEpub(file)
      extractedContent.value = result.content
      extractedTocTitles.value = result.tocTitles ?? []
      newBook.value.pages = result.pages || 0
      // Auto-populate cover from the EPUB's embedded cover image if the user
      // hasn't already selected one manually.
      if (result.cover && !coverPreview.value) {
        coverPreview.value = result.cover
      }
    } catch (err) {
      extractionError.value = `Could not extract EPUB content. The book will be added without in-app reading.`
    } finally {
      isProcessing.value = false
    }

  } else if (extension === 'pdf') {
    isProcessing.value = true
    try {
      const { extractPdf } = await import('~/composables/usePdfExtractor.js')
      const result = await extractPdf(file)
      extractedContent.value = result.content
      extractedSource.value = result.source ?? null
      extractedTocItems.value = result.tocItems ?? []
      newBook.value.pages = result.pages || 0
    } catch (err) {
      extractionError.value = 'Could not extract PDF text. The book will be added without in-app reading.'
    } finally {
      isProcessing.value = false
    }

  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const fetchMetadata = async () => {
  if (!newBook.value.title) return;
  
  isFetchingMetadata.value = true;
  showMetadataModal.value = true;
  metadataResults.value = [];

  try {
    const query = new URLSearchParams();
    query.append('title', newBook.value.title);
    if (newBook.value.author) {
      query.append('author', newBook.value.author);
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

const selectMetadata = async (result) => {
  newBook.value.title = result.title || newBook.value.title;
  newBook.value.author = result.author || newBook.value.author;
  newBook.value.blurb = result.blurb || newBook.value.blurb;
  newBook.value.publishYear = result.publishYear || newBook.value.publishYear;
  newBook.value.series = result.series || newBook.value.series;
  newBook.value.seriesInstallment = result.seriesInstallment || newBook.value.seriesInstallment;
  newBook.value.webReview = result.webReview || newBook.value.webReview;
  newBook.value.genre = result.genre || newBook.value.genre;
  
  if (result.cover) {
    coverPreview.value = await cacheCoverImage(result.cover);
  }
  
  showMetadataModal.value = false;
  addToast('Metadata applied successfully', 'success');
}

const getPdfSourceForStorage = async () => {
  if (extractedSource.value) return extractedSource.value
  if (newBook.value.format === 'pdf' && documentFile.value) {
    return await documentFile.value.arrayBuffer()
  }
  return null
}

const saveBook = async () => {
  if (!documentFile.value || isProcessing.value) return
  
  isProcessing.value = true;
  const cachedCover = await cacheCoverImage(coverPreview.value);

  const bookToSave = {
    ...newBook.value,
    cover: cachedCover || generateCoverPlaceholder(newBook.value.title || 'Book')
  }
  
  if (!bookToSave.series || bookToSave.series.trim() === '') {
    bookToSave.series = null
  }
  
  try {
    const savedBook = await addBook(bookToSave);
    const pdfSourceForStorage = bookToSave.format === 'pdf'
      ? await getPdfSourceForStorage()
      : extractedSource.value

    if ((extractedContent.value || pdfSourceForStorage) && savedBook?.id) {
      try {
        await saveBookContent(savedBook.id, {
          content: extractedContent.value,
          pages: savedBook.pages || 0,
          tocTitles: extractedTocTitles.value,
          source: pdfSourceForStorage,
          tocItems: extractedTocItems.value,
          format: savedBook.format || newBook.value.format,
          pdfTocChecked: (savedBook.format || newBook.value.format) === 'pdf',
        });
      } catch (storageErr) {
        console.error('IndexedDB write failed:', storageErr);
        if (bookToSave.format === 'pdf' && pdfSourceForStorage) {
          try {
            await saveBookContent(savedBook.id, {
              content: null,
              pages: savedBook.pages || newBook.value.pages || 0,
              tocTitles: [],
              source: pdfSourceForStorage,
              tocItems: extractedTocItems.value,
              format: savedBook.format || newBook.value.format,
              pdfTocChecked: (savedBook.format || newBook.value.format) === 'pdf',
            });
            addToast('Book added. PDF pages were saved, but extracted text was too large to keep.', 'warning');
            router.push('/books');
            return;
          } catch (fallbackErr) {
            console.error('IndexedDB PDF fallback write failed:', fallbackErr);
          }
        }
        addToast('Book added, but content could not be saved for in-app reading.', 'warning');
        router.push('/books');
        return;
      }
    }

    addToast('Book added to library successfully', 'success');
    router.push('/books');
  } catch (error) {
    console.error('Save error:', error);
    addToast('Failed to add book to library', 'error');
  } finally {
    isProcessing.value = false;
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
  color: var(--color-text-primary);
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin: 0;
}

.btn-cancel {
  padding: 0.75rem 1.5rem;
  background: var(--color-surface-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  color: var(--color-text-primary);
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: var(--color-surface-secondary);
}

.add-form {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 3rem;
  background: var(--color-surface-primary);
  padding: 2.5rem;
  border-radius: 20px;
  border: 1px solid var(--color-border-card);
  box-shadow: var(--shadow-form-shell);
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
  background: var(--color-surface-primary);
  border: 2px dashed var(--color-border-card);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-container:hover {
  border-color: var(--color-border-focus);
  background: var(--color-surface-tertiary);
}

.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
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
  background: var(--color-background-overlay-strong);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-on-brand);
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

.document-dropzone {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--color-surface-primary);
  border: 1px solid var(--color-border-card);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.document-dropzone:hover {
  border-color: var(--color-border-focus);
  background: var(--color-surface-secondary);
}

.document-dropzone.has-file {
  background: var(--color-status-success-soft);
  border-color: var(--color-status-success-strong);
}

.document-dropzone.is-processing {
  background: var(--color-status-warning-soft);
  border-color: var(--color-status-warning-border);
  pointer-events: none;
}

.dropzone-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--color-surface-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-control-subtle);
  font-size: 1.5rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.text-success {
  color: var(--color-status-success-strong);
}

.doc-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.doc-title {
  font-size: 0.95rem;
  font-weight: 400;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-subtitle {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.error-message {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-status-danger-bright);
  display: flex;
  align-items: center;
  gap: 0.25rem;
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
  background: var(--color-surface-primary);
  border: 1px solid var(--color-brand-primary);
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
  color: var(--color-brand-primary);
}

.web-review-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.goodreads-svg-inline {
  width: 18px;
  height: 18px;
}

.fetch-info .goodreads-svg {
  width: 40px;
  height: 40px;
}

.fetch-info strong {
  display: block;
  font-size: 1rem;
  color: var(--color-text-primary);
}

.fetch-info p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.btn-fetch {
  padding: 0.75rem 1.5rem;
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  border: none;
  border-radius: 8px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-brand-button);
}

.btn-fetch:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-brand-button-hover);
}

.btn-fetch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(100%);
  box-shadow: none;
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
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.required {
  color: var(--color-status-danger-bright);
}

.form-input {
  width: 100%;
  padding: 0.85rem 1rem;
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border-card);
  border-radius: 10px;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  transition: all 0.2s;
  font-family: inherit;
}

.form-input.textarea {
  resize: vertical;
  min-height: 100px;
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

.form-input:focus {
  outline: none;
  background: var(--color-surface-tertiary);
  border-color: var(--color-border-focus);
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
  color: var(--color-text-muted);
  pointer-events: none;
}

.readonly-review {
  padding: 1rem;
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.page-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 2rem;
  border-top: 1px solid var(--color-border-card);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 2rem;
  background: var(--gradient-brand-primary);
  border: none;
  border-radius: 10px;
  color: var(--color-text-on-brand);
  font-weight: 400;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: var(--shadow-brand-button);
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand-button-hover);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  filter: grayscale(100%);
}

.spinner {
  display: inline-block;
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Metadata Modal Styles */
.metadata-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-background-overlay-soft);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 1rem;
}

.metadata-modal-container {
  background: var(--color-surface-primary);
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
}

.metadata-modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metadata-modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-text-primary);
}

.close-button {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
}

.close-button:hover {
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
}

.metadata-loading, .metadata-empty {
  padding: 1.5rem;
  color: var(--color-text-muted);
}

.metadata-results {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.metadata-card {
  display: flex;
  gap: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--color-surface-primary);
}

.metadata-card:hover {
  border-color: var(--color-brand-primary);
  background: var(--color-surface-active);
  transform: translateY(-2px);
}

.metadata-cover {
  width: 70px;
  height: 105px;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: var(--shadow-control-subtle);
}

.metadata-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
}

.metadata-info h4 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.metadata-author {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

.metadata-year, .metadata-series {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

/* Responsive */
@media (max-width: 900px) {
  .add-form {
    grid-template-columns: 1fr;
    padding: 1.5rem;
  }

  .media-column {
    flex-direction: row;
  }

  .cover-container {
    width: 150px;
    flex-shrink: 0;
  }

  .document-section {
    flex: 1;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .add-book-page {
    padding: 1rem;
  }

  .media-column {
    flex-direction: column;
  }

  .cover-container {
    width: 200px;
    margin: 0 auto;
  }
  
  .page-header {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
